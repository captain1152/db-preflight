// Versioned snapshot contract (snapshotVersion 1). Snapshots are untrusted input: every field
// that is used is type-checked and copied; unknown fields are ignored and never echoed.

import { readFileSync, statSync } from "node:fs";
import { DbpError } from "../core/errors.ts";
import type {
  CollectionGap,
  DatabaseModel,
  DbColumn,
  DbForeignKey,
  DbInheritance,
  DbOtherRelation,
  DbTable,
  DbUniqueKey,
  DbUniqueKind,
} from "../core/types.ts";
import { SNAPSHOT_VERSION, TOOL_VERSION } from "../core/version.ts";
import { compareStrings } from "../prisma/discover.ts";

export const SNAPSHOT_LIMITS = {
  maxBytes: 64 * 1024 * 1024,
  maxIdentifierLength: 512,
  maxTables: 100_000,
  maxColumnsPerTable: 5_000,
  maxKeysPerTable: 5_000,
} as const;

export interface SnapshotFile {
  snapshotVersion: 1;
  generator: { name: "db-preflight"; version: string };
  origin: "live" | "synthetic";
  collectedAt: string;
  server: { version: string | null; versionNum: number | null };
  requestedSchemas: string[];
  schemasFound: string[];
  complete: boolean;
  gaps: CollectionGap[];
  readOnly: { verified: boolean; detail: string };
  tables: DbTable[];
  otherRelations: DbOtherRelation[];
}

class SnapshotInvalid extends DbpError {
  constructor(path: string, message: string) {
    super("SNAPSHOT_INVALID", `invalid snapshot at ${path}: ${message}`);
  }
}

type Json = unknown;

function obj(v: Json, path: string): Record<string, Json> {
  if (typeof v !== "object" || v === null || Array.isArray(v)) throw new SnapshotInvalid(path, "expected an object");
  return v as Record<string, Json>;
}
function arr(v: Json, path: string, max: number): Json[] {
  if (!Array.isArray(v)) throw new SnapshotInvalid(path, "expected an array");
  if (v.length > max) throw new SnapshotInvalid(path, `more than ${max} entries`);
  return v;
}
function str(v: Json, path: string, max: number = SNAPSHOT_LIMITS.maxIdentifierLength): string {
  if (typeof v !== "string") throw new SnapshotInvalid(path, "expected a string");
  if (v.length === 0 || v.length > max) throw new SnapshotInvalid(path, `string length must be 1..${max}`);
  return v;
}
function bool(v: Json, path: string): boolean {
  if (typeof v !== "boolean") throw new SnapshotInvalid(path, "expected a boolean");
  return v;
}
function strList(v: Json, path: string, max: number): string[] {
  return arr(v, path, max).map((x, i) => str(x, `${path}[${i}]`));
}
function oneOf<T extends string>(v: Json, path: string, allowed: readonly T[]): T {
  if (typeof v !== "string" || !(allowed as readonly string[]).includes(v)) {
    throw new SnapshotInvalid(path, `expected one of ${allowed.join(", ")}`);
  }
  return v as T;
}

const UNIQUE_KINDS: readonly DbUniqueKind[] = ["primary_key", "unique_constraint", "unique_index", "exclusion_constraint"];

function readUniqueKey(v: Json, p: string): DbUniqueKey {
  const o = obj(v, p);
  const columns = o.columns === null ? null : strList(o.columns, `${p}.columns`, 1000);
  return {
    kind: oneOf(o.kind, `${p}.kind`, UNIQUE_KINDS),
    name: str(o.name, `${p}.name`),
    columns,
    includeColumns: strList(o.includeColumns ?? [], `${p}.includeColumns`, 1000),
    partial: bool(o.partial, `${p}.partial`),
    expression: bool(o.expression, `${p}.expression`),
    valid: bool(o.valid, `${p}.valid`),
    deferrable: bool(o.deferrable, `${p}.deferrable`),
    immediate: bool(o.immediate, `${p}.immediate`),
    nullsNotDistinct: bool(o.nullsNotDistinct ?? false, `${p}.nullsNotDistinct`),
    period: bool(o.period ?? false, `${p}.period`),
  };
}

function readForeignKey(v: Json, p: string): DbForeignKey {
  const o = obj(v, p);
  const ref = obj(o.references, `${p}.references`);
  const fk: DbForeignKey = {
    name: str(o.name, `${p}.name`),
    columns: strList(o.columns, `${p}.columns`, 1000),
    references: {
      schema: str(ref.schema, `${p}.references.schema`),
      table: str(ref.table, `${p}.references.table`),
      columns: strList(ref.columns, `${p}.references.columns`, 1000),
    },
    deferrable: bool(o.deferrable, `${p}.deferrable`),
    validated: bool(o.validated, `${p}.validated`),
    enforced: bool(o.enforced ?? true, `${p}.enforced`),
  };
  if (o.period !== undefined) fk.period = bool(o.period, `${p}.period`);
  if (new Set(fk.columns).size !== fk.columns.length || new Set(fk.references.columns).size !== fk.references.columns.length) {
    throw new SnapshotInvalid(p, "foreign key column lists must not repeat a column");
  }
  if (fk.columns.length === 0 || fk.columns.length !== fk.references.columns.length) {
    throw new SnapshotInvalid(p, "foreign key columns and referenced columns must be non-empty and equally long");
  }
  return fk;
}

function readInheritance(v: Json, p: string): DbInheritance {
  const o = obj(v, p);
  return {
    isPartition: bool(o.isPartition, `${p}.isPartition`),
    hasInheritanceChildren: bool(o.hasInheritanceChildren, `${p}.hasInheritanceChildren`),
    inheritsFrom: arr(o.inheritsFrom, `${p}.inheritsFrom`, 1000).map((x, i) => {
      const r = obj(x, `${p}.inheritsFrom[${i}]`);
      return { schema: str(r.schema, `${p}.inheritsFrom[${i}].schema`), table: str(r.table, `${p}.inheritsFrom[${i}].table`) };
    }),
  };
}

function readTable(v: Json, p: string, requested: Set<string>): DbTable {
  const o = obj(v, p);
  const schema = str(o.schema, `${p}.schema`);
  if (!requested.has(schema)) throw new SnapshotInvalid(`${p}.schema`, "table belongs to a schema outside requestedSchemas");
  const columns: DbColumn[] = arr(o.columns, `${p}.columns`, SNAPSHOT_LIMITS.maxColumnsPerTable).map((c, i) => {
    const co = obj(c, `${p}.columns[${i}]`);
    const col: DbColumn = { name: str(co.name, `${p}.columns[${i}].name`), nullable: bool(co.nullable, `${p}.columns[${i}].nullable`) };
    if (co.domainType !== undefined) col.domainType = bool(co.domainType, `${p}.columns[${i}].domainType`);
    if (co.notNullUnvalidated !== undefined) col.notNullUnvalidated = bool(co.notNullUnvalidated, `${p}.columns[${i}].notNullUnvalidated`);
    return col;
  });
  const seen = new Set<string>();
  for (const c of columns) {
    if (seen.has(c.name)) throw new SnapshotInvalid(`${p}.columns`, "duplicate column name");
    seen.add(c.name);
  }
  return {
    schema,
    name: str(o.name, `${p}.name`),
    kind: oneOf(o.kind, `${p}.kind`, ["table", "partitioned_table"] as const),
    inheritance: readInheritance(o.inheritance, `${p}.inheritance`),
    columns,
    uniqueKeys: arr(o.uniqueKeys, `${p}.uniqueKeys`, SNAPSHOT_LIMITS.maxKeysPerTable).map((k, i) => readUniqueKey(k, `${p}.uniqueKeys[${i}]`)),
    foreignKeys: arr(o.foreignKeys, `${p}.foreignKeys`, SNAPSHOT_LIMITS.maxKeysPerTable).map((k, i) => readForeignKey(k, `${p}.foreignKeys[${i}]`)),
  };
}

/** Validate parsed JSON and return the normalized model (origin is set by the caller). */
export function parseSnapshot(raw: Json): SnapshotFile {
  const o = obj(raw, "$");
  if (o.snapshotVersion !== SNAPSHOT_VERSION) {
    throw new DbpError("SNAPSHOT_UNSUPPORTED_VERSION", `unsupported snapshotVersion (expected ${SNAPSHOT_VERSION}); this tool does not guess other versions`);
  }
  const gen = obj(o.generator, "$.generator");
  if (gen.name !== "db-preflight") throw new SnapshotInvalid("$.generator.name", 'expected "db-preflight"');
  const collectedAt = str(o.collectedAt, "$.collectedAt", 64);
  if (Number.isNaN(Date.parse(collectedAt))) throw new SnapshotInvalid("$.collectedAt", "expected an ISO 8601 timestamp");
  const server = obj(o.server, "$.server");
  const versionNum = server.versionNum;
  if (versionNum !== null && (typeof versionNum !== "number" || !Number.isInteger(versionNum) || versionNum < 0)) {
    throw new SnapshotInvalid("$.server.versionNum", "expected an integer or null");
  }
  const requestedSchemas = strList(o.requestedSchemas, "$.requestedSchemas", 1000);
  if (requestedSchemas.length === 0) throw new SnapshotInvalid("$.requestedSchemas", "must not be empty");
  const requested = new Set(requestedSchemas);
  const schemasFound = strList(o.schemasFound, "$.schemasFound", 1000);
  for (const s of schemasFound) if (!requested.has(s)) throw new SnapshotInvalid("$.schemasFound", "contains a schema that was not requested");
  const tables = arr(o.tables, "$.tables", SNAPSHOT_LIMITS.maxTables).map((t, i) => readTable(t, `$.tables[${i}]`, requested));
  const keys = new Set<string>();
  for (const t of tables) {
    const k = JSON.stringify([t.schema, t.name]);
    if (keys.has(k)) throw new SnapshotInvalid("$.tables", "duplicate schema/table entry");
    keys.add(k);
  }
  const otherRelations = arr(o.otherRelations ?? [], "$.otherRelations", SNAPSHOT_LIMITS.maxTables).map((r, i) => {
    const ro = obj(r, `$.otherRelations[${i}]`);
    const schema = str(ro.schema, `$.otherRelations[${i}].schema`);
    if (!requested.has(schema)) throw new SnapshotInvalid(`$.otherRelations[${i}].schema`, "outside requestedSchemas");
    return {
      schema,
      name: str(ro.name, `$.otherRelations[${i}].name`),
      kind: oneOf(ro.kind, `$.otherRelations[${i}].kind`, ["view", "materialized_view", "foreign_table"] as const),
    };
  });
  const gaps = arr(o.gaps ?? [], "$.gaps", 10_000).map((g, i) => {
    const go = obj(g, `$.gaps[${i}]`);
    return { scope: str(go.scope, `$.gaps[${i}].scope`), reason: str(go.reason, `$.gaps[${i}].reason`, 2000) };
  });
  if (o.complete === true && gaps.length > 0) {
    // Contradictory evidence is rejected rather than trusted (inspection IR-006).
    throw new SnapshotInvalid("$.complete", "complete is true but gaps are recorded");
  }
  const ro = obj(o.readOnly ?? { verified: false, detail: "not recorded" }, "$.readOnly");
  return {
    snapshotVersion: 1,
    generator: { name: "db-preflight", version: str(gen.version, "$.generator.version", 64) },
    origin: oneOf(o.origin, "$.origin", ["live", "synthetic"] as const),
    collectedAt,
    server: {
      version: server.version === null ? null : str(server.version, "$.server.version", 128),
      versionNum: versionNum as number | null,
    },
    requestedSchemas,
    schemasFound,
    complete: bool(o.complete, "$.complete"),
    gaps,
    readOnly: { verified: bool(ro.verified, "$.readOnly.verified"), detail: str(ro.detail, "$.readOnly.detail", 2000) },
    tables,
    otherRelations,
  };
}

export function loadSnapshotFile(path: string): SnapshotFile {
  let size: number;
  try {
    size = statSync(path).size;
  } catch {
    throw new DbpError("SNAPSHOT_NOT_FOUND", "--snapshot file does not exist or is not readable");
  }
  if (size > SNAPSHOT_LIMITS.maxBytes) throw new DbpError("SNAPSHOT_TOO_LARGE", `--snapshot exceeds ${SNAPSHOT_LIMITS.maxBytes} bytes`);
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    throw new DbpError("SNAPSHOT_NOT_JSON", "--snapshot is not valid JSON");
  }
  return parseSnapshot(parsed);
}

export function snapshotToDatabaseModel(s: SnapshotFile, origin: "snapshot" | "demo"): DatabaseModel {
  return {
    origin,
    snapshotOrigin: s.origin,
    collectedAt: s.collectedAt,
    server: s.server,
    requestedSchemas: s.requestedSchemas,
    schemasFound: s.schemasFound,
    complete: s.complete,
    gaps: s.gaps,
    tables: s.tables,
    otherRelations: s.otherRelations,
    readOnly: s.readOnly,
  };
}

/** Restrict a model to a subset of its requested schemas (never widens scope). */
export function restrictScope(db: DatabaseModel, schemas: string[]): DatabaseModel {
  const missing = schemas.filter((s) => !db.requestedSchemas.includes(s));
  if (missing.length > 0) {
    throw new DbpError("SCOPE_NOT_IN_SNAPSHOT", `--schemas includes schemas that the snapshot did not collect: ${missing.join(", ")}`);
  }
  const keep = new Set(schemas);
  const keptGaps = db.gaps.filter((g) => g.scope === "*" || keep.has(g.scope));
  // Incompleteness explained only by gaps in excluded schemas does not affect the retained scope;
  // unexplained incompleteness (no gaps recorded) is preserved (inspection IR-015).
  const complete = db.complete || (db.gaps.length > 0 && keptGaps.length === 0);
  return {
    ...db,
    complete,
    requestedSchemas: [...schemas].sort(compareStrings),
    schemasFound: db.schemasFound.filter((s) => keep.has(s)),
    gaps: keptGaps,
    tables: db.tables.filter((t) => keep.has(t.schema)),
    otherRelations: db.otherRelations.filter((r) => keep.has(r.schema)),
  };
}

/** Serialize a live-collected model into the snapshot contract, with deterministic ordering. */
export function databaseModelToSnapshot(db: DatabaseModel): SnapshotFile {
  const sortTables = [...db.tables].sort((a, b) => compareStrings(`${a.schema}\u0000${a.name}`, `${b.schema}\u0000${b.name}`));
  return {
    snapshotVersion: 1,
    generator: { name: "db-preflight", version: TOOL_VERSION },
    origin: db.origin === "live" ? "live" : (db.snapshotOrigin ?? "synthetic"),
    collectedAt: db.collectedAt,
    server: db.server,
    requestedSchemas: [...db.requestedSchemas].sort(compareStrings),
    schemasFound: [...db.schemasFound].sort(compareStrings),
    complete: db.complete,
    gaps: db.gaps,
    readOnly: db.readOnly,
    tables: sortTables.map((t) => ({
      ...t,
      uniqueKeys: [...t.uniqueKeys].sort((a, b) => compareStrings(a.name, b.name)),
      foreignKeys: [...t.foreignKeys].sort((a, b) => compareStrings(a.name, b.name)),
    })),
    otherRelations: [...db.otherRelations].sort((a, b) => compareStrings(`${a.schema}\u0000${a.name}`, `${b.schema}\u0000${b.name}`)),
  };
}
