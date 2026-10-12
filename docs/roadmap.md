# Roadmap

Not commitments; v0.1.0 deliberately stays small.

## Codex (and other agent) adapters — boundary only

The diagnostic contract is the CLI plus the versioned JSON report (`schemas/report.schema.json`). An adapter for
Codex or another agent should:

- invoke the same bundled CLI (never re-implement rules or "diagnose" in prompts);
- consume `--format json` and treat `status`, `severity`, `unknown` and evidence as read-only facts;
- keep the same live-scan consent rules (explicit `--live` + `--schemas`, credentials only via an environment
  variable name, no `.env` loading, no printing of secrets);
- ship the bundle inside its own distributable unit if its installer copies only that unit.

No Codex adapter code exists in v0.1.0.

## Candidate next steps

1. Verify PostgreSQL 14, 15 and 17 in CI and add them to the support table.
2. Evaluate partial unique indexes (`where:` + `indpred`) instead of reporting `unknown`.
3. Implicit many-to-many join-table checks (`_AToB`, `A`/`B` columns, unique pair).
4. Optional `--prisma-config` reader that parses (never executes) a static `prisma.config.ts` schema path.
5. Column type comparison (`@db.*` vs `format_type`).
