// Pure rule engine: PrismaSchemaModel + DatabaseModel -> checks, findings, coverage.
// No I/O, no clock (generatedAt is added by the caller), deterministic ordering.

import { createHash } from "node:crypto";
import { compareStrings } from "../prisma/discover.ts";
import type { Check, CheckStatus, EvidenceItem, Finding, FindingGroup, ResultStatus, RuleId, Severity } from "./report-types.ts";
import { RULES } from "./rules.ts";
import type { DatabaseModel, DbTable, PrismaField, PrismaModelDef, PrismaSchemaModel, ResolvedRelation, SourceSpan, UniqueDecl } from "./types.ts";
import { evaluateUniqueness, type UniquenessResult } from "./uniqueness.ts";

export interface EngineInput {
  prisma: PrismaSchemaModel;
  db: DatabaseModel;
  /** --default-schema, used for models without @@schema. Never guessed. */
  defaultSchema: string | null;
}

export interface EngineOutput {
  checks: Check[];
  findings: Finding[];
  findingGroups: FindingGroup[];
  resultStatus: ResultStatus;
  exitCode: 0 | 1 | 3;
  blockingDiagnostics: number;
  completeWithinScope: boolean;
}

export const NOT_COVERED = [
  "Row data: table rows are never read, so existing duplicates or orphaned rows are not detected.",
  "CHECK constraints, triggers, defaults, generated columns, RLS policies and privileges.",
  "Migration safety, lock impact and production readiness.",
  "Prisma Client runtime behaviour and generated client code.",
  "Database objects outside the requested schemas.",
];

type TableResolution =
  | { status: "found"; schema: string; table: DbTable }
  | { status: "missing"; schema: string; name: string }
  | { status: "unknown"; reasonCode: string; reason: string };

function stableId(ruleId: string, subject: string): string {
  return `${ruleId}-${createHash("sha256").update(subject).digest("hex").slice(0, 10)}`;
}

function prismaEvidence(span: SourceSpan, detail: string): EvidenceItem {
  return { kind: "prisma", file: span.file, line: span.line, column: span.column, detail };
}

function plist(list: string[]): string {
  return `[${list.join(", ")}]`;
}

function cols(list: string[]): string {
  return `(${list.join(", ")})`;
}

export function runEngine(input: EngineInput): EngineOutput {
  const { prisma, db, defaultSchema } = input;
  const checks: Check[] = [];
  const findings: Finding[] = [];
  const modelsByName = new Map(prisma.models.map((m) => [m.name, m]));
  const tableIndex = new Map(db.tables.map((t) => [JSON.stringify([t.schema, t.name]), t]));
  const otherIndex = new Map(db.otherRelations.map((r) => [JSON.stringify([r.schema, r.name]), r]));

  // A collection is complete only if it says so AND reports no gaps (inspection IR-006).
  const dbComplete = db.complete && db.gaps.length === 0;
  const schemaComplete = (schema: string): boolean => {
    if (dbComplete) return true;
    if (db.gaps.length === 0) return false;
    return !db.gaps.some((g) => g.scope === schema || g.scope === "*");
  };

  const resolveTable = (m: PrismaModelDef): TableResolution => {
    const schema = m.schema ?? defaultSchema;
    if (!schema) {
      return {
        status: "unknown",
        reasonCode: "default_schema_unknown",
        reason: `model ${m.name} has no @@schema and no --default-schema was given; the database schema is not guessed`,
      };
    }
    if (!db.requestedSchemas.includes(schema)) {
      return { status: "unknown", reasonCode: "schema_out_of_scope", reason: `schema "${schema}" was not part of the inspected scope` };
    }
    const key = JSON.stringify([schema, m.dbName]);
    const table = tableIndex.get(key);
    if (table) return { status: "found", schema, table };
    const other = otherIndex.get(key);
    if (other) {
      return {
        status: "unknown",
        reasonCode: "unsupported_relation_kind",
        reason: `${schema}.${m.dbName} exists as a ${other.kind.replace("_", " ")}, which v0.1 does not evaluate`,
      };
    }
    if (!schemaComplete(schema)) {
      return { status: "unknown", reasonCode: "incomplete_collection", reason: `metadata collection for schema "${schema}" was incomplete` };
    }
    return { status: "missing", schema, name: m.dbName };
  };

  /** Common model preconditions. Returns a non-evaluable status or undefined. */
  const modelGate = (m: PrismaModelDef): { status: CheckStatus; reasonCode: string; reason: string } | undefined => {
    if (m.ignored) return { status: "not_applicable", reasonCode: "model_ignored", reason: `model ${m.name} has @@ignore` };
    if (m.blockKind === "view") return { status: "unknown", reasonCode: "view_not_supported", reason: `view ${m.name} is not evaluated by v0.1` };
    if (m.issues.length > 0) {
      return {
        status: "unknown",
        reasonCode: "prisma_model_not_fully_parsed",
        reason: `model ${m.name}: ${(m.issues[0] as { message: string }).message}${m.issues.length > 1 ? ` (+${m.issues.length - 1} more)` : ""}`,
      };
    }
    return undefined;
  };

  const addCheck = (ruleId: RuleId, subject: string, status: CheckStatus, evidence: EvidenceItem[], reasonCode?: string, reason?: string): Check => {
    const c: Check = { id: `${ruleId}:${subject}`, ruleId, subject, status, evidence, ...(reasonCode ? { reasonCode } : {}), ...(reason ? { reason } : {}) };
    checks.push(c);
    return c;
  };

  const addFinding = (
    check: Check,
    severity: Severity,
    title: string,
    groupId: string,
    explanation: Finding["explanation"],
    reviewOptions: string[],
  ): Finding => {
    const f: Finding = {
      id: stableId(check.ruleId, check.subject),
      ruleId: check.ruleId,
      severity,
      title,
      subject: check.subject,
      groupId,
      relatedFindingIds: [],
      explanation,
      evidence: check.evidence,
      reviewOptions,
    };
    check.findingId = f.id;
    findings.push(f);
    return f;
  };

  const fieldColumns = (m: PrismaModelDef, names: string[]): { ok: true; fields: PrismaField[] } | { ok: false; reason: string } => {
    const out: PrismaField[] = [];
    for (const n of names) {
      const f = m.fields.find((x) => x.name === n);
      if (!f) return { ok: false, reason: `field "${n}" does not exist on model ${m.name}` };
      if (f.kind === "relation" || f.kind === "unknown_type") return { ok: false, reason: `field "${n}" on model ${m.name} is not a scalar field` };
      if (f.issues.length > 0) return { ok: false, reason: `field "${n}" on model ${m.name}: ${(f.issues[0] as { message: string }).message}` };
      out.push(f);
    }
    return { ok: true, fields: out };
  };

  const tableEvidence = (t: DbTable, detail: string, extra?: { constraint?: string; columns?: string[] }): EvidenceItem => ({
    kind: "database",
    object: `${t.schema}.${t.name}`,
    detail,
    ...(extra?.constraint ? { constraint: extra.constraint } : {}),
    ...(extra?.columns ? { columns: extra.columns } : {}),
  });

  // Per-model table resolutions are shared by all rules.
  const resolutions = new Map<string, TableResolution>();
  for (const m of prisma.models) resolutions.set(m.name, resolveTable(m));

  // ---------------------------------------------------------------- DBP003
  const missingColumns = new Map<string, Set<string>>(); // model -> missing field names
  for (const m of prisma.models) {
    const subject = `model ${m.name}`;
    const gate = modelGate(m);
    if (gate) {
      addCheck("DBP003", subject, gate.status, [prismaEvidence(m.span, `${m.blockKind} ${m.name}`)], gate.reasonCode, gate.reason);
      continue;
    }
    const r = resolutions.get(m.name) as TableResolution;
    const ev: EvidenceItem[] = [prismaEvidence(m.span, `model ${m.name} maps to table "${m.dbName}"${m.schema ? ` in @@schema("${m.schema}")` : ""}`)];
    if (r.status === "unknown") {
      addCheck("DBP003", subject, "unknown", ev, r.reasonCode, r.reason);
      continue;
    }
    if (r.status === "missing") {
      ev.push({ kind: "database", object: `${r.schema}.${r.name}`, detail: "no table, view or foreign table with this name in the inspected schema" });
      const c = addCheck("DBP003", subject, "fail", ev, "table_missing", `table ${r.schema}.${r.name} was not found`);
      addFinding(
        c,
        "error",
        `Mapped table ${r.schema}.${r.name} for model ${m.name} was not found`,
        `model:${m.name}`,
        {
          observed: [
            `Model ${m.name} resolves to ${r.schema}.${r.name} after applying @@schema/@@map (or --default-schema).`,
            `The inspected schema "${r.schema}" contains no relation with that name.`,
          ],
          expected: "A table with the mapped name exists in the mapped schema.",
          difference: `Table ${r.schema}.${r.name} is missing from the collected metadata.`,
          impact: "Prisma queries for this model would fail against this database, and other checks for this model cannot be evaluated.",
          notChecked: ["Whether the table exists under a different name or schema; db-preflight does not search by Prisma logical names."],
        },
        [
          "Confirm which database and schema this Prisma schema targets (the scanned database or snapshot may be a different environment).",
          "If the table was renamed, review whether @@map/@@schema in the Prisma schema need to change.",
          "If the table was never created, review the migration history before applying anything.",
        ],
      );
      missingColumns.set(m.name, new Set(m.fields.map((f) => f.name)));
      continue;
    }
    const t = r.table;
    const colSet = new Set(t.columns.map((c) => c.name));
    const missing: PrismaField[] = [];
    const unevaluable: PrismaField[] = [];
    for (const f of m.fields) {
      if (f.kind === "relation" || f.ignored) continue;
      if (f.issues.length > 0) {
        unevaluable.push(f);
        continue;
      }
      if (!colSet.has(f.dbName)) missing.push(f);
    }
    ev.push(tableEvidence(t, `table found with ${t.columns.length} columns`));
    missingColumns.set(m.name, new Set(missing.map((f) => f.name)));
    if (missing.length > 0 && !schemaComplete(t.schema)) {
      // "Not collected" is not "absent" (inspection IR-005).
      addCheck("DBP003", subject, "unknown", ev, "incomplete_collection", `metadata collection for schema "${t.schema}" was incomplete`);
    } else if (missing.length > 0) {
      for (const f of missing) ev.push(prismaEvidence(f.span, `field ${f.name} maps to column "${f.dbName}", which is absent`));
      const c = addCheck("DBP003", subject, "fail", ev, "column_missing", `${missing.length} mapped column(s) missing`);
      addFinding(
        c,
        "error",
        `Model ${m.name}: ${missing.length} mapped column(s) missing in ${t.schema}.${t.name}`,
        `model:${m.name}`,
        {
          observed: missing.map((f) => `Field ${f.name} maps to column "${f.dbName}" (after @map), which ${t.schema}.${t.name} does not have.`),
          expected: "Every non-relation field maps to an existing column of the mapped table.",
          difference: `Missing column(s): ${missing.map((f) => f.dbName).join(", ")}.`,
          impact: "Prisma queries selecting these fields would fail against this database.",
          notChecked: ["Column types and defaults are not compared in v0.1."],
        },
        [
          "Check whether the column was renamed in the database and @map needs to reflect it.",
          "Check whether the field was added to Prisma without a corresponding reviewed migration.",
        ],
      );
    } else if (unevaluable.length > 0) {
      addCheck("DBP003", subject, "unknown", ev, "prisma_field_not_evaluable", `fields not evaluable: ${unevaluable.map((f) => f.name).join(", ")}`);
    } else {
      addCheck("DBP003", subject, "pass", ev);
    }
  }

  // ---------------------------------------------------------------- DBP006
  for (const m of prisma.models) {
    const gate = modelGate(m);
    const r = resolutions.get(m.name) as TableResolution;
    for (const f of m.fields) {
      if (f.kind === "relation") continue;
      const subject = `field ${m.name}.${f.name}`;
      const ev: EvidenceItem[] = [prismaEvidence(f.span, `${f.name} ${f.typeName}${f.isList ? "[]" : ""}${f.isOptional ? "?" : ""} -> column "${f.dbName}"`)];
      if (gate) {
        addCheck("DBP006", subject, gate.status, ev, gate.reasonCode, gate.reason);
        continue;
      }
      if (f.ignored) {
        addCheck("DBP006", subject, "not_applicable", ev, "field_ignored", "field has @ignore");
        continue;
      }
      if (f.isList) {
        addCheck("DBP006", subject, "not_applicable", ev, "scalar_list", "scalar lists are not compared for nullability in v0.1");
        continue;
      }
      if (f.issues.length > 0) {
        addCheck("DBP006", subject, "unknown", ev, "prisma_field_not_evaluable", (f.issues[0] as { message: string }).message);
        continue;
      }
      if (r.status === "unknown") {
        addCheck("DBP006", subject, "unknown", ev, r.reasonCode, r.reason);
        continue;
      }
      if (r.status === "missing" || missingColumns.get(m.name)?.has(f.name)) {
        addCheck("DBP006", subject, "unknown", ev, "blocked_by_DBP003", "the mapped table or column is missing (see DBP003)");
        continue;
      }
      const t = r.table;
      if (t.inheritance.hasInheritanceChildren) {
        addCheck("DBP006", subject, "unknown", ev, "ordinary_inheritance", "rows of ordinary (INHERITS) child tables may have different nullability");
        continue;
      }
      const col = t.columns.find((c) => c.name === f.dbName);
      if (!col) {
        addCheck("DBP006", subject, "unknown", ev, "blocked_by_DBP003", "column not found");
        continue;
      }
      ev.push(tableEvidence(t, `column "${col.name}" is ${col.nullable ? "NULLABLE" : "NOT NULL"}`, { columns: [col.name] }));
      if (col.domainType && col.nullable) {
        addCheck(
          "DBP006",
          subject,
          "unknown",
          ev,
          "domain_nullability_not_evaluated",
          "the column uses a domain type whose own NOT NULL is not evaluated by v0.1",
        );
        continue;
      }
      if (col.notNullUnvalidated) {
        addCheck("DBP006", subject, "unknown", ev, "not_null_not_validated", "the NOT NULL constraint is NOT VALID, so existing rows may contain NULL");
        continue;
      }
      const prismaNullable = f.isOptional;
      if (prismaNullable === col.nullable) {
        addCheck("DBP006", subject, "pass", ev);
        continue;
      }
      const required = !prismaNullable;
      const c = addCheck("DBP006", subject, "fail", ev, required ? "required_but_nullable" : "optional_but_not_null");
      addFinding(
        c,
        required ? "error" : "warning",
        required
          ? `${m.name}.${f.name} is required in Prisma but ${t.schema}.${t.name}.${col.name} is nullable`
          : `${m.name}.${f.name} is optional in Prisma but ${t.schema}.${t.name}.${col.name} is NOT NULL`,
        `model:${m.name}`,
        {
          observed: [
            `Prisma declares ${f.name} as ${required ? "required (no ?)" : "optional (?)"}.`,
            `Column ${t.schema}.${t.name}.${col.name} is ${col.nullable ? "nullable" : "NOT NULL"}.`,
          ],
          expected: "Scalar field optionality matches column nullability.",
          difference: required
            ? "The database allows NULL where Prisma assumes a value is always present."
            : "Prisma allows writing NULL where the database rejects it.",
          impact: required
            ? "Reading a row whose column is NULL can fail or produce unexpected types in Prisma Client."
            : "Prisma Client accepts null for this field, but the database would reject such writes.",
          notChecked: ["Whether NULL values currently exist (rows are not read)."],
        },
        required
          ? [
              "If NULL is a valid business value, consider making the Prisma field optional.",
              "If the column must always have a value, check existing rows for NULLs before any NOT NULL migration is reviewed.",
            ]
          : [
              "If NULL is never valid, consider making the Prisma field required.",
              "If NULL should be allowed, review whether the NOT NULL constraint is intentional.",
            ],
      );
    }
  }

  // ---------------------------------------------------------------- DBP002
  const dbp002BySubject = new Map<string, Check>();
  for (const m of prisma.models) {
    const gate = modelGate(m);
    const r = resolutions.get(m.name) as TableResolution;
    for (const u of m.uniques) {
      const subject = `${u.kind === "id" ? "id" : "unique"} ${m.name}(${u.fields.join(", ")})`;
      const ev: EvidenceItem[] = [prismaEvidence(u.span, `${u.origin === "field" ? `@${u.kind}` : `@@${u.kind}`} on ${plist(u.fields)}`)];
      const done = (c: Check) => dbp002BySubject.set(`${m.name}|${u.fields.join(",")}`, c);
      if (gate) {
        done(addCheck("DBP002", subject, gate.status, ev, gate.reasonCode, gate.reason));
        continue;
      }
      if (!u.supported) {
        done(addCheck("DBP002", subject, "unknown", ev, "prisma_unique_not_evaluable", u.unsupportedReason ?? "unsupported declaration"));
        continue;
      }
      const fc = fieldColumns(m, u.fields);
      if (!fc.ok) {
        done(addCheck("DBP002", subject, "unknown", ev, "prisma_field_not_evaluable", fc.reason));
        continue;
      }
      if (r.status === "unknown") {
        done(addCheck("DBP002", subject, "unknown", ev, r.reasonCode, r.reason));
        continue;
      }
      if (r.status === "missing" || fc.fields.some((f) => missingColumns.get(m.name)?.has(f.name))) {
        done(addCheck("DBP002", subject, "unknown", ev, "blocked_by_DBP003", "the mapped table or column is missing (see DBP003)"));
        continue;
      }
      const columns = fc.fields.map((f) => f.dbName);
      const res = evaluateUniqueness(r.table, columns, schemaComplete(r.schema));
      done(uniquenessCheck("DBP002", subject, ev, r.table, columns, res, m, u));
    }
  }

  function uniquenessCheck(
    ruleId: "DBP002" | "DBP005",
    subject: string,
    ev: EvidenceItem[],
    t: DbTable,
    columns: string[],
    res: UniquenessResult,
    m: PrismaModelDef,
    u?: UniqueDecl,
  ): Check {
    if (res.status === "guaranteed" && res.key) {
      ev.push(
        tableEvidence(t, `${res.key.kind.replace("_", " ")} ${res.key.name} on ${cols(res.key.columns ?? [])} guarantees uniqueness of ${cols(columns)}`, {
          constraint: res.key.name,
          columns: res.key.columns ?? [],
        }),
      );
      const nullable = columns.filter((c) => t.columns.find((x) => x.name === c)?.nullable);
      if (nullable.length > 0) {
        ev.push({ kind: "note", detail: `nullable column(s) ${nullable.join(", ")}: uniqueness applies to rows where these are non-null` });
      }
      return addCheck(ruleId, subject, "pass", ev);
    }
    for (const k of res.uncertainKeys) {
      ev.push(tableEvidence(t, `${k.kind.replace("_", " ")} ${k.name} not evaluated`, { constraint: k.name, ...(k.columns ? { columns: k.columns } : {}) }));
    }
    if (res.status === "unknown") return addCheck(ruleId, subject, "unknown", ev, res.reasonCode, res.reason);
    const others = t.uniqueKeys.filter((k) => k.columns && k.columns.length > 0).map((k) => `${k.name} ${cols(k.columns ?? [])}`);
    ev.push(
      tableEvidence(
        t,
        `no primary key, unique constraint or valid unique index on a subset of ${cols(columns)}${others.length ? `; existing keys: ${others.join("; ")}` : ""}`,
        {
          columns,
        },
      ),
    );
    const c = addCheck(ruleId, subject, "fail", ev, "uniqueness_not_guaranteed");
    if (ruleId === "DBP002") {
      addFinding(
        c,
        "error",
        `Prisma ${u?.kind === "id" ? "id" : "unique"} on ${m.name}(${u?.fields.join(", ")}) is not guaranteed by ${t.schema}.${t.name}`,
        `model:${m.name}`,
        {
          observed: [
            `Prisma declares ${u?.origin === "field" ? `@${u?.kind}` : `@@${u?.kind}`} on ${cols(u?.fields ?? [])} -> columns ${cols(columns)}.`,
            `${t.schema}.${t.name} has no primary key, unique constraint or valid unique index whose key columns are a subset of ${cols(columns)}.`,
          ],
          expected: "Each Prisma uniqueness declaration is backed by a database key on the same columns or a subset of them.",
          difference: `The database structure allows duplicate values of ${cols(columns)}.`,
          impact: "Prisma Client treats this combination as unique (findUnique, upsert, 1:1 relations) while the database does not enforce it.",
          notChecked: ["Whether duplicate values currently exist (rows are not read)."],
        },
        [
          "If the combination is meant to be unique, check existing rows for duplicates before reviewing a migration that adds a constraint.",
          "If duplicates are legitimate, review whether the Prisma declaration should be removed or changed.",
        ],
      );
    }
    return c;
  }

  // ---------------------------------------------------------------- relation rules
  const relMode = prisma.datasource?.relationMode;
  for (const rel of prisma.relations) {
    const subject = `relation ${rel.id}`;
    const ownerModel = rel.owner ? modelsByName.get(rel.owner.model) : undefined;
    const targetModel = rel.referencedModel ? modelsByName.get(rel.referencedModel) : undefined;
    const relEv: EvidenceItem[] = rel.owner
      ? [
          prismaEvidence(
            rel.owner.span,
            `${rel.owner.model}.${rel.owner.field} @relation(fields: ${plist(rel.owner.fields)}, references: ${plist(rel.owner.references)})`,
          ),
        ]
      : rel.ends.map((e) => prismaEvidence(e.span, `${e.model}.${e.field}`));
    if (rel.other)
      relEv.push(prismaEvidence(rel.other.span, `${rel.other.model}.${rel.other.field} is ${rel.other.isList ? "a list (1:n)" : "not a list (1:1)"}`));

    // Unsupported syntax on either relation field (e.g. unknown @relation arguments) makes every
    // relation check unknown; it must never be evaluated as if the syntax were absent.
    const endIssue = rel.ends.map((e) => modelsByName.get(e.model)?.fields.find((f) => f.name === e.field)?.issues[0]).find((d) => d !== undefined);
    if (endIssue) {
      for (const ruleId of ["DBP001", "DBP004", "DBP005"] as const) {
        addCheck(ruleId, subject, "unknown", [...relEv], "prisma_field_not_evaluable", endIssue.message);
      }
      continue;
    }

    // ---- DBP001
    if (rel.kind === "implicit_many_to_many") {
      addCheck("DBP001", subject, "not_applicable", relEv, "implicit_many_to_many", "implicit many-to-many relations have no owning scalar fields");
    } else if (rel.status === "ambiguous") {
      addCheck("DBP001", subject, "unknown", relEv, "relation_ambiguous", rel.reason ?? "relation could not be resolved");
    } else if (rel.kind === "one_to_many") {
      addCheck("DBP001", subject, "not_applicable", relEv, "not_one_to_one", "relation is 1:n");
    } else if (rel.kind === "one_to_one" && rel.owner && ownerModel) {
      const gate = modelGate(ownerModel);
      if (gate) {
        addCheck("DBP001", subject, gate.status, [...relEv], gate.reasonCode, gate.reason);
      } else {
        const fields = rel.owner.fields;
        const exact = ownerModel.uniques.find((u) => u.fields.length === fields.length && u.fields.every((f, i) => f === fields[i]));
        const ev = [...relEv];
        if (exact?.supported) {
          ev.push(
            prismaEvidence(
              exact.span,
              `${exact.origin === "field" ? `@${exact.kind}` : `@@${exact.kind}`} on ${cols(exact.fields)} matches the relation fields`,
            ),
          );
          addCheck("DBP001", subject, "pass", ev);
        } else if (exact && !exact.supported) {
          ev.push(prismaEvidence(exact.span, `declaration not evaluated: ${exact.unsupportedReason ?? ""}`));
          addCheck("DBP001", subject, "unknown", ev, "prisma_unique_not_evaluable", exact.unsupportedReason);
        } else {
          const near = ownerModel.uniques.filter((u) => u.fields.some((f) => fields.includes(f)));
          for (const u of near)
            ev.push(
              prismaEvidence(
                u.span,
                `${u.origin === "field" ? `@${u.kind}` : `@@${u.kind}`} on ${cols(u.fields)} does not equal ${cols(fields)} in the same order`,
              ),
            );
          const c = addCheck("DBP001", subject, "fail", ev, "one_to_one_without_unique_declaration");
          addFinding(
            c,
            "error",
            `1:1 relation ${rel.id} has no Prisma uniqueness declaration on ${cols(fields)}`,
            `relation:${rel.id}`,
            {
              observed: [
                `${rel.owner.model}.${rel.owner.field} declares @relation(fields: ${plist(fields)}).`,
                `The opposite field ${rel.other?.model}.${rel.other?.field} is not a list, so the relation is declared 1:1.`,
                near.length
                  ? `Existing declarations on ${rel.owner.model} (${near.map((u) => cols(u.fields)).join(", ")}) do not match the relation fields exactly.`
                  : `${rel.owner.model} has no @unique/@@unique/@id/@@id on ${cols(fields)}.`,
              ],
              expected:
                fields.length === 1
                  ? `Prisma ORM 7 requires @unique or @id on ${fields[0]} for the defining side of a 1:1 relation.`
                  : `Prisma ORM 7 requires @@unique or @@id with exactly ${cols(fields)} (same fields, same order) on the defining side of a 1:1 relation.`,
              difference: "The 1:1 relation has no matching uniqueness declaration; prisma validate rejects this schema (P1012).",
              impact: "prisma generate / migrate cannot run on this schema; the intended cardinality (1:1 vs 1:n) is unresolved.",
              notChecked: ["Which cardinality is correct for the business domain is not decided by db-preflight."],
            },
            [
              `If one ${rel.referencedModel} can have several ${rel.owner.model} rows, consider declaring the back-relation as a list (${rel.other?.field} ${rel.owner.model}[]), i.e. 1:n.`,
              "If 1:1 is intended, first confirm the database does not already contain duplicates for these columns, then review adding a matching uniqueness declaration together with a database constraint in a reviewed migration.",
              "Do not add a uniqueness declaration only to silence P1012; see DBP005 for what the database actually enforces.",
            ],
          );
        }
      }
    } else {
      addCheck("DBP001", subject, "unknown", relEv, "relation_ambiguous", rel.reason ?? "relation could not be resolved");
    }

    // ---- DBP004
    if (rel.kind === "implicit_many_to_many") {
      addCheck("DBP004", subject, "unknown", relEv, "implicit_many_to_many_not_supported", "implicit many-to-many join tables are not checked by v0.1");
    } else if (!rel.owner || !ownerModel || !targetModel || rel.owner.fields.length === 0 || rel.owner.fields.length !== rel.owner.references.length) {
      addCheck("DBP004", subject, "unknown", relEv, "relation_ambiguous", rel.reason ?? "owning side or referenced model could not be resolved");
    } else if (!prisma.datasource || prisma.datasource.relationModeSource === "unknown" || !relMode) {
      addCheck("DBP004", subject, "unknown", relEv, "relation_mode_unknown", "relationMode could not be determined from the scanned files");
    } else if (relMode === "prisma") {
      addCheck(
        "DBP004",
        subject,
        "not_applicable",
        relEv,
        "relation_mode_prisma",
        'relationMode = "prisma": foreign keys are emulated, physical FK absence is expected',
      );
    } else {
      dbp004(rel, subject, relEv, ownerModel, targetModel);
    }

    // ---- DBP005
    if (rel.kind !== "one_to_one") {
      if (rel.status === "ambiguous") addCheck("DBP005", subject, "unknown", relEv, "relation_ambiguous", rel.reason ?? "relation could not be resolved");
      else addCheck("DBP005", subject, "not_applicable", relEv, rel.kind === "one_to_many" ? "not_one_to_one" : "implicit_many_to_many", "relation is not 1:1");
    } else if (rel.owner && ownerModel) {
      const gate = modelGate(ownerModel);
      const r = resolutions.get(ownerModel.name) as TableResolution;
      const fc = fieldColumns(ownerModel, rel.owner.fields);
      if (gate) addCheck("DBP005", subject, gate.status, [...relEv], gate.reasonCode, gate.reason);
      else if (!fc.ok) addCheck("DBP005", subject, "unknown", [...relEv], "prisma_field_not_evaluable", fc.reason);
      else if (r.status === "unknown") addCheck("DBP005", subject, "unknown", [...relEv], r.reasonCode, r.reason);
      else if (r.status === "missing" || fc.fields.some((f) => missingColumns.get(ownerModel.name)?.has(f.name)))
        addCheck("DBP005", subject, "unknown", [...relEv], "blocked_by_DBP003", "the mapped table or column is missing (see DBP003)");
      else {
        const columns = fc.fields.map((f) => f.dbName);
        const res = evaluateUniqueness(r.table, columns, schemaComplete(r.schema));
        const c = uniquenessCheck("DBP005", subject, [...relEv], r.table, columns, res, ownerModel);
        if (c.status === "fail") {
          const t = r.table;
          const fk = t.foreignKeys.find((k) => k.columns.length === columns.length && k.columns.every((x) => columns.includes(x)));
          addFinding(
            c,
            "error",
            `1:1 relation ${rel.id}: ${t.schema}.${t.name}${cols(columns)} is not unique in the database`,
            `relation:${rel.id}`,
            {
              observed: [
                `Prisma declares ${rel.id} as 1:1 (opposite field ${rel.other?.model}.${rel.other?.field} is not a list).`,
                `${t.schema}.${t.name} has no primary key, unique constraint or valid unique index on ${cols(columns)} or any subset of it.`,
                ...(fk
                  ? [
                      `Foreign key ${fk.name} ${cols(fk.columns)} -> ${fk.references.schema}.${fk.references.table}${cols(fk.references.columns)} exists; a foreign key alone does not make the referencing columns unique.`,
                    ]
                  : []),
              ],
              expected: "For a 1:1 relation, the referencing columns are unique in the database (a key on these columns or a subset).",
              difference: `The database structure allows several ${t.name} rows to reference the same ${rel.referencedModel} row.`,
              impact: "The structure permits duplicates that Prisma's 1:1 API cannot represent. This does not mean duplicates currently exist.",
              notChecked: ["Whether duplicate references currently exist (rows are not read).", "Whether 1:1 or 1:n is the intended business rule."],
            },
            [
              `If the business rule is 1:n, review changing the Prisma back-relation to a list; no database change is implied.`,
              "If the business rule is 1:1, a person should first query for existing duplicates, then review a migration that adds a unique constraint on these columns.",
              "Adding UNIQUE is not an automatic fix: it fails if duplicates exist and changes write behaviour.",
            ],
          );
        }
      }
    } else {
      addCheck("DBP005", subject, "unknown", relEv, "relation_ambiguous", rel.reason ?? "relation could not be resolved");
    }
  }

  function dbp004(rel: ResolvedRelation, subject: string, relEv: EvidenceItem[], ownerModel: PrismaModelDef, targetModel: PrismaModelDef): void {
    const owner = rel.owner as NonNullable<ResolvedRelation["owner"]>;
    const gate = modelGate(ownerModel) ?? modelGate(targetModel);
    if (gate) {
      addCheck("DBP004", subject, gate.status === "not_applicable" ? "not_applicable" : "unknown", [...relEv], gate.reasonCode, gate.reason);
      return;
    }
    const src = fieldColumns(ownerModel, owner.fields);
    const dst = fieldColumns(targetModel, owner.references);
    if (!src.ok || !dst.ok) {
      addCheck("DBP004", subject, "unknown", [...relEv], "prisma_field_not_evaluable", !src.ok ? src.reason : (dst as { reason: string }).reason);
      return;
    }
    const r = resolutions.get(ownerModel.name) as TableResolution;
    const targetSchema = targetModel.schema ?? defaultSchema;
    if (r.status === "unknown") {
      addCheck("DBP004", subject, "unknown", [...relEv], r.reasonCode, r.reason);
      return;
    }
    if (!targetSchema) {
      addCheck(
        "DBP004",
        subject,
        "unknown",
        [...relEv],
        "default_schema_unknown",
        `referenced model ${targetModel.name} has no @@schema and no --default-schema was given`,
      );
      return;
    }
    if (r.status === "missing" || src.fields.some((f) => missingColumns.get(ownerModel.name)?.has(f.name))) {
      addCheck("DBP004", subject, "unknown", [...relEv], "blocked_by_DBP003", "the mapped table or column is missing (see DBP003)");
      return;
    }
    const t = r.table;
    if (t.inheritance.hasInheritanceChildren) {
      addCheck("DBP004", subject, "unknown", [...relEv], "ordinary_inheritance", "foreign keys are not inherited by ordinary (INHERITS) child tables");
      return;
    }
    const srcCols = src.fields.map((f) => f.dbName);
    const dstCols = dst.fields.map((f) => f.dbName);
    // Compare the complete multiset of (source, target) pairs (inspection IR-011).
    const pairKey = (src: string[], dst: string[]) =>
      src
        .map((c, i) => JSON.stringify([c, dst[i]]))
        .sort()
        .join("|");
    const expectedPairs = pairKey(srcCols, dstCols);
    const ev = [...relEv];
    const targetName = targetModel.dbName;
    const sameTarget = t.foreignKeys.filter((k) => k.references.schema === targetSchema && k.references.table === targetName);
    // Several FKs can match; any validated, enforced, non-PERIOD one proves the correspondence, so
    // constraint names or snapshot order must not decide the result (RV-005).
    const exactAll = sameTarget.filter((k) => k.columns.length === srcCols.length && pairKey(k.columns, k.references.columns) === expectedPairs);
    const exact = exactAll.find((k) => k.validated && k.enforced && !k.period) ?? exactAll[0];
    const expectedText = `${t.schema}.${t.name}${cols(srcCols)} -> ${targetSchema}.${targetName}${cols(dstCols)}`;
    if (exact) {
      ev.push(
        tableEvidence(
          t,
          `foreign key ${exact.name} ${cols(exact.columns)} -> ${exact.references.schema}.${exact.references.table}${cols(exact.references.columns)}`,
          {
            constraint: exact.name,
            columns: exact.columns,
          },
        ),
      );
      if (!exact.validated) {
        addCheck("DBP004", subject, "unknown", ev, "fk_not_validated", `foreign key ${exact.name} is NOT VALID (existing rows were not checked)`);
        return;
      }
      if (!exact.enforced) {
        addCheck("DBP004", subject, "unknown", ev, "fk_not_enforced", `foreign key ${exact.name} is NOT ENFORCED`);
        return;
      }
      if (exact.period) {
        addCheck(
          "DBP004",
          subject,
          "unknown",
          ev,
          "fk_period_not_supported",
          `foreign key ${exact.name} is a temporal (PERIOD) foreign key, whose semantics v0.1 does not evaluate`,
        );
        return;
      }
      addCheck("DBP004", subject, "pass", ev);
      return;
    }
    // A negative conclusion needs the referenced side to be resolved inside the inspected scope
    // (inspection IR-012). A matching FK found above is positive evidence and is kept.
    const tr = resolutions.get(targetModel.name) as TableResolution;
    if (tr.status !== "found") {
      addCheck(
        "DBP004",
        subject,
        "unknown",
        ev,
        "reference_not_resolved",
        tr.status === "unknown" ? `referenced model ${targetModel.name}: ${tr.reason}` : `referenced table ${tr.schema}.${tr.name} was not found (see DBP003)`,
      );
      return;
    }
    const srcSet = new Set(srcCols);
    const related = t.foreignKeys.filter((k) => (k.columns.length === srcCols.length && k.columns.every((c) => srcSet.has(c))) || sameTarget.includes(k));
    if (!schemaComplete(t.schema)) {
      addCheck("DBP004", subject, "unknown", ev, "incomplete_collection", `metadata collection for schema "${t.schema}" was incomplete`);
      return;
    }
    for (const k of related) {
      ev.push(
        tableEvidence(
          t,
          `foreign key ${k.name} ${cols(k.columns)} -> ${k.references.schema}.${k.references.table}${cols(k.references.columns)} does not match`,
          {
            constraint: k.name,
            columns: k.columns,
          },
        ),
      );
    }
    const mismatch = related.length > 0;
    const c = addCheck("DBP004", subject, "fail", ev, mismatch ? "fk_mapping_mismatch" : "fk_missing");
    addFinding(
      c,
      "error",
      mismatch ? `Foreign key for ${rel.id} has a different column mapping` : `Expected foreign key for ${rel.id} was not found`,
      `relation:${rel.id}`,
      {
        observed: [
          `Prisma relation ${rel.id} expects ${expectedText} (relationMode = foreignKeys${prisma.datasource?.relationModeSource === "default" ? ", the default" : ""}).`,
          mismatch
            ? `Related foreign key(s) exist but pair the columns differently or point elsewhere: ${related.map((k) => `${k.name} ${cols(k.columns)} -> ${k.references.schema}.${k.references.table}${cols(k.references.columns)}`).join("; ")}.`
            : `${t.schema}.${t.name} has no foreign key to ${targetSchema}.${targetName}.`,
        ],
        expected: `A foreign key with the column pairs ${srcCols.map((c, i) => `${c}->${dstCols[i]}`).join(", ")}.`,
        difference: mismatch ? "The column correspondence differs from the Prisma relation." : "No database foreign key enforces this relation.",
        impact: mismatch
          ? "Joins generated by Prisma follow a different column pairing than the database enforces."
          : "Referential integrity for this relation is not enforced by the database.",
        notChecked: ["Whether orphaned rows currently exist (rows are not read)."],
      },
      [
        'If referential integrity is intentionally handled by the application, review setting relationMode = "prisma" (this does not change the database).',
        "If a foreign key is intended, check for orphaned rows before reviewing a migration that adds it.",
        mismatch
          ? "Compare the order of fields/references in @relation with the database constraint definition."
          : "Confirm the scanned database is the environment this schema targets.",
      ],
    );
  }

  // ---------------------------------------------------------------- grouping
  checks.sort((a, b) => compareStrings(a.ruleId, b.ruleId) || compareStrings(a.subject, b.subject));
  const byId = new Map(findings.map((f) => [f.id, f]));
  // A DBP005 failure shares its root cause with DBP001 (missing Prisma declaration) or DBP002
  // (declared but not enforced) on the same relation: link them instead of double counting.
  for (const f of findings) {
    if (f.ruleId !== "DBP005") continue;
    const relId = f.groupId.slice("relation:".length);
    const rel = prisma.relations.find((r) => r.id === relId);
    const d1 = findings.find((x) => x.ruleId === "DBP001" && x.groupId === f.groupId);
    if (d1) link(f, d1);
    if (rel?.owner) {
      const d2check = dbp002BySubject.get(`${rel.owner.model}|${rel.owner.fields.join(",")}`);
      const d2 = d2check?.findingId ? byId.get(d2check.findingId) : undefined;
      if (d2) {
        d2.groupId = f.groupId;
        link(f, d2);
      }
    }
  }
  function link(a: Finding, b: Finding) {
    if (!a.relatedFindingIds.includes(b.id)) a.relatedFindingIds.push(b.id);
    if (!b.relatedFindingIds.includes(a.id)) b.relatedFindingIds.push(a.id);
    a.relatedFindingIds.sort(compareStrings);
    b.relatedFindingIds.sort(compareStrings);
  }
  const ruleOrder = (r: RuleId) => ["DBP001", "DBP002", "DBP005", "DBP004", "DBP003", "DBP006"].indexOf(r);
  findings.sort((a, b) => compareStrings(a.groupId, b.groupId) || ruleOrder(a.ruleId) - ruleOrder(b.ruleId) || compareStrings(a.subject, b.subject));
  const groupsMap = new Map<string, Finding[]>();
  for (const f of findings) groupsMap.set(f.groupId, [...(groupsMap.get(f.groupId) ?? []), f]);
  const findingGroups: FindingGroup[] = [...groupsMap.entries()]
    .map(([groupId, list]) => ({
      groupId,
      title: groupTitle(groupId, list),
      findingIds: list.map((f) => f.id),
    }))
    .sort((a, b) => compareStrings(a.groupId, b.groupId));

  // ---------------------------------------------------------------- result
  const blockingDiagnostics = prisma.diagnostics.filter((d) => d.severity === "blocking").length;
  const anyFail = checks.some((c) => c.status === "fail");
  const anyUnknown = checks.some((c) => c.status === "unknown");
  const completeWithinScope = !anyUnknown && blockingDiagnostics === 0 && dbComplete;
  const resultStatus: ResultStatus = anyFail ? "mismatch_found" : completeWithinScope ? "no_mismatch_in_checked_scope" : "inconclusive";
  const exitCode = anyFail ? 1 : completeWithinScope ? 0 : 3;
  return { checks, findings, findingGroups, resultStatus, exitCode, blockingDiagnostics, completeWithinScope };
}

function groupTitle(groupId: string, list: Finding[]): string {
  if (groupId.startsWith("relation:")) {
    const rules = [...new Set(list.map((f) => f.ruleId))].join(" + ");
    return `Relation ${groupId.slice("relation:".length)} (${rules}${list.length > 1 ? ": one shared root cause" : ""})`;
  }
  if (groupId.startsWith("model:")) return `Model ${groupId.slice("model:".length)}`;
  return groupId;
}

export { RULES };
