# DB Preflight v0.1.0 — Execution Plan

Source requirements: `DB_PREFLIGHT_CLAUDE_OPUS_5_5_PROMPT.md` (repo root). This plan is the
implementation contract; `docs/PROGRESS.md` tracks status.

## 1. Goal and acceptance criteria

Build a working, locally verified open-source CLI + Claude Code plugin that compares a Prisma ORM 7
schema (including schemas that fail `prisma validate` with P1012) with PostgreSQL catalog metadata
(live, read-only, or from a versioned snapshot) and reports evidence-backed findings for six rules.

Observable acceptance (each must be produced by a real command run, results logged in PROGRESS.md):

| # | Criterion | Proof |
|---|-----------|-------|
| A1 | `pnpm install --frozen-lockfile && pnpm build` succeeds | command exit 0 |
| A2 | `node dist/db-preflight.cjs demo` prints DBP001+DBP005 linked finding, exit **1**; `demo --format json` emits exactly one JSON doc on stdout | e2e test + manual run |
| A3 | healthy fixture → 0, mismatch fixture → 1, bad input → 2, required unknown → 3 | e2e tests |
| A4 | Parser reads the P1012 composite 1:1 fixture with models/fields/relations/spans; pinned `prisma@7.10.0 validate` reproduces the error on the same fixture (test-only) | unit test + `pnpm test:prisma` |
| A5 | multi-file, multi-schema, `@map/@@map` fixture handled | unit + e2e |
| A6 | Live collector against disposable Docker PostgreSQL 16 and 18 with a no-table-SELECT metadata role; snapshot/live parity; only allow-listed SQL executed; read-only verified; ambient `DATABASE_URL` ignored | `pnpm test:integration` |
| A7 | Plugin dir copied alone to a temp folder with spaces (no repo, no node_modules) runs demo and offline scan; `npm pack` tarball extracted runs demo | `pnpm test:package` |
| A8 | `claude plugin validate` passes for plugin and marketplace; local `--plugin-dir` load attempted and reported honestly | command output |
| A9 | Redaction tests (encoded passwords, nested errors), malicious identifiers/snapshot inputs, ANSI/Markdown escaping | unit tests |
| A10 | Prisma file hashes identical before/after scan | e2e test |

## 2. Environment (checked 2026-10-08)

Windows 11, PowerShell 5.1 + Git Bash, Node 24.15.0, npm 11.12.1, pnpm 12.9.1, git 2.54,
Docker 29.5.3 (Desktop was stopped; started locally for test containers), Python 3.14 via `py`,
Claude Code 2.1.294, Codex CLI 0.160.0. Not a git repo initially; only the prompt file existed.
No user DB connection strings are read; no `.env` exists or is loaded.

## 3. Key decisions (conservative defaults)

- **Single package** `db-preflight` (TypeScript strict, ESM source, Node >= 20.19). Boundaries by folder:
  `src/core` (model types, rules, report), `src/prisma` (discovery, tokenizer, parser, resolver),
  `src/postgres` (fixed catalog queries, connection, snapshot validation), `src/cli`, `src/reporters`,
  `src/safety`, `src/demo`.
- **Dependencies:** runtime `pg@8` only (bundled). Dev: typescript, vitest, esbuild, @biomejs/biome (lint+format,
  one dep), @types/*, `prisma@7.10.0` (fixture validation only; `latest` tag is 8.0.0-rc so pin exactly).
  CLI parsing uses `node:util.parseArgs`; snapshot validation is hand-written (no zod/ajv).
- **Parser:** own tokenizer + structural recursive parser for a declared PSL subset (no regex-whole-file parsing,
  no dependency on Prisma WASM/getDMMF so P1012 inputs are analyzable). Unknown constructs become located
  diagnostics that make dependent checks `unknown`, never silently dropped. Spike recorded in ADR-0001.
- **Relation resolution:** group relation fields by unordered model pair + relation name; exactly two fields →
  relation; owner = side with `fields/references`; 1:1 when the non-owner side is not a list. One field,
  >2 fields, both/neither owner (except implicit m:n, which is `not_applicable`) → ambiguous → `unknown`.
- **Default DB schema:** never assumed. Model schema = `@@schema` else `--default-schema` else unknown
  (Prisma 7 keeps the URL in `prisma.config.ts`, which we refuse to execute).
- **relationMode:** `prisma`/`foreignKeys` from datasource; absent in a found `datasource` block → documented
  default `foreignKeys`; no datasource block at all → unknown.
- **Uniqueness semantics (DB):** a guarantee for column set F exists iff some PK/UNIQUE constraint or unique
  index with key columns K ⊆ F is: non-partial, non-expression, valid/ready, immediate, non-deferrable,
  not WITHOUT OVERLAPS. INCLUDE columns are excluded from K. Candidates that would cover F but have
  unsupported semantics (partial/expression/invalid/deferrable/period) → `unknown` instead of `fail`.
  Nullable FK columns: guarantee applies to non-null references (stated in evidence).
  Ordinary (non-partition) table inheritance (review R2): rows of `INHERITS` children are visible through the
  parent but are not covered by the parent's unique indexes or FKs. The collector records
  `inheritance.{isPartition, hasInheritanceChildren, inheritsFrom}` per table (live + snapshot); DBP002/DBP004/
  DBP005 **and DBP006** (review R5: PostgreSQL 18 `NOT NULL NO INHERIT` lets child rows visible through the parent
  hold NULLs) for a table with ordinary inheritance children are `unknown`. A PG18-only integration fixture covers
  `NOT NULL NO INHERIT` + nullable child column. Declarative partitioning (`relkind p`)
  is supported because PostgreSQL enforces unique constraints across partitions (they must include the key).
- **Prisma uniqueness (DBP001):** accepted declarations (single `@id`/`@unique`, `@@id`/`@@unique` whose field set
  equals the relation fields, or subset — to be confirmed against pinned Prisma 7.10.0 with fixture variants;
  the result is recorded in ADR-0001 and the rule follows the observed v7 behavior).
- **Exit codes:** 2 (no valid result) > 1 (any fail; coverage incompleteness still shown) > 3 (any required
  unknown, incl. blocking parse diagnostics/incomplete collection) > 0.
- **Finding grouping:** findings carry `groupId` (`relation:<Model>.<field>`) and `relatedFindingIds`; DBP005
  caused by the same relation as DBP001/DBP002 is linked, not presented as an independent root cause.
- **Live connection:** env var *name* only (`--db-url-env`, default `DB_PREFLIGHT_DATABASE_URL`, validated
  `^[A-Za-z_][A-Za-z0-9_]*$`). URL parsed by us; host, port, database and user must be explicit (missing → exit 2).
  pg@8 falls back to `PG*` variables for any falsy option (incl. `password: ''`, `options`, `binary`,
  `replication`, `client_encoding`, `sslnegotiation`) and to pgpass for a null password (review R1, verified in
  `pg/lib/connection-parameters.js` and `client.js`). Therefore the CLI performs live collection in a dedicated
  **worker child process** (same bundle, hidden `__live-worker` command) spawned with an allow-listed minimal
  environment (no `PG*`, `DATABASE_URL`, `HOME`, `APPDATA`; only OS essentials such as `SystemRoot`); the URL and
  options are sent over stdin, never argv/env. The worker additionally deletes any `PG*` variables from its own
  `process.env` before loading pg, passes the password as a function returning the parsed value, and sets
  `options` to `-c default_transaction_read_only=on`. Tests run the CLI with hostile `PGPASSWORD`, `PGPASSFILE`,
  `PGOPTIONS`, `PGREPLICATION`, `PGBINARY`, `PGHOST`, `DATABASE_URL` set. Allowed query
  params: `sslmode` (disable|require|verify-ca|verify-full; `require` treated as verify-full), `sslrootcert`,
  `schema` (ignored, informational); anything else → exit 2 naming the parameter only. TLS: remote hosts default
  to verified TLS; loopback hosts default to no TLS; `sslmode=disable` on remote is honored with a stderr warning.
- **Live session:** `BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY`; `SET LOCAL search_path = pg_catalog, pg_temp`;
  verify `transaction_read_only = on`; reject `rolsuper`; schema-qualified catalog objects; schema filter bound as
  `$1::pg_catalog.text[]`; queries identified by allow-list IDs (version-specific variants for PG < 15, PG >= 18);
  connect/statement/query/idle-in-transaction timeouts + overall deadline; `ROLLBACK` + `end()` in `finally`.
  Server < 14 → snapshot `complete:false` (unknown), not a guess. No row reads, COUNT, EXPLAIN, temp tables, COPY.
- **Snapshot contract** `snapshotVersion: 1`, hand-validated, size-limited, same normalized `DatabaseModel` as
  live; records server version, `collectedAt`, requested scope, completeness and per-scope failures, other
  relation kinds (view/matview/foreign) so a Prisma model mapped to a view is `unknown`, not "missing".
- **Report contract** `reportVersion: 1` + JSON Schema files in `schemas/`; deterministic ordering; volatile
  fields (`generatedAt`, timings) isolated; stable finding IDs (`DBPxxx-<sha256(subject)[:10]>`).
- **Output safety:** identifiers/paths treated as untrusted; control chars/ANSI stripped in text; Markdown escaped
  with inline-code fences sized to content; secrets redacted from every error path (URL userinfo, `password=`,
  percent-encoded variants, nested `cause`/`errors`).
- **File input:** `--schema` file or directory; deterministic recursive walk (byte-order sorted POSIX relative paths),
  skip `node_modules`, `.git`, `dist`, `build`, `out`, `coverage`, `.next`; symlinks not followed (reported);
  limits 500 files / 5 MiB per file / 20 MiB total; read-only access; evidence uses paths relative to input root.
- **`--out`:** exclusive create (`wx`) unless `--force`; stdout then stays empty, summary goes to stderr.
  Even with `--force` (review R3) the destination is rejected (exit 2, inputs untouched) if it has a `.prisma`
  extension, or resolves — after `realpath` of its parent, case-insensitive on Windows/macOS — to any discovered
  Prisma file or the input snapshot, or is an existing file sharing `dev`+`ino` with one (hard link), or is a symlink.
- **Prisma 7 grammar facts (measured with prisma@7.10.0, review R4):** newlines are not allowed inside attribute
  argument lists, block-attribute arrays or datasource arrays (`This line is not a valid field or attribute
  definition`). The db-preflight parser still reads such multi-line constructs (tolerant), but emits a non-blocking
  `PSL_MULTILINE_REJECTED_BY_PRISMA` warning. The P1012 acceptance fixture is single-line so that `prisma validate`
  fails **only** with "A one-to-one relation must use unique fields on the defining side"; the validation script
  checks the expected message per fixture and rejects syntax errors. Multi-line parsing lives in a separate
  parser-only fixture. The `healthy` fixture is the same model with the exact `@@unique` added and must validate.
  Prisma 7.10.0 accepts only an `@@unique`/`@@id` whose field list equals the relation fields **in the same order**
  (or `@unique`/`@id` for a single field); subset, superset and reordered declarations are rejected — DBP001 follows
  this, while DB-side checks (DBP002/DBP005) use set semantics with the subset rule.
- **Distribution:** esbuild bundles CLI + pg into one CJS file `dist/db-preflight.cjs` (externals: `pg-native`,
  `pg-cloudflare`, `cloudflare:sockets`), copied with `LICENSE` + `THIRD_PARTY_LICENSES.txt` into
  `plugins/claude/db-preflight/dist/`, which is **committed** (not gitignored) because marketplace installs copy
  only the plugin dir. CI rebuilds and fails if the committed bundle differs. npm package `files` = `dist`,
  `schemas`, docs; package name/ownership left for the user (no publish).
- **Plugin:** `.claude-plugin/plugin.json` (name/version/description/license/keywords only — no fabricated
  author/repo), skills `scan` and `explain` invoking `node "${CLAUDE_PLUGIN_ROOT}/dist/db-preflight.cjs"`;
  no hooks/MCP. Root `.claude-plugin/marketplace.json` with `source: "./plugins/claude/db-preflight"`, owner
  placeholder documented in `docs/publishing.md`.

## 4. Non-goals (v0.1.0)

Other DBs/ORMs/Prisma majors, auto-fix, migrations, SQL execution features, MCP server, hooks, telemetry,
LLM calls, executing `prisma.config.*`, `.env` loading, data-level duplicate detection, npm publish/push/marketplace
submission, Codex adapter (roadmap only).

## 5. Implementation order

1. Scaffolding: package.json, tsconfig, biome, vitest, .gitignore, lockfile.
2. Fixtures (`fixtures/*`, all synthetic) incl. `composite-one-to-one-mismatch` ([organization_id, month,
   snapshot_id]), Prisma 7.10.0 validate script; tokenizer/parser/resolver + unit tests; ADR-0001.
3. Core model, six rules, report builder, reporters, snapshot validator, CLI (`scan --snapshot`, `demo`), e2e tests.
4. Postgres collector + Docker harness (`scripts/pg-test-env.mjs`, admin vs `dbp_meta` role) + integration tests on 16 and 18.
5. Bundle build, plugin files, marketplace, package smoke test (temp dir with spaces), `claude plugin validate`, local load attempt.
6. Docs (EN README + README.ko.md + docs/*), AGENTS.md/CLAUDE.md, community files, GitHub Actions
   (ubuntu+windows unit/CLI/package; ubuntu PG16/18 integration; bundle freshness), pre-publication checklist.

## 6. Verification commands

```
pnpm install --frozen-lockfile
pnpm lint && pnpm typecheck
pnpm test            # unit + e2e (offline)
pnpm build
pnpm test:package    # isolated bundle/plugin/npm-pack smoke
pnpm test:prisma     # pinned prisma@7.10.0 validate on fixtures (no DB)
pnpm test:integration  # needs Docker; disposable postgres:16 / postgres:18
claude plugin validate plugins/claude/db-preflight ; claude plugin validate .
```

Skipped/unavailable steps are recorded as such in PROGRESS.md; never counted as passed.

## 7. Risks

- Prisma 7 acceptance of subset uniqueness for 1:1 is not documented in prose → determined empirically (ADR-0001).
- `${CLAUDE_PLUGIN_ROOT}` uses forward slashes on Windows; skills must quote it. Actual skill behavior depends on
  the model; tests verify files/bundle, not model compliance.
- PostgreSQL 18 catalog additions (`conenforced`, `conperiod`, `contype='n'`) handled by versioned queries.
- Docker availability in CI vs locally; Windows CI runs offline suites only.
