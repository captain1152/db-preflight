import type { RuleId } from "./report-types.ts";

export interface RuleMeta {
  id: RuleId;
  title: string;
  summary: string;
}

export const RULES: Record<RuleId, RuleMeta> = {
  DBP001: {
    id: "DBP001",
    title: "Prisma 1:1 relation without a matching uniqueness declaration",
    summary:
      "A relation resolved as 1:1 from both relation fields has no @unique/@id (single field) or @@unique/@@id with exactly the relation fields in the same order on the defining side (Prisma ORM 7 P1012).",
  },
  DBP002: {
    id: "DBP002",
    title: "Declared uniqueness not guaranteed by the database",
    summary:
      "A Prisma @id/@@id/@unique/@@unique column set is not covered by a supported PK, UNIQUE constraint or valid unique index on the same columns or a subset.",
  },
  DBP003: {
    id: "DBP003",
    title: "Mapped table or column missing",
    summary: "After applying @@schema, @@map and @map, the physical table or column does not exist in the inspected schema.",
  },
  DBP004: {
    id: "DBP004",
    title: "Foreign key correspondence mismatch",
    summary:
      'With relationMode = "foreignKeys", the expected FK is missing or pairs source and target columns differently. Not applicable with relationMode = "prisma".',
  },
  DBP005: {
    id: "DBP005",
    title: "1:1 intent not guaranteed by database structure",
    summary: "For a resolved 1:1 relation, the referencing columns are not unique in the database, so the structure allows duplicates.",
  },
  DBP006: {
    id: "DBP006",
    title: "Scalar nullability mismatch",
    summary: "A scalar field's optionality differs from its column's nullability. Relation field optionality is never used.",
  },
};

export const RULE_IDS = Object.keys(RULES).sort() as RuleId[];
