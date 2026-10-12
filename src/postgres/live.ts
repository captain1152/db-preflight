// Live collection runs in a dedicated child process ("worker") so that pg's implicit
// fallbacks to PG* environment variables and ~/.pgpass cannot select credentials or
// connection options the user did not specify (pg@8 treats falsy options as absent).
//
// Parent: spawns `node <this bundle> __live-worker` with an allow-listed environment and
// sends {url, schemas, timeouts} on stdin. Worker: scrubs PG* vars, connects with explicit
// options, runs collectCatalog, prints one JSON line, exits.

import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { DbpError } from "../core/errors.ts";
import type { DatabaseModel } from "../core/types.ts";
import { formatError, redact } from "../safety/redact.ts";
import { collectCatalog } from "./collector.ts";
import { type LiveTarget, parseDatabaseUrl, targetSecrets } from "./connection.ts";
import type { QueryId } from "./queries.ts";

export interface LiveOptions {
  envName: string;
  schemas: string[];
  timeoutMs: number;
}

export interface LiveResult {
  db: DatabaseModel;
  executed: QueryId[];
  readOnlyVerified: boolean;
  statementTimeout: string | null;
  warnings: string[];
}

interface WorkerRequest {
  url: string;
  envName: string;
  schemas: string[];
  timeoutMs: number;
}

type WorkerResponse = { ok: true; result: LiveResult } | { ok: false; code: string; message: string };

/** Environment passed to the worker: OS essentials only. No PG*, DATABASE_URL, HOME, APPDATA, NODE_OPTIONS. */
export function workerEnv(source: NodeJS.ProcessEnv = process.env): Record<string, string> {
  const allow = ["SystemRoot", "SYSTEMROOT", "windir", "WINDIR", "NODE_EXTRA_CA_CERTS", "TZ"];
  const env: Record<string, string> = {};
  for (const k of allow) {
    const v = source[k];
    if (typeof v === "string") env[k] = v;
  }
  return env;
}

const STDERR_LIMIT = 64 * 1024;
const STDERR_PREVIEW = 500;

/**
 * Message for a worker that exited without a result. Secrets are redacted in the full collected
 * stderr before truncation (inspection IR-014 / RV-001). If stderr overflowed the collection
 * limit, a secret may straddle the retained and the dropped part, where neither exact matching
 * nor the URL pattern can recognize it, so no stderr text is shown at all (RV-008).
 */
export function workerFailureMessage(stderr: string, overflowed: boolean, secrets: readonly string[]): string {
  if (overflowed) return "live worker failed without a result (worker stderr exceeded the collection limit and is not shown)";
  if (!stderr) return "live worker failed without a result";
  return `live worker failed without a result: ${redact(stderr, secrets).slice(0, STDERR_PREVIEW)}`;
}

export async function collectLiveViaWorker(opts: LiveOptions, scriptPath: string = process.argv[1] ?? ""): Promise<LiveResult> {
  const raw = process.env[opts.envName];
  if (raw === undefined || raw === "") {
    throw new DbpError("DATABASE_URL_ENV_MISSING", `environment variable ${opts.envName} is not set; see README for PowerShell and Bash examples`);
  }
  // Validate in the parent too so that obvious mistakes fail before spawning.
  const target = parseDatabaseUrl(raw, opts.envName);
  const secrets = targetSecrets(raw, target);
  const request: WorkerRequest = { url: raw, envName: opts.envName, schemas: opts.schemas, timeoutMs: opts.timeoutMs };

  return await new Promise<LiveResult>((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath, "__live-worker"], {
      env: workerEnv(),
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });
    let out = "";
    let err = "";
    let errOverflowed = false;
    const killTimer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new DbpError("LIVE_TIMEOUT", `live metadata collection exceeded ${opts.timeoutMs} ms and was aborted`));
    }, opts.timeoutMs + 5000);
    child.stdout.setEncoding("utf8").on("data", (d: string) => {
      if (out.length < 256 * 1024 * 1024) out += d;
    });
    child.stderr.setEncoding("utf8").on("data", (d: string) => {
      if (err.length < STDERR_LIMIT) err += d;
      else errOverflowed = true;
    });
    child.on("error", (e) => {
      clearTimeout(killTimer);
      reject(new DbpError("WORKER_SPAWN_FAILED", `could not start the live worker: ${formatError(e, secrets)}`));
    });
    child.on("close", () => {
      clearTimeout(killTimer);
      const line = out.trim().split("\n").pop() ?? "";
      let msg: WorkerResponse;
      try {
        msg = JSON.parse(line) as WorkerResponse;
      } catch {
        reject(new DbpError("WORKER_FAILED", workerFailureMessage(err, errOverflowed, secrets)));
        return;
      }
      if (msg.ok) resolve(msg.result);
      else reject(new DbpError(msg.code, redact(msg.message, secrets)));
    });
    child.stdin.end(JSON.stringify(request));
  });
}

/** Entry point of the worker process. */
export async function runLiveWorker(): Promise<number> {
  // Defense in depth: even though the parent passes a minimal env, never let pg see PG* vars.
  for (const k of Object.keys(process.env)) {
    if (/^PG/i.test(k) || k === "DATABASE_URL") delete process.env[k];
  }
  const input = await readStdin();
  let req: WorkerRequest;
  try {
    req = JSON.parse(input) as WorkerRequest;
  } catch {
    process.stdout.write(`${JSON.stringify({ ok: false, code: "WORKER_BAD_INPUT", message: "worker input was not JSON" })}\n`);
    return 2;
  }
  let target: LiveTarget | null = null;
  try {
    target = parseDatabaseUrl(req.url, req.envName);
    const result = await collectWithPg(target, req.schemas, req.timeoutMs);
    process.stdout.write(`${JSON.stringify({ ok: true, result: { ...result, warnings: target.warnings } })}\n`);
    return 0;
  } catch (e) {
    const secrets = targetSecrets(req.url, target);
    const code = e instanceof DbpError ? e.code : "LIVE_COLLECTION_FAILED";
    const message = e instanceof DbpError ? redact(e.message, secrets) : `live metadata collection failed: ${formatError(e, secrets)}`;
    process.stdout.write(`${JSON.stringify({ ok: false, code, message })}\n`);
    return 2;
  }
}

async function collectWithPg(t: LiveTarget, schemas: string[], timeoutMs: number) {
  const pg = await import("pg");
  const Client = (pg.default ?? pg).Client;
  let ssl: false | { rejectUnauthorized: true; ca?: string; servername?: string; checkServerIdentity?: () => undefined } = false;
  if (t.sslMode !== "disable") {
    ssl = { rejectUnauthorized: true };
    if (t.sslRootCertPath && t.sslRootCertPath !== "system") {
      try {
        ssl.ca = readFileSync(t.sslRootCertPath, "utf8");
      } catch {
        throw new DbpError("SSL_ROOT_CERT_UNREADABLE", "sslrootcert file could not be read");
      }
    }
    if (t.sslMode === "verify-ca") ssl.checkServerIdentity = () => undefined;
  }
  const password = t.password ?? "";
  const statementTimeout = Math.max(1000, Math.min(timeoutMs, 60_000));
  const client = new Client({
    host: t.host,
    port: t.port,
    database: t.database,
    user: t.user,
    // A function prevents pg from consulting PGPASSWORD / pgpass for an absent password.
    password: async () => password,
    ssl,
    sslnegotiation: "postgres",
    client_encoding: "UTF8",
    options: "-c default_transaction_read_only=on",
    binary: false,
    application_name: "db-preflight",
    connectionTimeoutMillis: Math.min(timeoutMs, 15_000),
    statement_timeout: statementTimeout,
    query_timeout: statementTimeout + 2000,
    idle_in_transaction_session_timeout: statementTimeout + 5000,
    keepAlive: false,
  } as unknown as ConstructorParameters<typeof Client>[0]);
  // pg copies `replication` from PGREPLICATION when falsy; PG* were scrubbed above, assert anyway.
  if ((client as unknown as { replication?: unknown }).replication) throw new DbpError("UNEXPECTED_REPLICATION", "replication mode must not be enabled");

  let timedOut = false;
  const deadline = setTimeout(() => {
    timedOut = true;
    void client.end().catch(() => undefined);
  }, timeoutMs);
  try {
    await client.connect();
    const result = await collectCatalog(client as unknown as Parameters<typeof collectCatalog>[0], schemas);
    if (timedOut) throw new DbpError("LIVE_TIMEOUT", `live metadata collection exceeded ${timeoutMs} ms and was aborted`);
    return result;
  } catch (e) {
    if (timedOut) throw new DbpError("LIVE_TIMEOUT", `live metadata collection exceeded ${timeoutMs} ms and was aborted`);
    throw e;
  } finally {
    clearTimeout(deadline);
    await client.end().catch(() => undefined);
  }
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const c of process.stdin) chunks.push(c as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}
