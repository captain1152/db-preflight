# Development

## Requirements

- Runtime of the built CLI: Node.js >= 20.19 (bundle target `node20`).
- Development: Node.js 22.12+ or 24 (Vitest 5 requirement), pnpm 12 (`packageManager` field), Docker for integration tests.
- No database of your own is needed or used. Never point tests at an existing database.

## Commands

| Command | What it does |
|---|---|
| `pnpm install --frozen-lockfile` | Install pinned dependencies (lifecycle scripts allowed only for esbuild, see `pnpm-workspace.yaml`). |
| `pnpm lint` | Biome lint + format check. |
| `pnpm typecheck` | `tsc --noEmit` (TypeScript 7, strict, erasable syntax only). |
| `pnpm build` | esbuild bundle → `dist/db-preflight.cjs` + license notices, copied into `plugins/claude/db-preflight/dist/`. |
| `pnpm test` | Unit + CLI e2e (e2e uses `dist/db-preflight.cjs`; run `pnpm build` first). |
| `pnpm test:integration` | Starts disposable `postgres:16.15-alpine` and `postgres:18.6-alpine` containers on 127.0.0.1 with random credentials (`DBP_PG_IMAGES` overrides). Skipped (reported as skipped) without Docker. |
| `pnpm test:prisma` | Runs pinned `prisma@7.10.0 validate` on fixtures in temp copies; checks the exact expected error. No DB. |
| `pnpm test:package` | Copies only the plugin directory / the `npm pack` tarball to temp folders with spaces and Korean characters and runs them without `node_modules`. |
| `pnpm check:bundle` | Fails if the committed plugin bundle differs from a fresh build. |
| `node scripts/gen-demo-data.mjs` | Regenerates `src/demo/data.ts` from fixtures (a unit test fails if stale). |
| `node scripts/regen-fixture-snapshots.ts` | Rebuilds snapshots of fixtures marked `"snapshotSource": "live"` from a disposable container (Node 24). |
| `node scripts/gen-prisma-semantics.mjs` | Regenerates `fixtures/prisma-semantics/*.prisma`. |

## Fixtures

Each `fixtures/<name>/` has `fixture.json` (expected exit code, expected check statuses, Prisma validate outcome),
the Prisma schema, `snapshot.json`, and `db.sql` (applied **only** inside the test containers). All data is synthetic.
Integration tests assert that the live snapshot of `db.sql` equals the committed `snapshot.json` on every tested
PostgreSQL version, that live and snapshot scans give identical check results, and that table data/definitions are
unchanged (fingerprinted through the container admin connection).

## Changing behaviour

When you change a rule, a CLI option, an exit code or the report/snapshot contract, update together:
`docs/rules.md`, `README.md`, `README.ko.md`, `schemas/*.schema.json`, the plugin skills, `CHANGELOG.md`, and the
tests. Run `pnpm build` and commit the plugin `dist/` (CI checks freshness).
