# Changelog

All notable changes are documented here. This project follows [Semantic Versioning](https://semver.org/).

## [0.1.0] — unreleased

### Added
- Tolerant Prisma ORM 7 schema parser (multi-file, comments, strings, CRLF, spans) that analyzes P1012 schemas.
- Rules DBP001–DBP006 with linked root-cause groups, `unknown` handling and exit codes 0/1/2/3.
- `demo` (built-in synthetic data), `scan --snapshot`, `scan --live`, `snapshot --live` commands; text/JSON/Markdown output.
- Read-only PostgreSQL catalog collector (fixed allow-listed queries, REPEATABLE READ READ ONLY, superuser refusal,
  timeouts) running in an isolated worker process; versioned snapshot contract.
- Claude Code plugin `db-preflight` with `/db-preflight:scan` and `/db-preflight:explain`, shipping the bundled CLI.
- JSON Schemas for report and snapshot; synthetic fixtures; unit, e2e, integration (PostgreSQL 16 and 18) and
  package smoke tests; GitHub Actions workflow.

### Fixed (before release, from independent review)
- Live worker failures: secrets are redacted before truncation, including the decoded password; stderr is not shown
  when it exceeded the collection limit.
- Snapshots accept repeated referencing foreign-key columns (valid in PostgreSQL); referenced columns stay distinct.
- Snapshot gaps must be scoped to `*` or a requested schema, so `--schemas` cannot discard an unattributed gap.
- An unreadable datasource statement (including an unclosed block) or a repeated `relationMode` makes the relation
  mode unknown instead of assuming `foreignKeys` or the last value.
- Schema discovery treats links named like excluded directories (`node_modules`, `generated`, ...) as excluded, so they
  no longer make a scan inconclusive.
- DBP004 accepts any validated, enforced matching foreign key regardless of constraint name order.
- `pnpm test:package` works with GNU tar (Git Bash), temp paths containing spaces, and Node 22 on Windows (no
  `fs.cpSync` for non-ASCII destinations).
