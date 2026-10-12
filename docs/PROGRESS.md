# Progress

Status legend: **DONE** = implemented and verified by a command that was actually run (result recorded);
**IMPL** = implemented, not independently verified; **NOT RUN** = verification not executed (reason given).

_Last updated: 2026-10-12._ The current state is in "Pre-publication cleanup (2026-10-12)" below; the step table and
the two sections after it are the historical record of the initial build (2026-10-08) and were not all re-run since.

## Status by step (initial build, 2026-10-08)

| Step | Item | Status | Evidence |
|------|------|--------|----------|
| 1 | Environment check, execution plan, plan review | DONE | Codex review: REVISE (R1–R4) → REVISE (R5) → **APPROVED** (round 3); `runner.py check` → "Approval matches the current plan." (execution plan and review log are kept outside the published repository) |
| 2 | P1012 composite fixture + Prisma 7.10.0 semantics spike + ADR | DONE | `pnpm test:prisma` → 17/17; ADR 0001 |
| 2 | Tokenizer / parser / model / relation resolution | DONE | `tests/unit/parser.test.ts`, `discover.test.ts` |
| 3 | Rule engine DBP001–006, report, reporters, CLI, demo | DONE | `tests/unit/engine.test.ts`, `reporters-demo.test.ts`, `contract.test.ts`, `tests/e2e/cli.test.ts` |
| 4 | Collector, worker isolation, snapshot contract, PG 16/18 integration | DONE | `pnpm test:integration` → 26 passed, 3 skipped (see below) |
| 5 | Bundle, plugin, marketplace, package smoke | DONE | `pnpm test:package` → 27/27; `pnpm check:bundle`; `claude plugin validate` (both pass; the author warning was resolved on 2026-10-09) |
| 5 | Real Claude Code load of both skills | DONE | see "Claude load check" |
| 6 | Docs (EN/KO), AGENTS/CLAUDE, community files, CI workflow, checklist | DONE | First GitHub Actions run on `690d593`: see "Pre-publication cleanup" |
| — | Final independent inspection (fresh Codex sessions) | 2 rounds used (REVISE → 8 fixed; REVISE → 7 fixed) | IR-009…IR-015 re-reviewed on 2026-10-12: RV-001…RV-009 found and fixed (see below) |

## Verification commands run locally on 2026-10-08 (historical; Windows 11, Node 24.15.0, pnpm 12.9.1, Docker 29.5.3)

| Command | Result |
|---|---|
| `pnpm install --frozen-lockfile` | ok |
| `pnpm lint` | ok (Biome, 57 files) |
| `pnpm typecheck` | ok (tsc 7.0.2, exit 0) |
| `pnpm build` | ok; bundled pg@8.23.1 and 12 dependencies (MIT/ISC) |
| `pnpm check:bundle` | "plugin bundle is up to date with the sources" |
| `pnpm test` | 9 files, **137 passed, 1 skipped** (symlink test: Windows account cannot create symlinks; recorded as skipped, not passed) |
| `pnpm test:package` | 27/27 checks (plugin dir alone in a spaced/Korean temp path, PowerShell, npm tarball without node_modules) |
| `pnpm test:prisma` | 17/17 fixtures matched (prisma 7.10.0) |
| `pnpm test:integration` | postgres:16.15-alpine and postgres:18.6-alpine: **26 passed, 3 skipped** (two PG18-only tests - NOT VALID, PERIOD FK - skipped on 16; "docker unavailable" placeholder skipped). All `dbp-it-*` containers removed afterwards. |
| `claude plugin validate plugins/claude/db-preflight` / `claude plugin validate .` | passed with warning: no `author` (owner decision pending) |

### Claude load check (2026-10-08, historical)

In a temp project folder: `claude -p "/db-preflight:scan demo" --plugin-dir <abs>/plugins/claude/db-preflight
--allowedTools "Bash(node *)" "PowerShell(node *)" "Read"` → the skill ran the bundled CLI and explained the report
(mismatch, DBP001+DBP005 as one root cause, exit 1 described as intended, unknown/coverage stated).
`claude -p "/db-preflight:explain ./report.json" --plugin-dir ... --allowedTools "Read"` → explained an existing
report (21 unknown checks reported as not evaluated). This shows the skills load and work once; it is not a guarantee
that a model always follows skill policies. `claude plugin marketplace add/install` were not run on 2026-10-08; they were
verified on 2026-10-12 (see below).

## Not done / known limitations

- CI matrix: ubuntu + windows × Node 22/24, plus the bundled CLI on Node 20.19 (no install). The Windows package
  smoke fix has not run on GitHub yet (pending the next push).
- PostgreSQL 14, 15, 17 not verified (collector accepts ≥ 14).
- Partial unique indexes, expression indexes, exclusion constraints, deferrable keys, implicit many-to-many join
  tables, views and ordinary inheritance are reported as `unknown`, not evaluated.
- Column types, defaults, CHECK constraints, triggers, RLS and row data are not checked.
- `--default-schema` must be given for models without `@@schema`; the Prisma 7 `prisma.config.ts` is never read.
- Owner decisions filled in on 2026-10-09 (copyright 이성민, repo captain1152/db-preflight, npm name db-preflight
  still `"private": true`); see `docs/publishing.md`. Integration CI job: PR + main (decided 2026-10-12).

## Pre-publication cleanup (2026-10-12)

The owner pushed `690d593` to the public repository `captain1152/db-preflight`.

First GitHub Actions run (run 38218442071, `690d593`): ubuntu Node 22/24 checks, Node 20.19 bundled runtime, Prisma
fixtures and PostgreSQL 16 + 18 integration **succeeded**; both Windows jobs **failed** at `pnpm test:package`. The same
failure reproduced locally under Git Bash: GNU tar reads `C:` in an absolute archive or `-C` path as a remote host.
The job log itself was not retrieved (needs authentication), so the CI cause is inferred.

A Codex review of the IR-009 … IR-015 fixes (3 plan-review rounds, approved) and two fresh-session inspections of the
resulting diff found further defects, fixed with regression tests in `tests/unit/inspection-regressions.test.ts` and
`tests/unit/discover.test.ts` (each new test except RV-001/RV-008 was run against the
previous sources and failed; RV-001 was reproduced against the previous code path). REV-001 and REV-002 were found by
the second (last budgeted) inspection; their fixes have **not** been independently inspected:

| ID | Fix |
|---|---|
| RV-001 / RV-008 | Live worker stderr: secrets (incl. the parsed password) redacted before truncation; nothing shown if stderr overflowed the 64 KiB collection limit. |
| RV-002 | Snapshots accept repeated referencing FK columns (`child(a, a) -> parent(x, y)`, allowed by PostgreSQL); referenced columns must still be distinct. |
| RV-003 | Snapshot gap scopes must be `*` or a requested schema; `--schemas` never drops an unrecognized gap. |
| RV-004 / RV-009 / INS-001 | Any blocking problem inside the datasource block (including an unclosed block at end of file) makes `relationMode` unknown (FK checks `unknown`, not `fk_missing`). |
| RV-005 | DBP004 uses any validated, enforced, non-PERIOD matching FK, independent of constraint names/order. |
| REV-001 | A repeated `relationMode` declaration is blocking and makes the relation mode unknown regardless of order. |
| REV-002 | Directory links with an excluded name (`node_modules`, `generated`, ...) are excluded, not "not followed"; other links still block. |
| RV-006 | `package-smoke`: tarball extracted with a drive-less relative path; `npm pack` destination quoted for `cmd.exe`. |

Local verification of this change (Windows 11, Node 24.15.0; supersedes the 2026-10-08 table where they overlap): `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm check:bundle`,
`pnpm test` 152 passed / 1 skipped (Windows symlink test), `pnpm test:package` 27/27 from Git Bash, from PowerShell and with `TEMP` containing a
space, `claude plugin validate --strict` (plugin and marketplace). `pnpm test:prisma` and `pnpm test:integration` were
**not run** locally in this change (Docker Desktop was stopped); CI ran both green on `690d593`.

Marketplace install check (Claude Code 2.1.296), isolated at **local scope** in a temporary project (user settings
unchanged, verified by byte comparison): `claude plugin marketplace add <repo> --scope local` →
`claude plugin install db-preflight@db-preflight --scope local` (status enabled, version 0.1.0) →
`claude -p "/db-preflight:scan demo" --allowedTools "Bash(node *)" "PowerShell(node *)" "Read"` explained the demo
report (exit 1 described as intended, DBP001 + DBP005 as one root cause) → uninstalled and removed; marketplace and
plugin lists identical to the initial state. The GitHub-hosted variant (`marketplace add captain1152/db-preflight`)
was not run.

## No user database was accessed

All live connections in this work went to disposable containers created by the test harness on 127.0.0.1 with
generated credentials. No `.env` file existed or was read; no environment variable values were printed.
