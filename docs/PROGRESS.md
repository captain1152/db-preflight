# Progress

Status legend: **DONE** = implemented and verified by a command that was actually run (result recorded);
**IMPL** = implemented, not independently verified; **NOT RUN** = verification not executed (reason given).

_Last updated: 2026-10-08._

## Status by step

| Step | Item | Status | Evidence |
|------|------|--------|----------|
| 1 | Environment check, execution plan, plan review | DONE | `docs/EXECUTION_PLAN.md`; Codex review: REVISE (R1–R4) → REVISE (R5) → **APPROVED** (round 3); `runner.py check` → "Approval matches the current plan." (`docs/PLAN-REVIEW-LOG.md`) |
| 2 | P1012 composite fixture + Prisma 7.10.0 semantics spike + ADR | DONE | `pnpm test:prisma` → 17/17; ADR 0001 |
| 2 | Tokenizer / parser / model / relation resolution | DONE | `tests/unit/parser.test.ts`, `discover.test.ts` |
| 3 | Rule engine DBP001–006, report, reporters, CLI, demo | DONE | `tests/unit/engine.test.ts`, `reporters-demo.test.ts`, `contract.test.ts`, `tests/e2e/cli.test.ts` |
| 4 | Collector, worker isolation, snapshot contract, PG 16/18 integration | DONE | `pnpm test:integration` → 26 passed, 3 skipped (see below) |
| 5 | Bundle, plugin, marketplace, package smoke | DONE | `pnpm test:package` → 27/27; `pnpm check:bundle`; `claude plugin validate` (both pass, 1 author warning) |
| 5 | Real Claude Code load of both skills | DONE | see "Claude load check" |
| 6 | Docs (EN/KO), AGENTS/CLAUDE, community files, CI workflow, checklist | DONE (written) | CI workflow **NOT RUN** on GitHub (nothing pushed) |
| — | Final independent inspection (fresh Codex sessions) | 2 rounds used (REVISE → 8 fixed; REVISE → 7 fixed) | Fixes for IR-009…IR-015 not independently re-inspected (budget exhausted) |

## Verification commands run locally (Windows 11, Node 24.15.0, pnpm 12.9.1, Docker 29.5.3)

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

### Claude load check

In a temp project folder: `claude -p "/db-preflight:scan demo" --plugin-dir <abs>/plugins/claude/db-preflight
--allowedTools "Bash(node *)" "PowerShell(node *)" "Read"` → the skill ran the bundled CLI and explained the report
(mismatch, DBP001+DBP005 as one root cause, exit 1 described as intended, unknown/coverage stated).
`claude -p "/db-preflight:explain ./report.json" --plugin-dir ... --allowedTools "Read"` → explained an existing
report (21 unknown checks reported as not evaluated). This shows the skills load and work once; it is not a guarantee
that a model always follows skill policies. `claude plugin marketplace add/install` were **not run** (would change the
user's Claude configuration).

## Not done / known limitations

- GitHub Actions has never run (no push). Linux and Node 20/22 are configured in CI but only Windows + Node 24 was
  executed locally.
- PostgreSQL 14, 15, 17 not verified (collector accepts ≥ 14).
- Partial unique indexes, expression indexes, exclusion constraints, deferrable keys, implicit many-to-many join
  tables, views and ordinary inheritance are reported as `unknown`, not evaluated.
- Column types, defaults, CHECK constraints, triggers, RLS and row data are not checked.
- `--default-schema` must be given for models without `@@schema`; the Prisma 7 `prisma.config.ts` is never read.
- Owner decisions filled in on 2026-10-09 (copyright 이성민, repo captain1152/db-preflight, npm name db-preflight
  still `"private": true`); see `docs/publishing.md`. Remaining: integration CI job scope.

## No user database was accessed

All live connections in this work went to disposable containers created by the test harness on 127.0.0.1 with
generated credentials. No `.env` file existed or was read; no environment variable values were printed.
