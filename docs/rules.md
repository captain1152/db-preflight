# Rules (v0.1)

Every rule produces **checks** with status `pass`, `fail`, `unknown` or `not_applicable`, and a `fail` produces a
**finding** with: observed facts, expected condition, difference, impact, review options for a human, and what was
not checked. Findings that share one root cause are linked (`groupId`, `relatedFindingIds`) instead of being counted
as separate problems.

## Common preconditions (all rules)

Inputs found but not read (directory depth limit, symlinks) are blocking diagnostics, so the result cannot be complete.
String literals use PSL/JSON escapes (`\n`, `\uXXXX` …); an undefined escape makes the statement unparseable (model `unknown`).

A model's checks are:

- `not_applicable` if the model has `@@ignore` (fields with `@ignore`: their DBP006 check is `not_applicable`).
- `unknown` if the model is a `view`, or any statement inside the model could not be parsed, or it uses an attribute
  that v0.1 does not evaluate (`@@fulltext`, `@shardKey`, unknown attributes …).
- `unknown` if its database schema cannot be determined: no `@@schema` and no `--default-schema` (`public` is never
  assumed), or the schema is outside `--schemas` / the snapshot scope.
- `unknown` if the mapped name exists as a view, materialized view or foreign table, or the metadata collection
  for that schema was incomplete. "Not collected" is never turned into "does not exist".

Table lookups always use the physical names after `@@schema` → `@@map` → `@map`, never Prisma logical names.

## Database uniqueness semantics (used by DBP002 and DBP005)

For a column set F, the database guarantees uniqueness iff some key K with **K ⊆ F** is a primary key, unique
constraint or unique index that is: non-partial, non-expression, valid/ready/live, non-deferrable/immediate and not
`WITHOUT OVERLAPS`. Key column order is irrelevant for this set comparison. `INCLUDE` columns are not key columns.
A larger key (F ⊂ K) does **not** guarantee F.

- Candidate keys with unsupported semantics (partial, expression, invalid, deferrable, period, exclusion constraint)
  make the result `unknown`, not "missing".
- Tables with ordinary (`INHERITS`) child tables: `unknown` (children's rows are visible through the parent but not
  covered by its indexes). Declaratively partitioned tables are supported.
- Nullable key columns: the guarantee applies to rows where the columns are non-null; the evidence notes this.

## DBP001 — Prisma 1:1 relation without a matching uniqueness declaration

- **Input**: Prisma schema only (works without a database; P1012 schemas are the main target).
- **Applies to**: relations resolved as 1:1 from *both* relation fields (owner side has `fields/references`, the
  opposite field is not a list). The relation name and both fields are combined; ambiguous pairs are `unknown`.
- **Fails when**: the owner side has no `@unique`/`@id` (single field) or `@@unique`/`@@id` whose field list equals
  the relation fields **in the same order**.
- **Evidence for that exact-order rule**: measured with prisma@7.10.0 (`fixtures/prisma-semantics`, `pnpm test:prisma`):
  subset, superset and reordered declarations are rejected with P1012.
- **Not applicable**: 1:n relations, implicit many-to-many.
- **Never suggests** adding a uniqueness declaration just to silence P1012.
- Tests: `tests/unit/engine.test.ts` (prisma-semantics manifest, DB-unique/Prisma-missing case), fixtures.

## DBP002 — Declared uniqueness not guaranteed by the database

- **Input**: every `@id`, `@@id`, `@unique`, `@@unique`.
- **Fails when**: the database semantics above say "not guaranteed" and the collection for the schema is complete.
- **Unknown**: `@@unique(..., where: ...)` (partial, preview feature), unknown arguments, unknown fields, inheritance,
  unsupported candidate keys, missing table/column (blocked by DBP003).
- Tests: subset/superset/INCLUDE/partial/expression/invalid/deferrable/nullable cases in `tests/unit/engine.test.ts`.

## DBP003 — Mapped table or column missing

- **Fails when**: the mapped table is absent from a completely collected schema, or a non-relation, non-ignored field's
  mapped column is absent.
- **Unknown**: schema not determined or out of scope, incomplete collection (also when the table was collected but a
  column is absent), mapped to a view/foreign table.
- Same table names in different schemas are resolved by `@@schema` (fixture `multi-schema-mapped`).

## DBP004 — Foreign key correspondence mismatch

- **Applies to**: relations with an owning side, when `relationMode` is `foreignKeys` (explicit, or the documented
  default when a datasource block exists without `relationMode`). If any statement in the datasource block cannot be
  read, or `relationMode` is declared more than once, the relation mode is unknown, even when a `relationMode` value
  was read.
- **Passes when**: a foreign key on the owner table targets the mapped referenced table with exactly the expected
  multiset of column **pairs** (`fields[i] → references[i]`); listing order of the pairs does not matter, pairing does.
  When several FKs match, any validated, enforced, non-`PERIOD` one decides; constraint names and order do not.
- **Fails when**: no such FK (`fk_missing`), or related FKs pair columns differently / point elsewhere (`fk_mapping_mismatch`).
- **Not applicable**: `relationMode = "prisma"` (physical FK absence is expected).
- **Unknown**: no datasource block or an unreadable one (relation mode unknown), matching FKs that are all `NOT VALID`,
  `NOT ENFORCED` or PostgreSQL 18 temporal (`PERIOD`),
  implicit many-to-many join tables, inheritance, ambiguous relations, unsupported `@relation` arguments on either
  relation field, any incomplete collection for the owner's schema (a matching FK may simply not have been collected),
  and — when no matching FK exists — a referenced table that is out of scope, unresolved or missing.
- Foreign keys inherited by partitions are collected, so models mapped to a leaf partition are checked too.

## DBP005 — 1:1 intent not guaranteed by database structure

- **Applies to**: resolved 1:1 relations, regardless of relationMode.
- **Fails when**: the owner's referencing columns are not guaranteed unique (semantics above).
- **Wording**: "the structure allows duplicates", never "duplicates exist" — rows are not read.
- **Linking**: if DBP001 also failed for the relation, or the matching Prisma declaration failed DBP002, the findings
  share one group (one root cause).

## DBP006 — Scalar nullability mismatch

- **Compares**: `Type?` vs `Type` on scalar, enum and `Unsupported(...)` fields with the column's nullability.
  Relation fields are never used to infer column nullability. Scalar lists are `not_applicable`.
- **Severity**: required in Prisma but nullable in DB → error; optional in Prisma but NOT NULL in DB → warning.
- **Unknown**: PostgreSQL 18 `NOT NULL ... NOT VALID`, ordinary inheritance children (PG18 `NO INHERIT`), nullable columns
  whose type is a domain (a domain's own NOT NULL is not evaluated), missing column.

## Exit code mapping

Any `fail` → 1. Otherwise any `unknown`, blocking Prisma diagnostic (every unparsed statement or unsupported attribute
is listed in `prisma.diagnostics`) or incomplete collection (`complete: false` or any recorded gap) → 3. Otherwise 0.
Errors that prevent a valid result → 2.
