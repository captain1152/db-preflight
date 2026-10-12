# Plan review log (append-only)

## Setup (2026-10-08)

- Host / planner / builder: Claude Code 2.1.294 (this session, Opus 5.5). Reviewer: Codex CLI 0.160.0
  (model from Codex config; no explicit model requested, observed model not reported by CLI).
  Final inspector: a fresh Codex session.
- Plan: `docs/EXECUTION_PLAN.md`. Max plan rounds 5, fix rounds 2, inspection rounds 2. Inspection: on.
- Authorization: the user asked to plan **and implement** v0.1.0 locally; no publish/push/marketplace submission.
  Because implementation was explicitly requested to start immediately, low-risk groundwork (scaffolding,
  fixtures, parser) proceeded in parallel with review; review findings are applied to code as they arrive.
- Note: the user's Codex config enables the first-party `node_repl` MCP server (code-capable). It was not
  disabled (runner has no per-run switch; global config must not be changed). The repository contains no secrets.
- Runner artifacts are kept outside the checkout (session scratchpad).

## Round 1 — Codex — verdict REVISE

Plan SHA256 4b0af51e53dcbc55ef9ec9894a76774762aac1a6678200e6eec30815f95b0be2, session 01a11ac7-a1ff-7a11-9e90-c0391d5c381a.

| ID | Sev | Finding (summary) | Disposition |
|----|-----|-------------------|-------------|
| R1 | high | pg@8 treats `password: ''` (and other falsy options) as absent and falls back to `PG*` env and pgpass; plan's isolation claim was false. | **Accepted.** Verified in `pg/lib/connection-parameters.js` (`val()` truthiness) and `client.js` (`_getPassword` → pgpass). Plan now runs live collection in a worker child process with an allow-listed env, scrubs `PG*` in the worker, password as function, explicit `options`; hostile-env tests added to plan. |
| R2 | high | Ordinary `INHERITS` children are not covered by the parent's unique index; DBP002/DBP005 could pass wrongly. | **Accepted.** Collector/snapshot record inheritance; affected checks become `unknown`; partitioned tables remain supported. |
| R3 | medium | `--out <input> --force` could overwrite a Prisma input. | **Accepted.** Out path collision checks (realpath, case-insensitive, hard link, symlink, `.prisma` extension) even with `--force`. |
| R4 | medium | Multi-line `@relation(...)` is a syntax error in the pinned Prisma grammar; any P1012 would satisfy the proof. | **Accepted and reproduced** with prisma@7.10.0 (`This line is not a valid field or attribute definition`); also measured that multi-line block-attribute args and datasource arrays are rejected. Fixture made single-line; validation script now requires the specific 1:1 uniqueness message and rejects syntax errors; multi-line parsing moved to a parser-only fixture with a warning diagnostic. |

Full response preserved in runner artifact `review-r1/claudex-9e6z12sv/result.json` (outside checkout).

## Round 2 — Codex (resumed session) — verdict REVISE

Plan SHA256 8d113b3d0f5ce8a6a8e9f47eeb01e381e548613444fe81b95a305bd100e6dc60. R1–R4 confirmed addressed at plan level.
The runner printed its result then crashed on a cp949 console encoding error (`'\u2013'`); `result.json` was complete
(status completed, exit_code 0) and was read directly. Later runs set `PYTHONIOENCODING=utf-8`.

| ID | Sev | Finding | Disposition |
|----|-----|---------|-------------|
| R5 | medium | Inheritance guard omitted DBP006; PG18 `NOT NULL NO INHERIT` lets child rows with NULL appear through the parent. | **Accepted.** DBP006 is `unknown` for tables with ordinary inheritance children; PG18 integration fixture planned. |

## Round 3 — Codex (resumed session) — verdict APPROVED

Plan SHA256 5f14eedbad97bba56cf7eaa21c48245eec12c749d1e587dc36dbe11062903c99 (matches the file at approval time).
No findings. Reviewer limitations: approval covers the plan only; implementation was changing concurrently and was
not verified; no tests run by the reviewer. Approval check (`runner.py check`) run on the final plan — see PROGRESS.md.
Any later plan change requires another review; implementation deviations are recorded in PROGRESS.md and checked by
the final fresh-session inspection.

## Final inspection 1 — fresh Codex session 01a11b04-983d-75d2-bf27-c29406ec2862 — verdict REVISE

Builder: Claude (this session). Inspected a scratch copy of the working tree whose only commit is the original prompt
file (no commit was created in the user's repository). Reviewer limitations: static only; no tests or builds run.

| ID | Sev | Finding | Disposition |
|----|-----|---------|-------------|
| IR-001 | high | Unsupported `@relation` arguments stayed in field issues; relation checks still passed (exit 0 possible). | **Accepted.** All model/field issues are reported as blocking diagnostics; relation checks are `unknown` if either relation field has issues. Regression: owner and inverse side. |
| IR-002 | high | `--out --force` reopened the path with `w` after a long collection (link swap could truncate an input). | **Accepted.** Exclusive temp file + re-check + no-clobber `link` / atomic `rename`; never writes through an existing entry. Residual parent-directory swap documented. Regression test with a hard link. |
| IR-003 | medium | `conparentid <> 0` filter dropped partition-inherited FKs (leaf-partition models → false `fk_missing`). | **Accepted.** Keep inherited constraints, drop only referenced-side partition expansions. PG16/18 integration test (parent and leaf). |
| IR-004 | medium | PG18 PERIOD FKs treated as equality FKs (unsupported pass). | **Accepted.** `period` carried through collector/types/snapshot/schema; DBP004 `unknown` (`fk_period_not_supported`). PG18 integration + unit test. |
| IR-005 | medium | DBP003/DBP004 concluded absence from incomplete collections. | **Accepted.** Negative conclusions require complete metadata for the schema. Unit tests. |
| IR-006 | medium | Snapshot with `complete: true` and gaps was trusted. | **Accepted.** Rejected at the boundary; engine also treats any gap as incomplete. |
| IR-007 | medium | DbpError messages bypassed redaction (e.g. URL passed as `--schema`). | **Accepted.** Redaction at the final output boundary; `--schema` no longer echoed. E2E test. |
| IR-008 | medium | IPv6 brackets kept in host. | **Accepted.** Brackets stripped; unit test. IPv6 container connection not tested (Docker IPv6 not configured). |

Proof re-run after fixes: lint ok, typecheck ok, `pnpm test` 130 passed / 1 skipped, `pnpm test:integration`
26 passed / 3 skipped (PG16 skips two PG18-only tests; Docker placeholder), `pnpm test:package` 27/27,
`pnpm test:prisma` 17/17, `pnpm check:bundle` ok, `claude plugin validate` (plugin + marketplace) passed with the
author warning.

## Final inspection 2 — fresh Codex session 01a11e18-efdf-71b1-8ad3-3a52be467403 — verdict REVISE

IR-001 … IR-008 were not reopened. New findings (static review only; reviewer ran no tests):

| ID | Sev | Finding | Disposition |
|----|-----|---------|-------------|
| IR-009 | high | Unknown string escapes dropped the backslash silently (`é` → `u00e9`). | **Accepted.** PSL/JSON escapes incl. `\uXXXX`; undefined escapes are blocking parse errors. Unit test. |
| IR-010 | medium | Depth-limited / symlinked inputs were only listed as skipped; exit 0 possible. | **Accepted.** Blocking `SCHEMA_INPUT_NOT_READ` diagnostics (intentional exclusions are not gaps). Unit test. |
| IR-011 | medium | FK match used one-way pair membership (repeated pairs matched). | **Accepted.** Full pair multiset comparison; snapshots reject repeated FK columns; schema `uniqueItems`. Unit test. |
| IR-012 | medium | DBP004 asserted `fk_missing` toward an out-of-scope referenced table. | **Accepted.** Without a matching FK, an unresolved/out-of-scope/missing referenced table gives `unknown`. Unit test. |
| IR-013 | medium | Domain NOT NULL ignored (attnotnull only). | **Accepted.** Collector records domain-typed nullable columns; DBP006 `unknown`. Unit test (no container test for domains). |
| IR-014 | medium | Truncation before redaction could leak a secret prefix. | **Accepted.** Redact full strings, then truncate. Unit test. |
| IR-015 | medium | `--schemas` restriction kept `complete: false` caused only by excluded schemas. | **Accepted.** Completeness derived for the retained scope; unexplained incompleteness preserved. Unit test. |

Proof re-run after fixes: lint ok, typecheck ok, `pnpm test` 137 passed / 1 skipped, `pnpm test:integration`
26 passed / 3 skipped, `pnpm test:package` 27/27, `pnpm test:prisma` 17/17, `pnpm check:bundle` ok, plugin validate ok.

**Inspection budget (2 rounds) is exhausted.** The fixes for IR-009 … IR-015 were verified only by the builder's own
tests and have NOT been independently re-inspected.
