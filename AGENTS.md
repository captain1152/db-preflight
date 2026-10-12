# AGENTS.md — rules for humans and AI agents working on this repository

## Non-negotiable safety rules

1. Never connect to any existing/shared/production database while developing or testing. The only allowed database
   is the disposable container created by `tests/integration/pg-harness.ts` (or `scripts/regen-fixture-snapshots.ts`).
2. Never read, use or print `.env` files, `DATABASE_URL`, `PG*` variables, passwords, tokens or full environment dumps.
3. The product must not gain: SQL input, query extension points, an SQL-executing MCP server, migrations, DDL/DML,
   auto-fixes, `prisma db pull/push/migrate/generate/format`, or execution of `prisma.config.*`/project scripts.
4. Never make P1012 "go away" by adding uniqueness or changing relations; findings offer conditional options only.
5. Unsupported syntax or incomplete metadata must produce `unknown` (exit 3), never a pass.
6. Do not publish: no `npm publish`, `git push`, releases or marketplace submissions without explicit owner approval.
7. Do not report tests as passed unless you ran them; report skipped tests as skipped.

## Commands

```
pnpm install --frozen-lockfile
pnpm lint && pnpm typecheck
pnpm build                 # also refreshes plugins/claude/db-preflight/dist (commit it)
pnpm test                  # unit + e2e (needs a build)
pnpm test:package          # artifacts without the checkout/node_modules
pnpm test:prisma           # pinned prisma@7.10.0 validate on fixtures (no DB)
pnpm test:integration      # Docker; PostgreSQL 16 and 18 containers
pnpm check:bundle
```

## Layout

`src/core` (types, engine, report), `src/prisma` (parser), `src/postgres` (fixed queries, collector, worker,
snapshot), `src/reporters`, `src/safety`, `src/cli`, `src/demo` (generated), `plugins/claude/db-preflight`,
`fixtures/` (synthetic only), `tests/{unit,e2e,integration}`, `schemas/`, `docs/`.

## Keep documentation in sync

A change to rules, CLI options, exit codes, the report/snapshot contract or plugin behaviour must update, in the same
change: `docs/rules.md`, `README.md`, `README.ko.md`, `schemas/*.json`, plugin `SKILL.md` files, `CHANGELOG.md`,
tests, `src/demo/data.ts` (via `node scripts/gen-demo-data.mjs`) and the committed plugin bundle (`pnpm build`).
New SQL must be added to `src/postgres/queries.ts` only, schema-qualified, parameter-bound, catalog-only.
