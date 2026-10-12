// Catalog metadata collection over an already-open connection. Only queries from the
// QUERIES allow-list are sent, by id. The transaction is always rolled back.

import { DbpError } from "../core/errors.ts";
import type { DatabaseModel, DbForeignKey, DbOtherRelation, DbTable, DbUniqueKey } from "../core/types.ts";
import { compareStrings } from "../prisma/discover.ts";
import { describeError } from "../safety/redact.ts";
import { QUERIES, type QueryId } from "./queries.ts";

export interface QueryClient {
  query(text: string, values?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
}

export interface CollectResult {
  db: DatabaseModel;
  executed: QueryId[];
  readOnlyVerified: boolean;
  statementTimeout: string | null;
}

export const MIN_SERVER_VERSION_NUM = 140000;

type Row = Record<string, unknown>;

const asStr = (v: unknown): string => (typeof v === "string" ? v : String(v));
const asBool = (v: unknown): boolean => v === true;
const asStrArr = (v: unknown): string[] => (Array.isArray(v) ? v.map(asStr) : []);

export async function collectCatalog(client: QueryClient, schemas: string[], now: () => Date = () => new Date()): Promise<CollectResult> {
  const executed: QueryId[] = [];
  const run = async (id: QueryId, params?: unknown[]): Promise<Row[]> => {
    executed.push(id);
    const res = await client.query(QUERIES[id], params);
    return res.rows;
  };
  const requested = [...new Set(schemas)].sort(compareStrings);
  const base: DatabaseModel = {
    origin: "live",
    collectedAt: now().toISOString(),
    server: { version: null, versionNum: null },
    requestedSchemas: requested,
    schemasFound: [],
    complete: false,
    gaps: [],
    tables: [],
    otherRelations: [],
    readOnly: { verified: false, detail: "not yet verified" },
  };

  let began = false;
  try {
    await run("begin");
    began = true;
    await run("setSearchPath");
    const info = (await run("sessionInfo"))[0] ?? {};
    if (info.read_only !== "on") {
      throw new DbpError("READ_ONLY_NOT_VERIFIED", "transaction_read_only is not 'on'; aborting before reading the catalog");
    }
    if (asStr(info.isolation) !== "repeatable read") {
      throw new DbpError("ISOLATION_NOT_VERIFIED", "transaction isolation is not REPEATABLE READ; aborting");
    }
    if (info.is_superuser === true) {
      throw new DbpError(
        "SUPERUSER_REJECTED",
        "the connection role is a superuser; live scans require a least-privilege read-only role (see docs/security.md)",
      );
    }
    if (info.is_superuser !== false) {
      throw new DbpError("ROLE_NOT_VERIFIED", "could not verify that the connection role is not a superuser; aborting");
    }
    base.readOnly = { verified: true, detail: "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY; transaction_read_only = on" };
    const versionNum = Number.parseInt(asStr(info.version_num), 10);
    base.server = { version: typeof info.version === "string" ? info.version : null, versionNum: Number.isFinite(versionNum) ? versionNum : null };
    const statementTimeout = typeof info.statement_timeout === "string" ? info.statement_timeout : null;

    if (!Number.isFinite(versionNum) || versionNum < MIN_SERVER_VERSION_NUM) {
      base.gaps.push({ scope: "*", reason: `server version ${base.server.version ?? "unknown"} is not supported (minimum 14); catalog not collected` });
      return { db: base, executed, readOnlyVerified: true, statementTimeout };
    }

    try {
      base.schemasFound = (await run("schemas", [requested])).map((r) => asStr(r.schema_name)).sort(compareStrings);
      const relRows = await run("relations", [requested]);
      const colRows = await run(versionNum >= 180000 ? "columnsV18" : "columns", [requested]);
      const conRows = await run(versionNum >= 180000 ? "constraintsV18" : "constraints", [requested]);
      const idxRows = await run(versionNum >= 150000 ? "indexesV15" : "indexes", [requested]);
      const built = normalize(relRows, colRows, conRows, idxRows);
      base.tables = built.tables;
      base.otherRelations = built.others;
      base.gaps.push(...built.gaps);
      base.complete = built.gaps.length === 0;
    } catch (e) {
      if (e instanceof DbpError) throw e;
      const first = describeError(e)[0];
      base.tables = [];
      base.otherRelations = [];
      base.gaps.push({ scope: "*", reason: `catalog query ${executed[executed.length - 1]} failed${first?.code ? ` (SQLSTATE ${first.code})` : ""}` });
      base.complete = false;
    }
    return { db: base, executed, readOnlyVerified: true, statementTimeout };
  } finally {
    if (began) {
      try {
        await run("rollback");
      } catch {
        /* connection is closed by the caller in any case */
      }
    }
  }
}

function key(schema: string, table: string): string {
  return JSON.stringify([schema, table]);
}

export function normalize(relRows: Row[], colRows: Row[], conRows: Row[], idxRows: Row[]) {
  const tables = new Map<string, DbTable>();
  const others: DbOtherRelation[] = [];
  const gaps: { scope: string; reason: string }[] = [];
  for (const r of relRows) {
    const schema = asStr(r.schema_name);
    const name = asStr(r.rel_name);
    const kind = asStr(r.relkind);
    if (kind === "r" || kind === "p") {
      const ps = asStrArr(r.parent_schemas);
      const pt = asStrArr(r.parent_tables);
      tables.set(key(schema, name), {
        schema,
        name,
        kind: kind === "p" ? "partitioned_table" : "table",
        inheritance: {
          isPartition: asBool(r.is_partition),
          hasInheritanceChildren: asBool(r.has_inheritance_children),
          inheritsFrom: ps.map((s, i) => ({ schema: s, table: pt[i] ?? "" })),
        },
        columns: [],
        uniqueKeys: [],
        foreignKeys: [],
      });
    } else {
      others.push({ schema, name, kind: kind === "v" ? "view" : kind === "m" ? "materialized_view" : "foreign_table" });
    }
  }
  const cols = [...colRows].sort((a, b) => Number(a.attnum) - Number(b.attnum));
  for (const c of cols) {
    const t = tables.get(key(asStr(c.schema_name), asStr(c.rel_name)));
    if (!t) continue;
    const col: DbTable["columns"][number] = { name: asStr(c.column_name), nullable: !asBool(c.not_null) };
    if (asBool(c.not_null_unvalidated)) col.notNullUnvalidated = true;
    // Domain types can carry their own NOT NULL; not evaluated in v0.1 (inspection IR-013).
    if (asBool(c.is_domain) && !asBool(c.not_null)) col.domainType = true;
    t.columns.push(col);
  }
  const idxByOid = new Map<string, Row>();
  for (const i of idxRows) idxByOid.set(asStr(i.index_oid), i);
  const constraintIndexOids = new Set<string>();

  for (const c of conRows) {
    const t = tables.get(key(asStr(c.schema_name), asStr(c.rel_name)));
    if (!t) continue;
    const contype = asStr(c.contype);
    const name = asStr(c.con_name);
    const columns = asStrArr(c.columns);
    const hasExprPart = columns.length === 0 || columns.some((x) => x === "");
    if (contype === "p" || contype === "u") {
      const idxOid = asStr(c.index_oid);
      constraintIndexOids.add(idxOid);
      const idx = idxByOid.get(idxOid);
      const idxCols = idx ? asStrArr(idx.columns) : [];
      const nkey = idx ? Number(idx.indnkeyatts) : columns.length;
      const k: DbUniqueKey = {
        kind: contype === "p" ? "primary_key" : "unique_constraint",
        name,
        columns: hasExprPart || !idx ? null : columns,
        includeColumns: idx ? idxCols.slice(nkey).filter((x) => x !== "") : [],
        partial: idx ? asBool(idx.is_partial) : false,
        expression: hasExprPart,
        valid: idx ? asBool(idx.indisvalid) && asBool(idx.indisready) && asBool(idx.indislive) : false,
        deferrable: asBool(c.condeferrable),
        immediate: idx ? asBool(idx.indimmediate) : !asBool(c.condeferrable),
        nullsNotDistinct: idx ? asBool(idx.nulls_not_distinct) : false,
        period: asBool(c.conperiod),
      };
      if (!idx) gaps.push({ scope: t.schema, reason: `backing index of constraint ${name} on ${t.schema}.${t.name} was not returned` });
      t.uniqueKeys.push(k);
    } else if (contype === "x") {
      t.uniqueKeys.push({
        kind: "exclusion_constraint",
        name,
        columns: hasExprPart ? null : columns,
        includeColumns: [],
        partial: false,
        expression: hasExprPart,
        valid: true,
        deferrable: asBool(c.condeferrable),
        immediate: !asBool(c.condeferrable),
        nullsNotDistinct: false,
        period: asBool(c.conperiod),
      });
    } else if (contype === "f") {
      const refCols = asStrArr(c.ref_columns);
      if (hasExprPart || refCols.length !== columns.length || refCols.some((x) => x === "") || c.ref_schema == null || c.ref_table == null) {
        gaps.push({ scope: t.schema, reason: `foreign key ${name} on ${t.schema}.${t.name} has a catalog shape v0.1 does not understand` });
        continue;
      }
      const fk: DbForeignKey = {
        name,
        columns,
        references: { schema: asStr(c.ref_schema), table: asStr(c.ref_table), columns: refCols },
        deferrable: asBool(c.condeferrable),
        validated: asBool(c.convalidated),
        enforced: c.conenforced === undefined ? true : asBool(c.conenforced),
      };
      if (asBool(c.conperiod)) fk.period = true;
      t.foreignKeys.push(fk);
    }
  }
  for (const i of idxRows) {
    if (constraintIndexOids.has(asStr(i.index_oid))) continue;
    const t = tables.get(key(asStr(i.schema_name), asStr(i.rel_name)));
    if (!t) continue;
    const all = asStrArr(i.columns);
    const nkey = Number(i.indnkeyatts);
    const keyCols = all.slice(0, nkey);
    const expr = asBool(i.has_expressions) || keyCols.some((x) => x === "");
    t.uniqueKeys.push({
      kind: "unique_index",
      name: asStr(i.index_name),
      columns: expr ? null : keyCols,
      includeColumns: all.slice(nkey).filter((x) => x !== ""),
      partial: asBool(i.is_partial),
      expression: expr,
      valid: asBool(i.indisvalid) && asBool(i.indisready) && asBool(i.indislive),
      deferrable: !asBool(i.indimmediate),
      immediate: asBool(i.indimmediate),
      nullsNotDistinct: asBool(i.nulls_not_distinct),
      period: false,
    });
  }
  const sortedTables = [...tables.values()]
    .map((t) => ({
      ...t,
      uniqueKeys: t.uniqueKeys.sort((a, b) => compareStrings(a.name, b.name)),
      foreignKeys: t.foreignKeys.sort((a, b) => compareStrings(a.name, b.name)),
    }))
    .sort((a, b) => compareStrings(`${a.schema}\u0000${a.name}`, `${b.schema}\u0000${b.name}`));
  others.sort((a, b) => compareStrings(`${a.schema}\u0000${a.name}`, `${b.schema}\u0000${b.name}`));
  return { tables: sortedTables, others, gaps };
}
