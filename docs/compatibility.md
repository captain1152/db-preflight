# Compatibility and sources

All entries were checked on **2026-10-08**.

## Supported and verified

| Component | Selected / tested | Status |
|---|---|---|
| Node.js | `engines: >=20.19.0`; developed and tested on 24.15.0 (Windows 11) | Windows verified locally; CI (`690d593`): Linux Node 22/24 checks and the bundled CLI on Node 20.19 passed; Windows CI: Node 24 passed on `60283ce`; Node 22 failed only at package smoke because of a Node 22 `fs.cpSync` non-ASCII path bug in the test script (fixed, re-run pending) |
| PostgreSQL | 16.15 and 18.6 (`postgres:16.15-alpine`, `postgres:18.6-alpine`) | verified by `pnpm test:integration` (local Docker) |
| PostgreSQL 14, 15, 17 | collector has version-specific queries (min 14) | **not verified**; not advertised as supported |
| Prisma ORM | schema semantics of **7.x**; fixtures validated with pinned `prisma@7.10.0` (dev only) | verified by `pnpm test:prisma` |
| Prisma 6 / 8 | not supported; schemas are evaluated as Prisma 7 PSL | not verified |
| Claude Code | 2.1.294 | `claude plugin validate` passed (author warning); local load: see publishing.md |

Note: npm's `latest` tag of `prisma` pointed to `8.0.0-rc.21` on the check date; the dev dependency is pinned to
`7.10.0` exactly.

## Facts used from official documentation

### Claude Code plugins
- https://code.claude.com/docs/en/plugins-reference (manifest reference) · https://code.claude.com/docs/en/plugins/create ·
  https://code.claude.com/docs/en/plugin-marketplaces · https://code.claude.com/docs/en/skills
- `.claude-plugin/plugin.json` requires only `name`; skills live in `skills/<name>/SKILL.md` and are invoked as
  `/plugin-name:skill-name`; `${CLAUDE_PLUGIN_ROOT}` is substituted in skill bodies (forward slashes on Windows) but
  is not an environment variable of the Bash tool.
- Marketplace plugins are copied to a cache; files outside the plugin directory are not copied → the CLI bundle is
  committed inside the plugin directory.
- `marketplace.json` requires `name`, `owner.name`, `plugins[].name`, `plugins[].source` (relative paths start with `./`).
- `claude --plugin-dir <dir>` loads a plugin for one session; `claude plugin validate <path>` validates.

### Prisma ORM 7
- https://www.prisma.io/docs/orm/v7/prisma-schema/data-model/relations/one-to-one-relations — 1:1 needs a unique
  constraint on the FK side; composite example uses `@@unique`.
- https://www.prisma.io/docs/orm/v7/prisma-schema/data-model/relations/relation-mode — `foreignKeys` (default for
  relational databases) or `prisma`.
- https://www.prisma.io/docs/orm/v7/prisma-schema/overview/location — multi-file schema folders via `prisma.config.ts`
  (not executed by db-preflight; pass `--schema`).
- https://www.prisma.io/docs/orm/v7/prisma-schema/data-model/multi-schema — `schemas` in the datasource, `@@schema`
  on models and enums; GA since 6.13.
- https://www.prisma.io/docs/guides/upgrade-prisma-orm/v7 — datasource `url` moved to `prisma.config.ts`.

### Measured with prisma@7.10.0 (not stated in the docs)
- 1:1 owner side accepts only `@unique/@id` (single field) or `@@unique/@@id` with exactly the relation fields in the
  same order; subset, superset and reordered lists → P1012 (`fixtures/prisma-semantics/manifest.json`).
- Newlines inside attribute argument lists, block attribute arrays and datasource arrays are syntax errors.
  db-preflight still parses them and emits `PSL_MULTILINE_REJECTED_BY_PRISMA` (warning).
- `@@unique(..., where: raw(...))` requires the `partialIndexes` preview feature.

### PostgreSQL
- https://www.postgresql.org/docs/current/sql-set-transaction.html — READ ONLY semantics and its limits,
  `transaction_read_only`, REPEATABLE READ snapshot.
- https://www.postgresql.org/docs/current/catalog-pg-constraint.html — `contype`, `conkey/confkey`, `condeferrable`,
  `convalidated`, `conindid`, PG18 `conenforced`, `conperiod`, `contype = 'n'`.
- https://www.postgresql.org/docs/current/catalog-pg-index.html — `indnkeyatts` vs `indnatts` (INCLUDE),
  `indexprs`, `indpred`, `indisvalid`, `indimmediate`, `indnullsnotdistinct` (15+).
- https://www.postgresql.org/docs/18/ddl-inherit.html — inheritance caveats (unique/FK not inherited; PG18 `NO INHERIT`).
- The pairing `conkey[i] ↔ confkey[i]` is not spelled out in the catalog docs; it is how PostgreSQL stores FKs and is
  verified by the integration tests (multi-column FK fixtures on 16 and 18).
