# Architecture

Single npm package, folders as boundaries (no multi-package split; see ADRs for the reasons behind the parser and
distribution choices).

```
Prisma files ──discover──> tokenizer ──> parser (AST + spans) ──> model builder ──> PrismaSchemaModel
                                                                 (attributes, mapping, relation resolution)
pg_catalog (live, worker process) ──> collector ──┐
snapshot JSON (validated)          ───────────────┴──> DatabaseModel
PrismaSchemaModel + DatabaseModel ──> rule engine (pure) ──> checks / findings / groups ──> Report
Report ──> text | JSON | Markdown reporters
Claude skills ──> same bundled CLI ──> JSON report ──> explanation
```

| Folder | Responsibility |
|---|---|
| `src/core` | Shared types (`types.ts`), report contract (`report-types.ts`), rule engine (`engine.ts`), DB uniqueness semantics (`uniqueness.ts`), rule metadata, report builder. No I/O. |
| `src/prisma` | Read-only discovery with limits, tolerant tokenizer/parser with source spans, normalization, relation resolution. Never calls Prisma. |
| `src/postgres` | Fixed query allow-list, catalog collector, URL parsing, worker isolation, snapshot contract. |
| `src/reporters` | Text, Markdown (JSON is `JSON.stringify` of the report). |
| `src/safety` | Redaction and output escaping. |
| `src/cli` | Argument parsing (`node:util.parseArgs`), exit codes, guarded `--out`. |
| `src/demo` | Generated from fixtures (`scripts/gen-demo-data.mjs`); checked for staleness by a unit test. |
| `plugins/claude/db-preflight` | Manifest, two skills, committed `dist/` bundle + licenses. |

Determinism: files are processed in byte order of their relative POSIX paths; checks are sorted by rule and subject;
finding ids are `ruleId-sha256(subject)[:10]`; `generatedAt` and `collectedAt` are the only time values.

Runtime dependency: `pg@8` (bundled by esbuild into `dist/db-preflight.cjs`). Everything else is Node built-ins.
