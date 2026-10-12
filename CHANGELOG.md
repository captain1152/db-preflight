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
