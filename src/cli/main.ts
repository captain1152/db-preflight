// db-preflight CLI. Exit codes:
//   0 = required checks completed, no failed rule
//   1 = at least one confirmed mismatch (coverage may still be incomplete; see report)
//   2 = input/configuration/connection/execution error, no valid result
//   3 = no confirmed mismatch, but required checks are unknown (inconclusive)

import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { DbpError } from "../core/errors.ts";
import { type BuildReportInput, buildReport } from "../core/report.ts";
import type { Report } from "../core/report-types.ts";
import type { DatabaseModel } from "../core/types.ts";
import { TOOL_VERSION } from "../core/version.ts";
import { DEMO_SCENARIOS } from "../demo/data.ts";
import { DEFAULT_URL_ENV, validateEnvName } from "../postgres/connection.ts";
import { collectLiveViaWorker, runLiveWorker } from "../postgres/live.ts";
import { databaseModelToSnapshot, loadSnapshotFile, parseSnapshot, restrictScope, snapshotToDatabaseModel } from "../postgres/snapshot.ts";
import { analyzePrismaSources, loadPrismaSchema, verifyInputsUnchanged } from "../prisma/index.ts";
import { renderMarkdown } from "../reporters/markdown.ts";
import { renderText } from "../reporters/text.ts";
import { formatError, redact } from "../safety/redact.ts";
import { safeText } from "../safety/sanitize.ts";
import { checkOutPath, writeOut } from "./output.ts";

type Format = "text" | "json" | "markdown";

const HELP = `db-preflight ${TOOL_VERSION} - evidence-first PostgreSQL / Prisma ORM 7 diagnostics

Usage:
  db-preflight demo [--scenario broken|healthy] [--format text|json|markdown] [--out FILE] [--force]
  db-preflight scan --schema PATH --snapshot FILE [--default-schema NAME] [--schemas a,b] [--format F] [--out FILE] [--force]
  db-preflight scan --schema PATH --live --schemas a,b [--db-url-env NAME] [--default-schema NAME] [--timeout-ms N] [--format F] [--out FILE] [--force]
  db-preflight snapshot --live --schemas a,b [--db-url-env NAME] [--timeout-ms N] [--out FILE] [--force]
  db-preflight --help | --version

Options:
  --schema PATH        A .prisma file or a directory of .prisma files (required for scan).
                       prisma.config.* is never loaded or executed.
  --snapshot FILE      Offline scan against a db-preflight snapshot JSON file.
  --live               Read catalog metadata from a live database (explicit opt-in).
  --schemas a,b        Database schemas to inspect (required with --live).
  --db-url-env NAME    NAME of the environment variable holding the connection URL
                       (default ${DEFAULT_URL_ENV}). Never pass the URL itself. .env files are not read.
  --default-schema N   Database schema for models without @@schema. Never guessed.
  --format F           text (default), json (exactly one JSON document on stdout) or markdown.
  --out FILE           Write the result to FILE instead of stdout. Refuses to overwrite unless --force;
                       never writes onto an input or a .prisma file.
  --timeout-ms N       Overall live collection timeout (default 30000).

Exit codes: 0 no mismatch in the checked scope; 1 mismatch found; 2 error; 3 inconclusive (unknown checks).
Results cover only supported checks; they are not a guarantee that the database or a migration is safe.
`;

interface Io {
  stdout: (s: string) => void;
  stderr: (s: string) => void;
}

const defaultIo: Io = {
  stdout: (s) => process.stdout.write(s),
  stderr: (s) => process.stderr.write(s),
};

function parseList(v: string | undefined, flag: string): string[] | undefined {
  if (v === undefined) return undefined;
  const list = v
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  if (list.length === 0) throw new DbpError("USAGE", `${flag} needs at least one name`);
  for (const s of list) if (s.length > 63 * 4) throw new DbpError("USAGE", `${flag} contains an overly long name`);
  return [...new Set(list)];
}

function parseFormat(v: string | undefined): Format {
  if (v === undefined) return "text";
  if (v === "text" || v === "json" || v === "markdown") return v;
  throw new DbpError("USAGE", "--format must be text, json or markdown");
}

function render(report: Report, format: Format, color: boolean): string {
  if (format === "json") return `${JSON.stringify(report, null, 2)}\n`;
  if (format === "markdown") return renderMarkdown(report);
  return renderText(report, { color });
}

function useColor(): boolean {
  return !!process.stdout.isTTY && process.env.NO_COLOR === undefined && process.env.TERM !== "dumb";
}

export async function main(argv: string[], io: Io = defaultIo): Promise<number> {
  const [command, ...rest] = argv;
  if (command === "__live-worker") return runLiveWorker();
  if (command === undefined) {
    io.stderr(`db-preflight: error [USAGE]: no command given\n\n${HELP}`);
    return 2;
  }
  if (command === "--help" || command === "-h" || command === "help") {
    io.stdout(HELP);
    return 0;
  }
  if (command === "--version" || command === "-v") {
    io.stdout(`${TOOL_VERSION}\n`);
    return 0;
  }
  let format: Format = "text";
  try {
    const { values } = parseArgs({
      args: rest,
      strict: true,
      allowPositionals: false,
      options: {
        help: { type: "boolean", short: "h" },
        schema: { type: "string" },
        snapshot: { type: "string" },
        live: { type: "boolean" },
        schemas: { type: "string" },
        "db-url-env": { type: "string" },
        "default-schema": { type: "string" },
        format: { type: "string" },
        out: { type: "string" },
        force: { type: "boolean" },
        scenario: { type: "string" },
        "timeout-ms": { type: "string" },
      },
    });
    format = parseFormat(values.format);
    if (values.help) {
      io.stdout(HELP);
      return 0;
    }
    const force = values.force === true;
    const timeoutMs = values["timeout-ms"] === undefined ? 30_000 : Number.parseInt(values["timeout-ms"], 10);
    if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 600_000) throw new DbpError("USAGE", "--timeout-ms must be between 100 and 600000");

    if (command === "demo") {
      for (const k of ["schema", "snapshot", "live", "schemas", "db-url-env", "default-schema", "timeout-ms"] as const) {
        if (values[k] !== undefined) throw new DbpError("USAGE", `demo does not accept --${k}; it uses built-in synthetic data only`);
      }
      const scenarioName = values.scenario ?? "broken";
      if (scenarioName !== "broken" && scenarioName !== "healthy") throw new DbpError("USAGE", "--scenario must be broken or healthy");
      if (values.out) checkOutPath(values.out, [], force);
      const sc = DEMO_SCENARIOS[scenarioName];
      const prisma = analyzePrismaSources(sc.sources);
      const db = snapshotToDatabaseModel(parseSnapshot(sc.snapshot), "demo");
      const report = buildReport({
        mode: "demo",
        inputKind: sc.inputKind,
        prisma,
        db,
        defaultSchema: sc.defaultSchema,
        generatedAt: new Date().toISOString(),
        safety: { databaseAccess: "none", readOnlyTransactionVerified: null, roleVerifiedNotSuperuser: null, catalogQueryIdsExecuted: null },
      });
      // Demo sources are in memory; no input files were read.
      report.safety.prismaInputsUnchangedVerified = null;
      return emit(report, format, values.out, force, io);
    }

    if (command === "scan") {
      if (values.scenario !== undefined) throw new DbpError("USAGE", "--scenario is only valid for demo");
      if (!values.schema) throw new DbpError("USAGE", "scan requires --schema PATH (a .prisma file or directory)");
      const hasSnapshot = values.snapshot !== undefined;
      const live = values.live === true;
      if (hasSnapshot === live) throw new DbpError("USAGE", "scan requires exactly one of --snapshot FILE or --live");
      const schemas = parseList(values.schemas, "--schemas");
      if (live && !schemas) throw new DbpError("USAGE", "--live requires --schemas (the database schemas to inspect)");
      if (!live && values["db-url-env"] !== undefined) throw new DbpError("USAGE", "--db-url-env is only valid with --live");
      const envName = validateEnvName(values["db-url-env"] ?? DEFAULT_URL_ENV);
      const defaultSchema = values["default-schema"] ?? null;
      if (defaultSchema !== null && defaultSchema.trim() === "") throw new DbpError("USAGE", "--default-schema must not be empty");

      const loaded = loadPrismaSchema(values.schema);
      const provider = loaded.model.datasource?.provider;
      if (provider !== undefined && provider !== "postgresql" && provider !== "postgres") {
        throw new DbpError("UNSUPPORTED_PROVIDER", `datasource provider "${safeText(provider)}" is not supported; v0.1 supports PostgreSQL only`);
      }
      const inputs = loaded.files.map((f) => f.absPath);
      if (hasSnapshot) inputs.push(resolve(values.snapshot as string));
      if (values.out) checkOutPath(values.out, inputs, force);

      let db: DatabaseModel;
      let safety: BuildReportInput["safety"];
      if (hasSnapshot) {
        db = snapshotToDatabaseModel(loadSnapshotFile(values.snapshot as string), "snapshot");
        if (schemas) db = restrictScope(db, schemas);
        safety = { databaseAccess: "none", readOnlyTransactionVerified: null, roleVerifiedNotSuperuser: null, catalogQueryIdsExecuted: null };
      } else {
        io.stderr(`db-preflight: reading catalog metadata (read-only) for schemas [${(schemas as string[]).map(safeText).join(", ")}] using ${envName}\n`);
        const res = await collectLiveViaWorker({ envName, schemas: schemas as string[], timeoutMs });
        for (const w of res.warnings) io.stderr(`db-preflight: warning: ${safeText(w)}\n`);
        db = res.db;
        safety = {
          databaseAccess: "live_catalog_metadata",
          readOnlyTransactionVerified: res.readOnlyVerified,
          roleVerifiedNotSuperuser: true,
          catalogQueryIdsExecuted: res.executed,
        };
      }
      const report = buildReport({
        mode: hasSnapshot ? "snapshot" : "live",
        inputKind: loaded.inputKind,
        prisma: loaded.model,
        db,
        defaultSchema,
        generatedAt: new Date().toISOString(),
        safety,
      });
      report.safety.prismaInputsUnchangedVerified = verifyInputsUnchanged(loaded.files);
      return emit(report, format, values.out, force, io, inputs);
    }

    if (command === "snapshot") {
      if (values.live !== true) throw new DbpError("USAGE", "snapshot requires --live (explicit opt-in to connect)");
      for (const k of ["schema", "snapshot", "default-schema", "scenario"] as const) {
        if (values[k] !== undefined) throw new DbpError("USAGE", `snapshot does not accept --${k}`);
      }
      if (values.format !== undefined && values.format !== "json") throw new DbpError("USAGE", "snapshot output is always JSON");
      format = "json";
      const schemas = parseList(values.schemas, "--schemas");
      if (!schemas) throw new DbpError("USAGE", "snapshot requires --schemas (the database schemas to inspect)");
      const envName = validateEnvName(values["db-url-env"] ?? DEFAULT_URL_ENV);
      if (values.out) checkOutPath(values.out, [], force);
      io.stderr(`db-preflight: reading catalog metadata (read-only) for schemas [${schemas.map(safeText).join(", ")}] using ${envName}\n`);
      const res = await collectLiveViaWorker({ envName, schemas, timeoutMs });
      for (const w of res.warnings) io.stderr(`db-preflight: warning: ${safeText(w)}\n`);
      const json = `${JSON.stringify(databaseModelToSnapshot(res.db), null, 2)}\n`;
      if (values.out) {
        writeOut(values.out, json, force);
        io.stderr(
          `db-preflight: snapshot written (collection ${res.db.complete ? "complete" : "INCOMPLETE"}). It contains schema metadata, which may be sensitive; keep it out of version control.\n`,
        );
      } else {
        io.stdout(json);
      }
      return res.db.complete ? 0 : 3;
    }

    throw new DbpError("USAGE", `unknown command "${safeText(redact(command)).slice(0, 40)}"; run db-preflight --help`);
  } catch (e) {
    const code = e instanceof DbpError ? e.code : (e as { code?: string }).code === "ERR_PARSE_ARGS_UNKNOWN_OPTION" ? "USAGE" : "INTERNAL";
    // Redact at the final output boundary for every error type (inspection IR-007).
    const message = redact(e instanceof DbpError ? e.message : formatError(e));
    io.stderr(`db-preflight: error [${code}]: ${safeText(message)}\n`);
    if (format === "json") {
      io.stdout(`${JSON.stringify({ error: { code, message: safeText(message) }, exitCode: 2 })}\n`);
    }
    return 2;
  }
}

function emit(report: Report, format: Format, out: string | undefined, force: boolean, io: Io, inputs: string[] = []): number {
  const text = render(report, format, out ? false : useColor());
  if (out) {
    writeOut(out, text, force, inputs);
    io.stderr(`db-preflight: ${report.result.status} (exit ${report.result.exitCode}); report written to the --out file\n`);
  } else {
    io.stdout(text);
  }
  return report.result.exitCode;
}
