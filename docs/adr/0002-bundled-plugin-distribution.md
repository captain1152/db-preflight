# ADR 0002 — Commit a bundled CLI inside the Claude plugin directory

Status: accepted (2026-10-08)

## Context

Claude Code copies marketplace plugins into a cache and does not copy files outside the plugin directory. The skills
must run the shared CLI, not re-implement diagnostics, and must not fetch packages with `npx` at run time.

## Decision

Bundle the CLI and its only runtime dependency (`pg`) with esbuild into one CommonJS file and place it, with
`THIRD_PARTY_LICENSES.txt` and `LICENSE`, in `plugins/claude/db-preflight/dist/`. This directory is committed.
`pnpm check:bundle` (CI) rebuilds and fails on any byte difference. `.gitattributes` disables line-ending conversion
for it. The npm package ships the same bundle.

## Consequences

- The plugin works from any copy of its directory with only Node.js >= 20.19 (verified by `pnpm test:package`).
- Generated code lives in git; reviews must ignore `dist/` diffs and rely on the freshness check.
- A single package keeps core/adapters/CLI separated by folders without a multi-package build.
