import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, existsSync, linkSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { FIXTURES, manifest, REPO } from "../helpers.ts";

const BIN = join(REPO, "dist", "db-preflight.cjs");
const work = mkdtempSync(join(tmpdir(), "dbp e2e 작업-"));

// Hostile ambient environment: if any of these were used, tests would fail or hang.
const HOSTILE = {
  DATABASE_URL: "postgresql://evil:evil-password@203.0.113.9:5432/prod",
  PGHOST: "203.0.113.9",
  PGPASSWORD: "evil-password",
  PGUSER: "evil",
  PGDATABASE: "prod",
  PGOPTIONS: "-c statement_timeout=1",
  PGPASSFILE: join(work, "nonexistent-pgpass"),
};

function run(args: string[], env: Record<string, string> = {}, cwd = work) {
  const r = spawnSync(process.execPath, [BIN, ...args], {
    cwd,
    env: { PATH: process.env.PATH ?? "", SystemRoot: process.env.SystemRoot ?? "", ...HOSTILE, ...env },
    encoding: "utf8",
    timeout: 60_000,
  });
  return { code: r.status, stdout: r.stdout, stderr: r.stderr };
}

function sha(p: string): string {
  return createHash("sha256").update(readFileSync(p)).digest("hex");
}
function hashTree(dir: string): Record<string, string> {
  const out: Record<string, string> = {};
  const walk = (d: string) => {
    for (const n of readdirSync(d)) {
      const p = join(d, n);
      if (statSync(p).isDirectory()) walk(p);
      else out[p] = sha(p);
    }
  };
  walk(dir);
  return out;
}

beforeAll(() => {
  if (!existsSync(BIN)) throw new Error("dist/db-preflight.cjs missing: run `pnpm build` before e2e tests");
});
afterAll(() => rmSync(work, { recursive: true, force: true }));

describe("demo (no database, no network, no files)", () => {
  it("prints the broken composite relation with evidence and exits 1", () => {
    const r = run(["demo"]);
    expect(r.code).toBe(1);
    expect(r.stdout).toContain("MISMATCH FOUND");
    expect(r.stdout).toContain("DBP001");
    expect(r.stdout).toContain("DBP005");
    expect(r.stdout).toContain("reporting.prisma:25:3");
    expect(r.stdout).toContain("public.snapshot_summaries");
  });

  it("--format json writes exactly one JSON document to stdout", () => {
    const r = run(["demo", "--format", "json"]);
    expect(r.code).toBe(1);
    const doc = JSON.parse(r.stdout);
    expect(doc.reportVersion).toBe(1);
    expect(doc.mode).toBe("demo");
    expect(doc.safety.databaseAccess).toBe("none");
    expect(doc.findingGroups).toHaveLength(1);
  });

  it("healthy scenario exits 0; markdown format works", () => {
    expect(run(["demo", "--scenario", "healthy"]).code).toBe(0);
    const md = run(["demo", "--format", "markdown"]);
    expect(md.code).toBe(1);
    expect(md.stdout.startsWith("# DB Preflight report")).toBe(true);
  });
});

describe("scan --snapshot", () => {
  const names = readdirSync(FIXTURES).filter((d) => existsSync(join(FIXTURES, d, "fixture.json")));
  for (const name of names) {
    it(`${name} exits with the documented code and leaves inputs unchanged`, () => {
      const m = manifest(name);
      const before = hashTree(join(FIXTURES, name));
      const args = ["scan", "--schema", join(FIXTURES, name, m.schema), "--snapshot", join(FIXTURES, name, m.snapshot), "--format", "json"];
      if (m.defaultSchema) args.push("--default-schema", m.defaultSchema);
      const r = run(args);
      expect(r.code).toBe(m.expectedExitCode);
      const doc = JSON.parse(r.stdout);
      expect(doc.result.exitCode).toBe(m.expectedExitCode);
      expect(doc.safety.prismaInputsUnchangedVerified).toBe(true);
      expect(hashTree(join(FIXTURES, name))).toEqual(before);
    });
  }

  it("inconclusive scan (no --default-schema for a single-schema project) exits 3, never 0", () => {
    const r = run(["scan", "--schema", join(FIXTURES, "healthy", "schema.prisma"), "--snapshot", join(FIXTURES, "healthy", "snapshot.json")]);
    expect(r.code).toBe(3);
    expect(r.stdout).toContain("INCONCLUSIVE");
  });
});

describe("input errors exit 2 with JSON-clean stdout", () => {
  const schema = join(FIXTURES, "healthy", "schema.prisma");
  const snap = join(FIXTURES, "healthy", "snapshot.json");
  const cases: [string, string[]][] = [
    ["no command", []],
    ["unknown command", ["frobnicate"]],
    ["unknown option", ["scan", "--schema", schema, "--snapshot", snap, "--bogus"]],
    ["missing --schema", ["scan", "--snapshot", snap]],
    ["both sources", ["scan", "--schema", schema, "--snapshot", snap, "--live", "--schemas", "public"]],
    ["neither source", ["scan", "--schema", schema]],
    ["live without schemas", ["scan", "--schema", schema, "--live"]],
    ["bad format", ["demo", "--format", "yaml"]],
    ["missing file", ["scan", "--schema", join(work, "nope.prisma"), "--snapshot", snap]],
    ["URL instead of env name", ["scan", "--schema", schema, "--live", "--schemas", "public", "--db-url-env", "postgres://u:p@h/db"]],
    ["snapshot without --live", ["snapshot", "--schemas", "public"]],
    ["demo with db options", ["demo", "--live"]],
  ];
  for (const [name, args] of cases) {
    it(name, () => {
      const r = run(args.includes("--format") || args.length === 0 ? args : [...args, "--format", "json"]);
      expect(r.code).toBe(2);
      expect(r.stderr).toMatch(/error \[/);
      if (r.stdout.trim()) expect(() => JSON.parse(r.stdout)).not.toThrow();
    });
  }

  it("invalid snapshot exits 2", () => {
    const bad = join(work, "bad-snapshot.json");
    writeFileSync(bad, JSON.stringify({ snapshotVersion: 99 }));
    expect(run(["scan", "--schema", schema, "--snapshot", bad]).code).toBe(2);
  });

  it("unsupported provider exits 2", () => {
    const dir = mkdtempSync(join(work, "mysql-"));
    writeFileSync(join(dir, "s.prisma"), 'datasource db {\n  provider = "mysql"\n}\nmodel A {\n  id Int @id\n}\n');
    expect(run(["scan", "--schema", dir, "--snapshot", snap]).code).toBe(2);
  });

  it("live without the env var set exits 2 and does not use DATABASE_URL", () => {
    const r = run(["scan", "--schema", schema, "--live", "--schemas", "public"]);
    expect(r.code).toBe(2);
    expect(r.stderr).toContain("DB_PREFLIGHT_DATABASE_URL is not set");
    expect(r.stderr).not.toContain("evil-password");
  });

  it("connection errors never print the password or URL", () => {
    const pw = "s3cr3t:/@%pw";
    const url = `postgresql://u:${encodeURIComponent(pw)}@127.0.0.1:1/db?sslmode=disable`;
    const r = run(["snapshot", "--live", "--schemas", "public", "--db-url-env", "MY_URL", "--timeout-ms", "5000"], { MY_URL: url });
    expect(r.code).toBe(2);
    for (const s of [r.stdout, r.stderr]) {
      expect(s).not.toContain(pw);
      expect(s).not.toContain(encodeURIComponent(pw));
      expect(s).not.toContain(url);
    }
  });
});

describe("timeouts and cleanup", () => {
  let server: Server;
  let port = 0;
  const sockets: import("node:net").Socket[] = [];
  beforeAll(async () => {
    // Accepts TCP connections and never answers: simulates a hung server.
    server = createServer((s) => sockets.push(s));
    await new Promise<void>((res) => server.listen(0, "127.0.0.1", () => res()));
    port = (server.address() as { port: number }).port;
  });
  afterAll(() => {
    for (const s of sockets) s.destroy();
    server.close();
  });

  it("a hung server is abandoned within the timeout with exit 2", () => {
    const started = Date.now();
    const r = run(["snapshot", "--live", "--schemas", "public", "--db-url-env", "HUNG", "--timeout-ms", "1500"], {
      HUNG: `postgresql://u:pw@127.0.0.1:${port}/db?sslmode=disable`,
    });
    expect(r.code).toBe(2);
    expect(Date.now() - started).toBeLessThan(20_000);
    expect(r.stderr).not.toContain(":pw@");
  });
});

describe("--out protection", () => {
  it("creates once, refuses to overwrite without --force, then overwrites with --force", () => {
    const out = join(work, "report.json");
    rmSync(out, { force: true });
    expect(run(["demo", "--format", "json", "--out", out]).code).toBe(1);
    expect(JSON.parse(readFileSync(out, "utf8")).mode).toBe("demo");
    const r2 = run(["demo", "--format", "json", "--out", out]);
    expect(r2.code).toBe(2);
    expect(r2.stderr).toContain("already exists");
    expect(run(["demo", "--format", "json", "--out", out, "--force"]).code).toBe(1);
  });

  it("never writes onto an input, even with --force (incl. hard links and .prisma)", () => {
    const dir = mkdtempSync(join(work, "inputs-"));
    cpSync(join(FIXTURES, "healthy"), dir, { recursive: true });
    const schema = join(dir, "schema.prisma");
    const snap = join(dir, "snapshot.json");
    const before = hashTree(dir);
    const base = ["scan", "--schema", schema, "--snapshot", snap, "--default-schema", "public", "--force", "--out"];
    expect(run([...base, schema]).code).toBe(2);
    expect(run([...base, snap]).code).toBe(2);
    expect(run([...base, snap.toUpperCase()]).code).toBe(2);
    expect(run([...base, join(dir, "other.prisma")]).code).toBe(2);
    try {
      linkSync(snap, join(dir, "hard.json"));
      expect(run([...base, join(dir, "hard.json")]).code).toBe(2);
      rmSync(join(dir, "hard.json"));
    } catch {
      /* hard links unsupported on this filesystem */
    }
    expect(hashTree(dir)).toEqual(before);
  });
});

describe("help and version", () => {
  it("--version and --help exit 0", () => {
    expect(run(["--version"]).stdout.trim()).toBe("0.1.0");
    const h = run(["--help"]);
    expect(h.code).toBe(0);
    expect(h.stdout).toContain("Exit codes");
  });
});

describe("error output redaction (IR-007)", () => {
  it("a credential-bearing value passed as --schema never appears in stderr or JSON stdout", () => {
    const secret = "synthetic-secret-123";
    const r = run(["scan", "--schema", `postgres://reader:${secret}@host/schema.prisma`, "--snapshot", "x.json", "--format", "json"]);
    expect(r.code).toBe(2);
    expect(r.stderr).not.toContain(secret);
    expect(r.stdout).not.toContain(secret);
    expect(() => JSON.parse(r.stdout)).not.toThrow();
  });
});
