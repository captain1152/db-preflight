import { readFileSync } from "node:fs";
import { join } from "node:path";
import { type BuildReportInput, buildReport } from "../src/core/report.ts";
import type { Report } from "../src/core/report-types.ts";
import type { DatabaseModel, DbForeignKey, DbTable, DbUniqueKey } from "../src/core/types.ts";
import { loadSnapshotFile, snapshotToDatabaseModel } from "../src/postgres/snapshot.ts";
import { analyzePrismaSources, loadPrismaSchema } from "../src/prisma/index.ts";

export const REPO = join(import.meta.dirname, "..");
export const FIXTURES = join(REPO, "fixtures");

export interface FixtureManifest {
  schema: string;
  snapshot: string;
  dbSchemas: string[];
  defaultSchema: string | null;
  expectedExitCode: number;
  expectedChecks: Record<string, string>;
  expectedFindingGroups: number;
}

export function manifest(name: string): FixtureManifest {
  return JSON.parse(readFileSync(join(FIXTURES, name, "fixture.json"), "utf8")) as FixtureManifest;
}

const SAFETY: BuildReportInput["safety"] = {
  databaseAccess: "none",
  readOnlyTransactionVerified: null,
  roleVerifiedNotSuperuser: null,
  catalogQueryIdsExecuted: null,
};

export function scanFixture(name: string, override?: { defaultSchema?: string | null; db?: (db: DatabaseModel) => DatabaseModel }): Report {
  const m = manifest(name);
  const loaded = loadPrismaSchema(join(FIXTURES, name, m.schema));
  let db = snapshotToDatabaseModel(loadSnapshotFile(join(FIXTURES, name, m.snapshot)), "snapshot");
  if (override?.db) db = override.db(db);
  return buildReport({
    mode: "snapshot",
    inputKind: loaded.inputKind,
    prisma: loaded.model,
    db,
    defaultSchema: override && "defaultSchema" in override ? (override.defaultSchema ?? null) : m.defaultSchema,
    generatedAt: "2026-01-01T00:00:00.000Z",
    safety: SAFETY,
  });
}

export function scanText(prismaText: string, db: DatabaseModel, defaultSchema: string | null = "public"): Report {
  return scanSources([{ path: "schema.prisma", text: prismaText }], db, defaultSchema);
}

export function scanSources(sources: { path: string; text: string }[], db: DatabaseModel, defaultSchema: string | null = "public"): Report {
  return buildReport({
    mode: "snapshot",
    inputKind: "directory",
    prisma: analyzePrismaSources(sources),
    db,
    defaultSchema,
    generatedAt: "2026-01-01T00:00:00.000Z",
    safety: SAFETY,
  });
}

export function status(r: Report, id: string): string | undefined {
  return r.checks.find((c) => c.id === id)?.status;
}

// ---- compact DatabaseModel builders --------------------------------------------------------

export function key(name: string, columns: string[] | null, extra: Partial<DbUniqueKey> = {}): DbUniqueKey {
  return {
    kind: "unique_constraint",
    name,
    columns,
    includeColumns: [],
    partial: false,
    expression: columns === null,
    valid: true,
    deferrable: false,
    immediate: true,
    nullsNotDistinct: false,
    period: false,
    ...extra,
  };
}

export function fk(
  name: string,
  columns: string[],
  refTable: string,
  refColumns: string[],
  extra: Partial<DbForeignKey> & { refSchema?: string } = {},
): DbForeignKey {
  const { refSchema, ...rest } = extra;
  return {
    name,
    columns,
    references: { schema: refSchema ?? "public", table: refTable, columns: refColumns },
    deferrable: false,
    validated: true,
    enforced: true,
    ...rest,
  };
}

/** Columns: "name" = NOT NULL, "name?" = nullable. */
export function table(
  name: string,
  columns: string[],
  uniqueKeys: DbUniqueKey[] = [],
  foreignKeys: DbForeignKey[] = [],
  schema = "public",
  extra: Partial<DbTable> = {},
): DbTable {
  return {
    schema,
    name,
    kind: "table",
    inheritance: { isPartition: false, hasInheritanceChildren: false, inheritsFrom: [] },
    columns: columns.map((c) => (c.endsWith("?") ? { name: c.slice(0, -1), nullable: true } : { name: c, nullable: false })),
    uniqueKeys,
    foreignKeys,
    ...extra,
  };
}

export function dbModel(tables: DbTable[], extra: Partial<DatabaseModel> = {}): DatabaseModel {
  const schemas = [...new Set(tables.map((t) => t.schema).concat(extra.requestedSchemas ?? []))].sort();
  return {
    origin: "snapshot",
    snapshotOrigin: "synthetic",
    collectedAt: "2026-01-01T00:00:00.000Z",
    server: { version: "16.4", versionNum: 160004 },
    requestedSchemas: schemas.length ? schemas : ["public"],
    schemasFound: schemas.length ? schemas : ["public"],
    complete: true,
    gaps: [],
    tables,
    otherRelations: [],
    readOnly: { verified: false, detail: "test" },
    ...extra,
  };
}

export const DS = 'datasource db {\n  provider = "postgresql"\n}\n';
