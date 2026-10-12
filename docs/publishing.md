# Publishing

The owner pushed the repository to the public GitHub repository `captain1152/db-preflight` (commit `690d593`). No npm
release, tag or Anthropic directory submission has been made. This page lists what was verified and what remains.

## Distribution strategy

- **CLI**: one bundled file `dist/db-preflight.cjs` (pg bundled; no runtime dependencies). npm `files` contain the
  bundle, license notices, JSON schemas, READMEs, LICENSE, CHANGELOG. `"private": true` in `package.json` prevents an
  accidental `npm publish` until the owner removes it.
- **Claude plugin**: `plugins/claude/db-preflight/` is self-contained. Its `dist/` (bundle + `THIRD_PARTY_LICENSES.txt`
  + `LICENSE`) is **committed**, because marketplace installs copy only the plugin directory into a cache; paths such
  as `../../src` would not exist there. CI (`pnpm check:bundle`) fails if the committed bundle is stale.
- **Marketplace**: `.claude-plugin/marketplace.json` at the repository root lists the plugin with
  `"source": "./plugins/claude/db-preflight"`.

## Verification status (2026-10-12)

| Item | Status |
|---|---|
| `claude plugin validate --strict plugins/claude/db-preflight` | passed, no warnings or advice |
| `claude plugin validate .` (marketplace) | passed |
| Plugin dir copied alone to a temp path with spaces/Korean, demo + offline scans, PowerShell | verified (`pnpm test:package`) |
| `npm pack` tarball extracted elsewhere, demo without `node_modules` | verified (`pnpm test:package`) |
| Local load with `claude --plugin-dir` and invoking the skills | see "Claude load check" below |
| `claude plugin marketplace add` / `claude plugin install` from the local checkout | verified at local scope in a temporary project, then removed (see `docs/PROGRESS.md`) |
| GitHub-hosted marketplace (`claude plugin marketplace add captain1152/db-preflight`) | **not verified** |
| GitHub Actions | `690d593`: Windows package smoke failed (GNU tar paths); `60283ce`: only Windows Node 22 package smoke failed (Node 22 `cpSync` with non-ASCII paths); both fixed in the test script, re-run pending push |

### Claude load check

Recorded in `docs/PROGRESS.md` with the exact command and outcome.

## Decisions required from the owner

Decided on 2026-10-09:

- Copyright holder: 이성민 (`LICENSE`, rebuilt into `plugins/claude/db-preflight/dist/LICENSE`).
- GitHub repository: `captain1152/db-preflight` (`git remote add origin git@github.com:captain1152/db-preflight.git`;
  pushed by the owner). `repository`, `homepage`, `bugs`, `author` set in `package.json` and `plugin.json`.
- Marketplace owner: `captain1152`; marketplace name `db-preflight`.
- npm package name: `db-preflight` (unscoped). On 2026-10-09 `npm view db-preflight` returned 404 (not taken);
  npm may still reject it as too similar to an existing name, which is only known at publish time. Fallback:
  `@captain1152/db-preflight` (needs `--access public`). `"private": true` stays until publishing is intended.
- Security contact: GitHub private vulnerability reporting (enable it in the repository settings after creation).

Decided on 2026-10-12:

- The PostgreSQL integration job runs on every PR and on pushes to main (GitHub's ubuntu runners provide Docker).
- Internal process documents (original task prompt, execution plan, review log) are kept locally and are not
  tracked; they remain in the history of `690d593` (no history rewrite; they contain no secrets).

## Pre-publication checklist

- [ ] Owner decisions above filled in; `pnpm build` re-run so `plugins/claude/db-preflight/dist/LICENSE` matches.
- [ ] `git status` clean; no `.env`, real snapshots, reports or logs tracked (`git ls-files | grep -Ei "snapshot|report|\.env"` shows only fixtures/examples).
- [ ] `pnpm install --frozen-lockfile && pnpm lint && pnpm typecheck && pnpm build && pnpm test && pnpm test:package && pnpm check:bundle`.
- [ ] `pnpm test:prisma` and `pnpm test:integration` pass (Docker).
- [ ] CI green on Linux and Windows (Windows Node 22 package smoke fix pending push).
- [ ] `claude plugin validate plugins/claude/db-preflight` and `claude plugin validate .` pass.
- [ ] Manual: `claude --plugin-dir ./plugins/claude/db-preflight`, run `/db-preflight:scan demo` and `/db-preflight:explain <report>`.
- [ ] README examples regenerated from the current build (`docs/examples/`), no unmeasured numbers or badges.
- [ ] `CHANGELOG.md` dated; version consistent in `package.json`, `plugin.json`, CLI `--version`.
- [ ] Dependency licenses reviewed (`dist/THIRD_PARTY_LICENSES.txt`: MIT/ISC only at the time of writing).
- [ ] Then, and only then: push, tag, publish to npm, submit/announce the marketplace.

## Marketplace routes

1. **Own GitHub marketplace** (prepared). `.claude-plugin/marketplace.json` lists the plugin; anyone can install from the
   public repository with `claude plugin marketplace add captain1152/db-preflight` and
   `claude plugin install db-preflight@db-preflight` (or `/plugin install db-preflight --marketplace
   captain1152/db-preflight` inside Claude Code 2.1.275+). Because `plugin.json` sets `version`, every release after the
   first tag must bump it, or `claude plugin update` keeps the old copy. Version policy (owner, 2026-10-12): `690d593`
   was pushed untagged and unannounced with version 0.1.0; the first tag `v0.1.0` goes on the corrected commit, so an
   install of `690d593` (if any) does not receive the fixes through `claude plugin update` and must be reinstalled.
2. **Anthropic directory** (not submitted). Submission goes through the developer portal at
   <https://claude.ai/directory/manage> (paid claude.ai plan) after `claude plugin validate --strict` and the
   pre-submission checklist on claude.com. The skills run a local `node` binary and read a local environment variable,
   so the plugin is effectively Claude Code-only; check the component support table before submitting. The official
   `claude-plugins-official` marketplace does not take portal submissions.
