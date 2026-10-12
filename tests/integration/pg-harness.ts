// Test-only harness: creates DISPOSABLE PostgreSQL containers bound to 127.0.0.1 with random
// credentials generated here. It never reads DATABASE_URL, PG* variables or .env files, and it
// is the only code allowed to run DDL (fixture setup) - always as the container's own admin.

import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";

export const REPO = join(import.meta.dirname, "..", "..");

export interface PgContainer {
  name: string;
  image: string;
  port: number;
  adminPassword: string;
  metaPassword: string;
}

function docker(args: string[], opts: { input?: string } = {}): string {
  return execFileSync("docker", args, { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"], ...(opts.input ? { input: opts.input } : {}) });
}

export function dockerAvailable(): { ok: boolean; reason?: string } {
  try {
    docker(["info", "--format", "{{.ServerVersion}}"]);
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: `docker not available: ${(e as Error).message.split("\n")[0]}` };
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function startPostgres(image: string): Promise<PgContainer> {
  const name = `dbp-it-${randomBytes(6).toString("hex")}`;
  const adminPassword = randomBytes(18).toString("base64url");
  const metaPassword = `m-${randomBytes(12).toString("base64url")}:@/%`; // exercises URL encoding
  docker(["run", "-d", "--rm", "--name", name, "-e", `POSTGRES_PASSWORD=${adminPassword}`, "-p", "127.0.0.1::5432", image]);
  const mapping = docker(["port", name, "5432/tcp"]).trim().split("\n")[0] ?? "";
  const port = Number.parseInt(mapping.split(":").pop() ?? "", 10);
  const c: PgContainer = { name, image, port, adminPassword, metaPassword };
  const deadline = Date.now() + 120_000;
  for (;;) {
    try {
      const client = adminClient(c);
      await client.connect();
      await client.query("SELECT 1");
      await client.end();
      // The image's init phase runs a temporary server without TCP listeners, so the first
      // successful TCP connection comes from the final server.
      break;
    } catch {
      /* not ready */
    }
    if (Date.now() > deadline) {
      stopPostgres(c);
      throw new Error(`postgres container ${image} did not become ready`);
    }
    await sleep(500);
  }
  const admin = adminClient(c);
  await admin.connect();
  // Metadata role: LOGIN only. No table privileges are granted anywhere.
  await admin.query(`CREATE ROLE dbp_meta LOGIN PASSWORD '${metaPassword.replace(/'/g, "''")}' NOSUPERUSER NOCREATEDB NOCREATEROLE`);
  await admin.end();
  return c;
}

export function stopPostgres(c: PgContainer): void {
  try {
    docker(["rm", "-f", c.name]);
  } catch {
    /* already gone */
  }
}

export function adminClient(c: PgContainer, database = "postgres"): pg.Client {
  // Explicit options only; password is a function so no ambient PG* / pgpass is consulted.
  return new pg.Client({
    host: "127.0.0.1",
    port: c.port,
    user: "postgres",
    database,
    password: async () => c.adminPassword,
    options: "-c client_min_messages=warning",
    application_name: "dbp-test-admin",
  } as unknown as pg.ClientConfig);
}

export function metaUrl(c: PgContainer, database: string): string {
  return `postgresql://dbp_meta:${encodeURIComponent(c.metaPassword)}@127.0.0.1:${c.port}/${database}?sslmode=disable`;
}

export function adminUrl(c: PgContainer, database: string): string {
  return `postgresql://postgres:${encodeURIComponent(c.adminPassword)}@127.0.0.1:${c.port}/${database}?sslmode=disable`;
}

/** Create a database for a fixture and apply its DDL as the container admin. */
export async function createFixtureDb(c: PgContainer, dbName: string, sql: string): Promise<void> {
  const admin = adminClient(c);
  await admin.connect();
  await admin.query(`CREATE DATABASE ${dbName}`);
  await admin.query(`GRANT CONNECT ON DATABASE ${dbName} TO dbp_meta`);
  await admin.end();
  const fx = adminClient(c, dbName);
  await fx.connect();
  await fx.query(sql);
  await fx.end();
}

export function fixtureSql(fixture: string): string {
  return readFileSync(join(REPO, "fixtures", fixture, "db.sql"), "utf8");
}

/** Admin-side fingerprint of schema definitions and all row contents (for before/after comparison). */
export async function fingerprint(c: PgContainer, dbName: string): Promise<string> {
  const a = adminClient(c, dbName);
  await a.connect();
  try {
    const defs = await a.query(`
      SELECT string_agg(x, E'\\n' ORDER BY x) AS defs FROM (
        SELECT format('%s.%s.%s %s %s', n.nspname, cl.relname, at.attname, at.atttypid, at.attnotnull) AS x
        FROM pg_attribute at JOIN pg_class cl ON cl.oid = at.attrelid JOIN pg_namespace n ON n.oid = cl.relnamespace
        WHERE n.nspname NOT IN ('pg_catalog','information_schema','pg_toast') AND at.attnum > 0 AND NOT at.attisdropped
        UNION ALL
        SELECT format('%s %s %s', conrelid::regclass, conname, pg_get_constraintdef(oid)) FROM pg_constraint
        WHERE connamespace NOT IN ('pg_catalog'::regnamespace, 'information_schema'::regnamespace)
        UNION ALL
        SELECT pg_get_indexdef(indexrelid) FROM pg_index i JOIN pg_class cl ON cl.oid = i.indrelid JOIN pg_namespace n ON n.oid = cl.relnamespace
        WHERE n.nspname NOT IN ('pg_catalog','information_schema','pg_toast')
      ) s`);
    const tables = await a.query(
      `SELECT format('%I.%I', n.nspname, c.relname) AS t FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE c.relkind = 'r' AND n.nspname NOT IN ('pg_catalog','information_schema','pg_toast') ORDER BY 1`,
    );
    let rows = "";
    for (const r of tables.rows as { t: string }[]) {
      const h = await a.query(`SELECT count(*)::text || ':' || coalesce(md5(string_agg(t::text, ',' ORDER BY t::text)), '') AS h FROM ${r.t} t`);
      rows += `${r.t}=${(h.rows[0] as { h: string }).h}\n`;
    }
    return `${(defs.rows[0] as { defs: string }).defs}\n${rows}`;
  } finally {
    await a.end();
  }
}
