# DB Preflight report

| | |
|---|---|
| Result | **mismatch_found** (exit code 1) |
| Mode | demo |
| Tool version | 0\.1\.0 |
| Prisma input | 3 file(s), Prisma ORM 7 semantics, relationMode foreignKeys (default) |
| Database metadata | demo (synthetic snapshot), collected 2026\-01\-15T09:00:00\.000Z, PostgreSQL 16\.4 |
| Schemas in scope | `public` (default schema `public`) |
| Collection complete | yes |

2 check\(s\) found confirmed mismatches, grouped into 1 root\-cause group\(s\)\.

> Results cover only the supported checks listed in this report, evaluated against the collected metadata\. They are not a guarantee that the database as a whole is correct, that data is consistent, or that any migration is safe\.

## Findings

### Relation SnapshotSummary\.snapshot \(DBP001 \+ DBP005: one shared root cause\)

#### DBP001 (error) — 1:1 relation SnapshotSummary\.snapshot has no Prisma uniqueness declaration on \(organizationId, month, snapshotId\)

Finding id `DBP001-29c4232b56`; related `DBP005-29c4232b56`

**Observed**

- SnapshotSummary\.snapshot declares @relation\(fields: \[organizationId, month, snapshotId\]\)\.
- The opposite field MonthlySnapshot\.summary is not a list, so the relation is declared 1:1\.
- SnapshotSummary has no @unique/@@unique/@id/@@id on \(organizationId, month, snapshotId\)\.

**Expected:** Prisma ORM 7 requires @@unique or @@id with exactly \(organizationId, month, snapshotId\) \(same fields, same order\) on the defining side of a 1:1 relation\.

**Difference:** The 1:1 relation has no matching uniqueness declaration; prisma validate rejects this schema \(P1012\)\.

**Impact:** prisma generate / migrate cannot run on this schema; the intended cardinality \(1:1 vs 1:n\) is unresolved\.

**Evidence**

- Prisma `reporting.prisma:25:3` — SnapshotSummary\.snapshot @relation\(fields: \[organizationId, month, snapshotId\], references: \[organizationId, month, snapshotId\]\)
- Prisma `reporting.prisma:9:3` — MonthlySnapshot\.summary is not a list \(1:1\)

**Options for a human to review** (not automatic fixes)

- If one MonthlySnapshot can have several SnapshotSummary rows, consider declaring the back\-relation as a list \(summary SnapshotSummary\[\]\), i\.e\. 1:n\.
- If 1:1 is intended, first confirm the database does not already contain duplicates for these columns, then review adding a matching uniqueness declaration together with a database constraint in a reviewed migration\.
- Do not add a uniqueness declaration only to silence P1012; see DBP005 for what the database actually enforces\.

**Not checked**

- Which cardinality is correct for the business domain is not decided by db\-preflight\.

#### DBP005 (error) — 1:1 relation SnapshotSummary\.snapshot: public\.snapshot\_summaries\(organization\_id, month, snapshot\_id\) is not unique in the database

Finding id `DBP005-29c4232b56`; related `DBP001-29c4232b56`

**Observed**

- Prisma declares SnapshotSummary\.snapshot as 1:1 \(opposite field MonthlySnapshot\.summary is not a list\)\.
- public\.snapshot\_summaries has no primary key, unique constraint or valid unique index on \(organization\_id, month, snapshot\_id\) or any subset of it\.
- Foreign key snapshot\_summaries\_snapshot\_fkey \(organization\_id, month, snapshot\_id\) \-&gt; public\.monthly\_snapshots\(organization\_id, month, snapshot\_id\) exists; a foreign key alone does not make the referencing columns unique\.

**Expected:** For a 1:1 relation, the referencing columns are unique in the database \(a key on these columns or a subset\)\.

**Difference:** The database structure allows several snapshot\_summaries rows to reference the same MonthlySnapshot row\.

**Impact:** The structure permits duplicates that Prisma's 1:1 API cannot represent\. This does not mean duplicates currently exist\.

**Evidence**

- Prisma `reporting.prisma:25:3` — SnapshotSummary\.snapshot @relation\(fields: \[organizationId, month, snapshotId\], references: \[organizationId, month, snapshotId\]\)
- Prisma `reporting.prisma:9:3` — MonthlySnapshot\.summary is not a list \(1:1\)
- Database `public.snapshot_summaries` — no primary key, unique constraint or valid unique index on a subset of \(organization\_id, month, snapshot\_id\); existing keys: snapshot\_summaries\_pkey \(id\)

**Options for a human to review** (not automatic fixes)

- If the business rule is 1:n, review changing the Prisma back\-relation to a list; no database change is implied\.
- If the business rule is 1:1, a person should first query for existing duplicates, then review a migration that adds a unique constraint on these columns\.
- Adding UNIQUE is not an automatic fix: it fails if duplicates exist and changes write behaviour\.

**Not checked**

- Whether duplicate references currently exist \(rows are not read\)\.
- Whether 1:1 or 1:n is the intended business rule\.

## Coverage

| Checks | Pass | Fail | Unknown | Not applicable | Complete within scope |
|---|---|---|---|---|---|
| 24 | 20 | 2 | 0 | 2 | yes |

Not covered by this tool:

- Row data: table rows are never read, so existing duplicates or orphaned rows are not detected\.
- CHECK constraints, triggers, defaults, generated columns, RLS policies and privileges\.
- Migration safety, lock impact and production readiness\.
- Prisma Client runtime behaviour and generated client code\.
- Database objects outside the requested schemas\.

## Safety

- Database access: none
- Read-only transaction verified: n/a
- Prisma input files unchanged (re-hashed after analysis): n/a
- LLM or network calls by the tool: none
