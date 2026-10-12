# DB Preflight

**Evidence-first PostgreSQL / Prisma ORM 7 diagnostics for AI coding workflows.**

DB Preflight compares your Prisma schema with the real structure of a PostgreSQL database and reports
relation, uniqueness and mapping mismatches **with evidence** (Prisma `file:line:column` plus the database
objects involved) — including schemas that `prisma validate` rejects with P1012. It never changes your
database or your Prisma files. Its purpose is to check the actual state *before* anyone (human or AI) "fixes"
something, so that a wrong automatic fix is not applied.

[한국어 문서 (README.ko.md)](README.ko.md) · [Docs index](docs/index.md) · [Rules](docs/rules.md) ·
[Security](docs/security.md) · [Compatibility](docs/compatibility.md)

> Status: v0.1.0 (pre-release). Not published to npm: `npx db-preflight` does **not** work yet. The Claude Code
> plugin installs from this repository's marketplace (see [Claude Code plugin](#claude-code-plugin)).

## First run (no database, no Docker, no network)

Requirements: Node.js >= 20.19, pnpm (for building from source).

```bash
pnpm install --frozen-lockfile
pnpm build
node dist/db-preflight.cjs demo
```

The demo uses built-in **synthetic** data: a composite 1:1 relation over
`[organizationId, month, snapshotId]` without a uniqueness declaration, and a database whose foreign key on
those columns is not unique. **It intentionally exits with code 1** ("mismatch found"). That is the
demo's expected result, not a crash; a crash or bad input exits with 2.

Excerpt of the real output ([full text](docs/examples/demo-output.txt), [JSON](docs/examples/demo-report.json),
[Markdown](docs/examples/demo-report.md)):

```text
RESULT: MISMATCH FOUND (exit code 1)
  2 check(s) found confirmed mismatches, grouped into 1 root-cause group(s).

[1] Relation SnapshotSummary.snapshot (DBP001 + DBP005: one shared root cause)
  [FAIL] DBP001 1:1 relation SnapshotSummary.snapshot has no Prisma uniqueness declaration on (organizationId, month, snapshotId)
     Expected:   Prisma ORM 7 requires @@unique or @@id with exactly (organizationId, month, snapshotId) (same fields, same order) on the defining side of a 1:1 relation.
     Evidence:
       - prisma  reporting.prisma:25:3  SnapshotSummary.snapshot @relation(fields: [organizationId, month, snapshotId], references: [organizationId, month, snapshotId])
       - prisma  reporting.prisma:9:3  MonthlySnapshot.summary is not a list (1:1)
  [FAIL] DBP005 1:1 relation SnapshotSummary.snapshot: public.snapshot_summaries(organization_id, month, snapshot_id) is not unique in the database
     Impact:     The structure permits duplicates that Prisma's 1:1 API cannot represent. This does not mean duplicates currently exist.
     Evidence:
       - db      public.snapshot_summaries  no primary key, unique constraint or valid unique index on a subset of (organization_id, month, snapshot_id); existing keys: snapshot_summaries_pkey (id)
     Options for a human to review (not automatic fixes):
       - If the business rule is 1:n, review changing the Prisma back-relation to a list; no database change is implied.
       - If the business rule is 1:1, a person should first query for existing duplicates, then review a migration that adds a unique constraint on these columns.
       - Adding UNIQUE is not an automatic fix: it fails if duplicates exist and changes write behaviour.
```

Broken composite relation → diagnosis → evidence → **decisions left to a human** (1:1 or 1:n? are there
duplicates? is a migration safe?). DB Preflight does not make those decisions.

`node dist/db-preflight.cjs demo --scenario healthy` shows the corrected version (exit 0).

## How it differs from `prisma validate` and SQL tools

| | `prisma validate` | SQL / DB MCP tools | DB Preflight |
|---|---|---|---|
| Reads a schema that fails P1012 | stops at the error | n/a | yes — keeps analyzing, with locations |
| Compares with the real database | no | you write the queries | fixed catalog checks, evidence for each finding |
| Separates "Prisma accepts it" from "the DB enforces it" | partially | no | yes (DBP001 vs DBP002/DBP005) |
| Says what it did **not** check | no | no | yes: `unknown` checks, coverage, exit code 3 |
| Changes the database | no | can | never (no SQL input, no migrations) |

## Usage

```text
db-preflight demo [--scenario broken|healthy] [--format text|json|markdown] [--out FILE] [--force]
db-preflight scan --schema PATH --snapshot FILE [--default-schema NAME] [--schemas a,b] [--format F] [--out FILE]
db-preflight scan --schema PATH --live --schemas a,b [--db-url-env NAME] [--default-schema NAME] [--timeout-ms N]
db-preflight snapshot --live --schemas a,b [--db-url-env NAME] [--out FILE]
```

- `--schema` takes a `.prisma` file or a directory (multi-file schemas, walked deterministically;
  `node_modules`, `.git`, build output and symlinks are skipped). `prisma.config.*` is never loaded or executed,
  so you always pass the schema path explicitly.
- `--default-schema` is the database schema for models without `@@schema`. It is never guessed: without it
  those models' checks are `unknown`. `--schemas` is the inspection scope; it is a different thing.
- `--format json` prints exactly one JSON document on stdout ([report contract](schemas/report.schema.json));
  progress and errors go to stderr.
- `--out FILE` refuses to overwrite an existing file unless `--force`, and never writes onto a Prisma input,
  a `.prisma` file, the input snapshot, a symlink or a hard link of an input.

### Exit codes

| Code | Meaning |
|---|---|
| 0 | The required checks in scope completed and none failed. |
| 1 | At least one confirmed mismatch. Coverage may still be incomplete (shown in the report). |
| 2 | Input, configuration, connection or execution error: no valid result. |
| 3 | No confirmed mismatch, but required checks are `unknown`, so no conclusion can be drawn. |

`unknown` means "not evaluated" (unsupported syntax, incomplete collection, missing `--default-schema`, a view,
an implicit many-to-many join table, partial/expression indexes …). It is never counted as passing.

### Offline scan with a snapshot

```bash
node dist/db-preflight.cjs scan --schema ./prisma/schema --snapshot ./db-snapshot.json --default-schema public
node dist/db-preflight.cjs scan --schema ./prisma/schema.prisma --snapshot ./db-snapshot.json --default-schema public --format markdown
```

A snapshot records **when** it was collected; results describe that moment, not necessarily today's database.

### Live scan (explicit opt-in)

Live mode reads only catalog metadata (`pg_catalog`) with a least-privilege role. Set the connection URL in
your own shell — DB Preflight never reads `.env` files, never accepts a URL on the command line and does not
fall back to `DATABASE_URL` or `PG*` variables.

PowerShell:

```powershell
$env:DB_PREFLIGHT_DATABASE_URL = "postgresql://preflight_reader:<password>@db.example.com:5432/app"
node dist/db-preflight.cjs scan --schema .\prisma\schema --live --schemas public,reporting --default-schema public
node dist/db-preflight.cjs snapshot --live --schemas public,reporting --out .\db-snapshot.json
Remove-Item Env:\DB_PREFLIGHT_DATABASE_URL
```

Bash:

```bash
export DB_PREFLIGHT_DATABASE_URL='postgresql://preflight_reader:<password>@db.example.com:5432/app'
node dist/db-preflight.cjs scan --schema ./prisma/schema --live --schemas public,reporting --default-schema public
node dist/db-preflight.cjs snapshot --live --schemas public,reporting --out ./db-snapshot.json
unset DB_PREFLIGHT_DATABASE_URL
```

`--db-url-env NAME` selects a different variable *name*. Remote hosts default to verified TLS
(`sslmode=require` is treated as `verify-full`); see [security](docs/security.md) for the role setup, TLS
options and what "read-only" does and does not guarantee. Superuser connections are refused. Snapshots and
reports contain schema metadata, which may be sensitive: they are git-ignored by default.

## What is checked (v0.1)

| Rule | Checks |
|---|---|
| DBP001 | 1:1 relation without a matching Prisma uniqueness declaration (P1012), composite keys included |
| DBP002 | A Prisma `@id/@@id/@unique/@@unique` not guaranteed by a PK/UNIQUE/unique index (same columns or a subset) |
| DBP003 | Table/column missing after applying `@@schema`, `@@map`, `@map` |
| DBP004 | Foreign key missing or pairing columns differently (`relationMode = "foreignKeys"`; not applicable with `"prisma"`) |
| DBP005 | A 1:1 relation whose referencing columns are not unique in the database (structure allows duplicates) |
| DBP006 | Scalar optionality vs column nullability (relation field optionality is never used) |

Details, preconditions and exceptions: [docs/rules.md](docs/rules.md). Supported versions: PostgreSQL 16 and
18 verified in integration tests (14+ accepted by the collector, not verified); Prisma ORM **7** schema
semantics only ([compatibility](docs/compatibility.md)). Other databases, ORMs and Prisma majors are out of scope.

**A clean result means "no mismatch in the supported checks that ran".** It is not a statement that the
database is correct, that data is consistent, or that a migration is safe.

## Claude Code plugin

The plugin in [`plugins/claude/db-preflight`](plugins/claude/db-preflight) is a thin interface: its skills run
the same bundled CLI (`dist/db-preflight.cjs`, committed inside the plugin directory) and explain the JSON report.

Local load (verified with `claude plugin validate`; see [publishing](docs/publishing.md) for what was and was
not verified interactively):

```bash
claude --plugin-dir ./plugins/claude/db-preflight
# inside Claude Code:
/db-preflight:scan demo
/db-preflight:scan --schema ./prisma/schema --snapshot ./db-snapshot.json --default-schema public
/db-preflight:explain ./report.json
```

Install from this repository's marketplace:

```bash
claude plugin marketplace add captain1152/db-preflight
claude plugin install db-preflight@db-preflight
# or, inside Claude Code 2.1.275+, in one step:
/plugin install db-preflight --marketplace captain1152/db-preflight
```

From a local checkout, use `claude plugin marketplace add ./` instead. Requires Node.js >= 20.19 on PATH. Reports read
by Claude become part of the conversation; the CLI itself makes no network calls.

## Development

See [docs/development.md](docs/development.md). Main commands: `pnpm lint`, `pnpm typecheck`, `pnpm test`,
`pnpm build`, `pnpm test:package`, `pnpm test:prisma`, `pnpm test:integration` (Docker).

## License

MIT (see [LICENSE](LICENSE); Copyright (c) 2026 이성민). Bundled third-party
licenses: `dist/THIRD_PARTY_LICENSES.txt`.
