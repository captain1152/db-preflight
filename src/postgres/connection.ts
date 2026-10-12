// Parsing of the user-supplied connection URL. Error messages never include the URL or
// any part of it except parameter *names*.

import { DbpError } from "../core/errors.ts";

export const ENV_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;
export const DEFAULT_URL_ENV = "DB_PREFLIGHT_DATABASE_URL";

export type SslMode = "disable" | "verify-ca" | "verify-full";

export interface LiveTarget {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string | null;
  sslMode: SslMode;
  sslRootCertPath: string | null;
  loopback: boolean;
  warnings: string[];
}

const ALLOWED_PARAMS = new Set(["sslmode", "sslrootcert", "schema"]);

export function isLoopback(host: string): boolean {
  const h = host.replace(/^\[|\]$/g, "").toLowerCase();
  return h === "localhost" || h === "::1" || /^127(\.\d{1,3}){3}$/.test(h);
}

export function validateEnvName(name: string): string {
  if (!ENV_NAME_PATTERN.test(name) || name.length > 128) {
    throw new DbpError("BAD_ENV_NAME", "--db-url-env must be an environment variable NAME (letters, digits, underscore), not a URL or value");
  }
  return name;
}

export function parseDatabaseUrl(raw: string, envName: string): LiveTarget {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new DbpError("BAD_DATABASE_URL", `the value of ${envName} is not a valid URL (value not shown)`);
  }
  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
    throw new DbpError("BAD_DATABASE_URL", `the value of ${envName} must use the postgres:// or postgresql:// scheme`);
  }
  // URL keeps brackets around IPv6 literals; sockets and TLS need the bare address (inspection IR-008).
  const host = url.hostname.replace(/^\[(.*)\]$/, "$1");
  if (!host) {
    throw new DbpError("INCOMPLETE_DATABASE_URL", `the value of ${envName} has no host; db-preflight does not fall back to PGHOST or sockets`);
  }
  const database = decodeURIComponent(url.pathname.replace(/^\//, ""));
  if (!database || database.includes("/")) {
    throw new DbpError("INCOMPLETE_DATABASE_URL", `the value of ${envName} has no database name; db-preflight does not fall back to PGDATABASE`);
  }
  const user = decodeURIComponent(url.username);
  if (!user) {
    throw new DbpError("INCOMPLETE_DATABASE_URL", `the value of ${envName} has no user name; db-preflight does not fall back to PGUSER`);
  }
  const port = url.port ? Number.parseInt(url.port, 10) : 5432;
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new DbpError("BAD_DATABASE_URL", `the value of ${envName} has an invalid port`);
  }
  let password: string | null = null;
  if (url.password) {
    try {
      password = decodeURIComponent(url.password);
    } catch {
      throw new DbpError("BAD_DATABASE_URL", `the password in ${envName} is not valid percent-encoding (value not shown)`);
    }
  }
  const unknown = [...new Set([...url.searchParams.keys()].filter((k) => !ALLOWED_PARAMS.has(k)))];
  if (unknown.length > 0) {
    throw new DbpError(
      "UNSUPPORTED_URL_PARAMETER",
      `unsupported connection parameter(s) in ${envName}: ${unknown.map((k) => k.replace(/[^A-Za-z0-9_-]/g, "?").slice(0, 40)).join(", ")} (allowed: sslmode, sslrootcert, schema)`,
    );
  }
  const loopback = isLoopback(host);
  const warnings: string[] = [];
  const sslParam = url.searchParams.get("sslmode");
  let sslMode: SslMode;
  switch (sslParam) {
    case null:
      sslMode = loopback ? "disable" : "verify-full";
      break;
    case "disable":
      sslMode = "disable";
      if (!loopback) warnings.push("sslmode=disable for a non-loopback host: the connection (including the password) is not encrypted");
      break;
    case "require":
    case "verify-full":
      sslMode = "verify-full";
      break;
    case "verify-ca":
      sslMode = "verify-ca";
      break;
    default:
      throw new DbpError("UNSUPPORTED_SSLMODE", `sslmode in ${envName} must be one of disable, require (treated as verify-full), verify-ca, verify-full`);
  }
  if (url.searchParams.has("schema")) {
    warnings.push("the 'schema' URL parameter is ignored; use --schemas and --default-schema");
  }
  return {
    host,
    port,
    database,
    user,
    password,
    sslMode,
    sslRootCertPath: url.searchParams.get("sslrootcert"),
    loopback,
    warnings,
  };
}

/** Every string that must never appear in output for this target. */
export function targetSecrets(raw: string, t: LiveTarget | null): string[] {
  const s = [raw];
  if (t?.password) s.push(t.password);
  return s;
}
