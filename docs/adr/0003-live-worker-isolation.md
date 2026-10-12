# ADR 0003 — Run live collection in an isolated worker process

Status: accepted (2026-10-08), from plan review finding R1.

## Context

`pg@8` resolves every connection option with `config[key] || process.env.PG<KEY> || default` and consults
`~/.pgpass` when the password is null. Falsy explicit values (`password: ''`, `binary: false`, absent `options`,
`replication`) therefore fall back to ambient `PG*` variables, which could select credentials or session options the
user did not specify. Mutating `process.env` in the CLI process to prevent this would be shared global state.

## Decision

The CLI validates the URL, then spawns itself (`__live-worker`) with an allow-listed environment and passes the
request on stdin. The worker deletes `PG*`/`DATABASE_URL` from its own environment before importing `pg`, passes the
password as a function, sets `options` explicitly, asserts replication is off, collects, and prints one JSON line.
Errors cross the process boundary as redacted code + message only.

## Consequences

- Live scans are immune to hostile `PG*`/`DATABASE_URL` (covered by integration and e2e tests that set them).
- Slight start-up cost; a parent-side hard timeout kills a stuck worker.
- In-process collection remains available for tests through `collectCatalog(client)`.
