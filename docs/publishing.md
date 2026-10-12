# Publishing (not done — preparation only)

Nothing has been published: no npm release, no GitHub push, no marketplace submission. This page lists what was
verified locally and what the owner must decide before any publication.

## Distribution strategy

- **CLI**: one bundled file `dist/db-preflight.cjs` (pg bundled; no runtime dependencies). npm `files` contain the
  bundle, license notices, JSON schemas, READMEs, LICENSE, CHANGELOG. `"private": true` in `package.json` prevents an
  accidental `npm publish` until the owner removes it.
- **Claude plugin**: `plugins/claude/db-preflight/` is self-contained. Its `dist/` (bundle + `THIRD_PARTY_LICENSES.txt`
  + `LICENSE`) is **committed**, because marketplace installs copy only the plugin directory into a cache; paths such
  as `../../src` would not exist there. CI (`pnpm check:bundle`) fails if the committed bundle is stale.
- **Marketplace**: `.claude-plugin/marketplace.json` at the repository root lists the plugin with
  `"source": "./plugins/claude/db-preflight"`.

## Verification status (2026-10-08)

| Item | Status |
|---|---|
| `claude plugin validate plugins/claude/db-preflight` | passed with 1 warning (no `author`, intentionally left for the owner) |
| `claude plugin validate .` (marketplace) | passed with the same warning |
| Plugin dir copied alone to a temp path with spaces/Korean, demo + offline scans, PowerShell | verified (`pnpm test:package`) |
| `npm pack` tarball extracted elsewhere, demo without `node_modules` | verified (`pnpm test:package`) |
| Local load with `claude --plugin-dir` and invoking the skills | see "Claude load check" below |
| `claude plugin marketplace add` / `claude plugin install` | **not run** (would change the user's Claude configuration) |
| GitHub-hosted marketplace (`/plugin marketplace add owner/repo`) | **not verified** (nothing pushed) |

### Claude load check

Recorded in `docs/PROGRESS.md` with the exact command and outcome.

## Decisions required from the owner

Decided on 2026-10-09:

- Copyright holder: 이성민 (`LICENSE`, rebuilt into `plugins/claude/db-preflight/dist/LICENSE`).
- GitHub repository: `captain1152/db-preflight` (`git remote add origin git@github.com:captain1152/db-preflight.git`;
  nothing pushed). `repository`, `homepage`, `bugs`, `author` set in `package.json` and `plugin.json`.
- Marketplace owner: `captain1152`; marketplace name `db-preflight`.
- npm package name: `db-preflight` (unscoped). On 2026-10-09 `npm view db-preflight` returned 404 (not taken);
  npm may still reject it as too similar to an existing name, which is only known at publish time. Fallback:
  `@captain1152/db-preflight` (needs `--access public`). `"private": true` stays until publishing is intended.
- Security contact: GitHub private vulnerability reporting (enable it in the repository settings after creation).

Still open:

1. Whether to enable the PostgreSQL integration job on every PR or only on main (it needs Docker on the runner).

## Pre-publication checklist

- [ ] Owner decisions above filled in; `pnpm build` re-run so `plugins/claude/db-preflight/dist/LICENSE` matches.
- [ ] `git status` clean; no `.env`, real snapshots, reports or logs tracked (`git ls-files | grep -Ei "snapshot|report|\.env"` shows only fixtures/examples).
- [ ] `pnpm install --frozen-lockfile && pnpm lint && pnpm typecheck && pnpm build && pnpm test && pnpm test:package && pnpm check:bundle`.
- [ ] `pnpm test:prisma` and `pnpm test:integration` pass (Docker).
- [ ] CI green on Linux and Windows (first CI run happens only after pushing; it has not run yet).
- [ ] `claude plugin validate plugins/claude/db-preflight` and `claude plugin validate .` pass.
- [ ] Manual: `claude --plugin-dir ./plugins/claude/db-preflight`, run `/db-preflight:scan demo` and `/db-preflight:explain <report>`.
- [ ] README examples regenerated from the current build (`docs/examples/`), no unmeasured numbers or badges.
- [ ] `CHANGELOG.md` dated; version consistent in `package.json`, `plugin.json`, CLI `--version`.
- [ ] Dependency licenses reviewed (`dist/THIRD_PARTY_LICENSES.txt`: MIT/ISC only at the time of writing).
- [ ] Then, and only then: push, tag, publish to npm, submit/announce the marketplace.
