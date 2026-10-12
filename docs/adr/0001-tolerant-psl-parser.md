# ADR 0001 — Own tolerant parser for a declared PSL subset

Status: accepted (2026-10-08)

## Context

The core use case is a schema that `prisma validate` rejects with P1012 (e.g. a composite 1:1 relation without a
matching `@@unique`). Prisma's own APIs (`getDMMF`, `validate`, the `prisma-schema-wasm` engine) stop at validation
errors, so they cannot be the analysis entry point. Prisma's grammar is also stricter than "readable" schemas
(newlines inside attribute arguments are rejected).

## Spike (performed)

1. Fixture `fixtures/composite-one-to-one-mismatch`: child FK `[organizationId, month, snapshotId]` declared 1:1,
   parent key unique, child FK not unique. All synthetic.
2. With the tokenizer/parser in `src/prisma`, models, fields, relations and `file:line:column` spans are obtained
   (tests in `tests/unit/parser.test.ts`, `engine.test.ts`).
3. Pinned `prisma@7.10.0 validate` reproduces exactly one error on that fixture:
   `A one-to-one relation must use unique fields on the defining side` (`pnpm test:prisma`, test-only).
4. Variants showed that Prisma 7 accepts only an exact, same-order uniqueness declaration; this drives DBP001.

## Decision

Write a tokenizer + structural recursive-descent parser for an explicit PSL subset (blocks, fields, modifiers,
field/block attributes with nested arguments, comments, strings, CRLF, BOM). Anything it cannot interpret becomes a
located diagnostic; blocking diagnostics turn the affected model's checks into `unknown`. No regex-over-file parsing,
no silent dropping of unknown syntax. Multi-line constructs are read but flagged because Prisma rejects them.

## Consequences

- Schemas failing validation are analyzable; unsupported syntax is visible in reports and exit code 3.
- We own grammar drift: new Prisma syntax shows up as diagnostics until supported; fixtures pin observed behaviour.
- No third-party AST dependency (none found that is maintained, licensed and tolerant of invalid input for v7).
