// Normalized models shared by the Prisma parser, the PostgreSQL collector/snapshot loader,
// the rule engine and the reporters. Keep these free of I/O.

export interface SourceSpan {
  /** POSIX-style path relative to the --schema input root. */
  file: string;
  /** 1-based line. */
  line: number;
  /** 1-based column in UTF-16 code units. */
  column: number;
  endLine: number;
  endColumn: number;
}

export type DiagnosticSeverity = "blocking" | "warning" | "info";

export interface Diagnostic {
  code: string;
  severity: DiagnosticSeverity;
  message: string;
  span?: SourceSpan;
  model?: string;
  field?: string;
}

// ---------------------------------------------------------------------------
// Prisma side
// ---------------------------------------------------------------------------

export type FieldKind = "scalar" | "enum" | "relation" | "unsupported_type" | "unknown_type";

export interface RelationAttribute {
  name?: string;
  fields?: string[];
  references?: string[];
  span: SourceSpan;
}

export interface PrismaField {
  name: string;
  /** Physical column name after @map. */
  dbName: string;
  typeName: string;
  kind: FieldKind;
  isList: boolean;
  isOptional: boolean;
  isId: boolean;
  isUnique: boolean;
  ignored: boolean;
  relation?: RelationAttribute;
  /** Blocking problems that make checks depending on this field unknown. */
  issues: Diagnostic[];
  span: SourceSpan;
}

export interface UniqueDecl {
  kind: "id" | "unique";
  /** Prisma field names, in declaration order. */
  fields: string[];
  origin: "field" | "block";
  /** False when the declaration uses arguments whose semantics v0.1 does not evaluate (e.g. where:). */
  supported: boolean;
  unsupportedReason?: string;
  span: SourceSpan;
}

export interface PrismaModelDef {
  name: string;
  blockKind: "model" | "view";
  /** Physical table name after @@map. */
  dbName: string;
  /** Explicit @@schema value, if any. */
  schema?: string;
  fields: PrismaField[];
  uniques: UniqueDecl[];
  ignored: boolean;
  /** Blocking problems that make every check for this model unknown. */
  issues: Diagnostic[];
  span: SourceSpan;
}

export interface PrismaEnumDef {
  name: string;
  schema?: string;
  span: SourceSpan;
}

export type RelationMode = "foreignKeys" | "prisma";

export interface DatasourceInfo {
  provider?: string;
  relationMode?: RelationMode;
  relationModeSource: "explicit" | "default" | "unknown";
  schemas?: string[];
  span: SourceSpan;
}

export interface RelationEnd {
  model: string;
  field: string;
  isList: boolean;
  isOptional: boolean;
  span: SourceSpan;
}

export interface ResolvedRelation {
  /** Stable identifier: owner side "Model.field" when there is an owner. */
  id: string;
  name?: string;
  status: "resolved" | "ambiguous";
  kind: "one_to_one" | "one_to_many" | "implicit_many_to_many" | "unknown";
  /** Side declaring fields/references. */
  owner?: RelationEnd & { fields: string[]; references: string[] };
  /** Opposite side (back-relation field). */
  other?: RelationEnd;
  referencedModel?: string;
  reason?: string;
  ends: RelationEnd[];
}

export interface PrismaFileInfo {
  path: string;
  sha256: string;
  bytes: number;
}

export interface SkippedInput {
  path: string;
  reason: string;
}

export interface PrismaSchemaModel {
  files: PrismaFileInfo[];
  skipped: SkippedInput[];
  datasource?: DatasourceInfo;
  models: PrismaModelDef[];
  enums: PrismaEnumDef[];
  relations: ResolvedRelation[];
  diagnostics: Diagnostic[];
}

// ---------------------------------------------------------------------------
// Database side
// ---------------------------------------------------------------------------

export interface DbColumn {
  name: string;
  nullable: boolean;
  /** PostgreSQL 18+: NOT NULL constraint exists but is NOT VALID (existing rows unchecked). */
  notNullUnvalidated?: boolean;
  /** Column type is a domain (whose own NOT NULL is not evaluated); only recorded when attnotnull is false. */
  domainType?: boolean;
}

export type DbUniqueKind = "primary_key" | "unique_constraint" | "unique_index" | "exclusion_constraint";

export interface DbUniqueKey {
  kind: DbUniqueKind;
  name: string;
  /** Ordered key columns. null when any key part is an expression or the catalog shape was not understood. */
  columns: string[] | null;
  /** INCLUDE (non-key) columns, never part of the key. */
  includeColumns: string[];
  partial: boolean;
  expression: boolean;
  valid: boolean;
  deferrable: boolean;
  immediate: boolean;
  nullsNotDistinct: boolean;
  /** WITHOUT OVERLAPS / PERIOD (PostgreSQL 18+). */
  period: boolean;
}

export interface DbForeignKey {
  name: string;
  /** Ordered source columns; columns[i] references references.columns[i]. */
  columns: string[];
  references: { schema: string; table: string; columns: string[] };
  deferrable: boolean;
  validated: boolean;
  enforced: boolean;
  /** PostgreSQL 18 temporal FK (PERIOD): range-coverage semantics, not plain equality. */
  period?: boolean;
}

export interface DbInheritance {
  /** Partition of a declaratively partitioned table. */
  isPartition: boolean;
  /** Has ordinary (INHERITS, non-partition) child tables, whose rows are not covered by this table's unique indexes or FKs. */
  hasInheritanceChildren: boolean;
  /** Ordinary inheritance parents (not partition parents). */
  inheritsFrom: { schema: string; table: string }[];
}

export interface DbTable {
  schema: string;
  name: string;
  kind: "table" | "partitioned_table";
  inheritance: DbInheritance;
  columns: DbColumn[];
  uniqueKeys: DbUniqueKey[];
  foreignKeys: DbForeignKey[];
}

export interface DbOtherRelation {
  schema: string;
  name: string;
  kind: "view" | "materialized_view" | "foreign_table";
}

export interface CollectionGap {
  /** Schema name or "*" for the whole collection. */
  scope: string;
  reason: string;
}

export interface DatabaseModel {
  origin: "live" | "snapshot" | "demo";
  /** For snapshots: how the snapshot itself was produced. */
  snapshotOrigin?: "live" | "synthetic";
  /** When the metadata was collected (ISO 8601). Not the scan time. */
  collectedAt: string;
  server: { version: string | null; versionNum: number | null };
  /** Schemas the caller asked to inspect. */
  requestedSchemas: string[];
  /** Requested schemas that exist in the catalog. */
  schemasFound: string[];
  /** True only if every requested catalog query succeeded and was understood. */
  complete: boolean;
  gaps: CollectionGap[];
  tables: DbTable[];
  otherRelations: DbOtherRelation[];
  readOnly: { verified: boolean; detail: string };
}
