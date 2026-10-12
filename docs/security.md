# Security model

## What DB Preflight never does

- No connection unless you pass `--live` **and** `--schemas`. Demo and snapshot modes never open a network socket.
- No `.env` discovery or loading; no use of `DATABASE_URL`, `PGHOST`, `PGPASSWORD`, `~/.pgpass` or other ambient
  connection settings. The URL is read only from the variable *named* by `--db-url-env`
  (default `DB_PREFLIGHT_DATABASE_URL`). There is no command-line option that accepts a URL or password.
- No SQL input, no extension points for queries, no migrations, no DDL/DML, no `prisma db pull/push`, `migrate`,
  `generate` or `format`, no execution of `prisma.config.*` or project scripts.
- No table rows are read: no `SELECT` on user tables, no `COUNT`, sampling, `EXPLAIN ANALYZE`, temp tables or `COPY`.
- No telemetry, cloud upload or LLM calls in the CLI.

## Live collection

1. The CLI validates the URL in the parent process (host, database and user must be explicit; only the `sslmode`,
   `sslrootcert` and ignored `schema` parameters are accepted). Error messages name the variable, never its value.
2. Collection runs in a **worker child process** started with an allow-listed environment (OS essentials such as
   `SystemRoot`, plus `NODE_EXTRA_CA_CERTS` and `TZ`). The URL is passed on stdin. The worker also deletes every `PG*`
   variable before loading `pg`. This exists because `pg@8` silently substitutes `PG*` environment values and
   `~/.pgpass` for any falsy connection option (plan review R1).
3. The password is passed as a function; `options` is set to `-c default_transaction_read_only=on`; the
   application name is `db-preflight`.
4. One connection, one transaction: `BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY`,
   `SET LOCAL search_path = pg_catalog, pg_temp`, then `transaction_read_only`, isolation and `rolsuper` are verified.
   Not read-only, not REPEATABLE READ, superuser or unverifiable role → abort before any catalog query.
5. Only the fixed queries in [`src/postgres/queries.ts`](../src/postgres/queries.ts) are sent, selected by id.
   All catalog objects, functions and operators are schema-qualified (`pg_catalog.`, `OPERATOR(pg_catalog.=)`), and
   the schema filter is always the bound parameter `$1::pg_catalog.text[]`.
6. Timeouts: connect (≤ 15 s), `statement_timeout`, client `query_timeout`, `idle_in_transaction_session_timeout`, an
   overall deadline (`--timeout-ms`, default 30 s) in the worker, and a hard kill of the worker in the parent.
   `ROLLBACK` and `client.end()` run on success, error and timeout.
7. A failed catalog query produces an **incomplete** model with no tables (all checks `unknown`), never partial data.

Limits we do not claim away: `READ ONLY` is PostgreSQL's high-level notion and does not prevent every write to disk;
string checks on SQL are not a sandbox. The real protections are the fixed query set, the least-privilege role, and
not offering any way to send other SQL.

## Recommended role

```sql
-- Run by a DBA on the target database. No table privileges are needed: pg_catalog is readable by default.
CREATE ROLE preflight_reader LOGIN PASSWORD '<generated>' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
GRANT CONNECT ON DATABASE app TO preflight_reader;
ALTER ROLE preflight_reader SET default_transaction_read_only = on;
```

The integration tests run every live check as such a role and assert that it cannot `SELECT` from fixture tables.

## TLS

| URL `sslmode` | Behaviour |
|---|---|
| (absent), remote host | TLS with certificate **and** host name verification |
| (absent), `localhost`/`127.0.0.0/8`/`::1` | no TLS |
| `require`, `verify-full` | TLS with full verification (stricter than libpq's `require`) |
| `verify-ca` | TLS with CA verification, host name not checked |
| `disable` | no TLS; a warning is printed for non-loopback hosts |
| `prefer`, `allow`, `no-verify`, others | rejected |

`sslrootcert=<path>` loads a CA file; `NODE_EXTRA_CA_CERTS` is honored. Verification is never disabled by default.

## Output and untrusted data

`--out` is written to an exclusive temporary file in the destination directory, the destination is re-checked, and the
file is published with a no-clobber hard link (or an atomic rename with `--force`), so nothing is ever written through
an existing file, symlink or hard link at the destination. Residual risk: an attacker able to replace the destination's
parent directory between the re-check and the rename. Every error message is redacted at the output boundary.
Snapshots that claim `complete: true` while recording gaps, or record a gap whose scope is neither `*` nor a requested
schema, are rejected. When the live worker exits without a result, at most 500 characters of its redacted stderr are
shown (redaction runs before truncation), and none if its stderr exceeded the 64 KiB collection limit.

Database identifiers, paths and snapshot contents are untrusted. Text output strips ANSI/OSC sequences and control
characters (including bidi overrides); Markdown output escapes Markdown/HTML and uses code spans that cannot be
broken out of; JSON is produced by `JSON.stringify`. Unknown snapshot fields are dropped, not echoed. Errors are
reduced to code + message, redacted for the URL, the password (raw, percent-encoded, form-encoded, decoded variants),
URL user-info and `password=`-style pairs, through nested `cause`/`AggregateError` chains.

## Claude Code plugin

The skills run the bundled CLI; they never print environment variables, ask for credentials in chat, or read `.env`.
Anything the CLI prints (schema, table and column names) becomes part of the Claude conversation; the CLI not
sending data anywhere is not the same as "Claude processes it locally". The plugin installs no hooks, no MCP server
and does not block commands; automated tests check files and bundles, not that a model always follows skill text.

## Snapshots and reports

They contain schema metadata, which can be sensitive. `.gitignore` excludes `db-snapshot*.json`, `*.snapshot.json`,
`report.json`, `report.md` and `db-preflight-report*`. Fixtures in this repository are synthetic.

## Reporting vulnerabilities

See [SECURITY.md](../SECURITY.md).
