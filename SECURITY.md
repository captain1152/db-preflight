# Security policy

## Supported versions

| Version | Supported |
|---|---|
| 0.1.x | yes (pre-release; not yet published) |

## Reporting a vulnerability

Please do **not** open a public issue for security problems. Use GitHub's private vulnerability
reporting at https://github.com/captain1152/db-preflight/security/advisories/new ("Report a vulnerability" on the Security tab). Private
vulnerability reporting must be enabled in the repository settings after the repository is created.

Never include real connection strings, passwords, snapshots or reports in a report; use synthetic reproductions.

## Scope

In scope: secret leakage (URLs, passwords) in output, any path by which the tool could execute non-allow-listed SQL,
modify a database or Prisma files, follow ambient credentials (`PG*`, `.pgpass`, `.env`, `DATABASE_URL`), escape
the `--schema` input root, or be steered by untrusted identifiers (terminal/Markdown injection).
The design is described in [docs/security.md](docs/security.md).
