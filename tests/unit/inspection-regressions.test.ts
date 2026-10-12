// Regression tests for the fresh-session Codex inspection findings IR-001 … IR-008.
import { linkSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { writeOut } from "../../src/cli/output.ts";
import { DbpError } from "../../src/core/errors.ts";
import { normalize } from "../../src/postgres/collector.ts";
import { parseDatabaseUrl } from "../../src/postgres/connection.ts";
import { parseSnapshot, restrictScope, snapshotToDatabaseModel } from "../../src/postgres/snapshot.ts";
import { buildPrismaModel } from "../../src/prisma/model.ts";
import { formatError } from "../../src/safety/redact.ts";
import { DS, dbModel, FIXTURES, fk, key, scanFixture, scanSources, scanText, status, table } from "../helpers.ts";

const work = mkdtempSync(join(tmpdir(), "dbp-ir-"));
afterAll(() => rmSync(work, { recursive: true, force: true }));

describe("IR-001 unsupported relation syntax never yields a clean result", () => {
  const healthyText = readFileSync(join(FIXTURES, "healthy", "schema.prisma"), "utf8");
  for (const [name, text] of [
    ["owner side", healthyText.replace("onDelete: Cascade)", "onDelete: Cascade, futureFlag: true)")],
    ["inverse side", healthyText.replace("summary      SnapshotSummary?", "summary      SnapshotSummary? @relation(futureFlag: true)")],
  ] as const) {
    it(name, () => {
      expect(text).not.toBe(healthyText);
      expect(scanFixture("healthy").result.exitCode).toBe(0); // baseline without the unsupported argument
      const snap = parseSnapshot(JSON.parse(readFileSync(join(FIXTURES, "healthy", "snapshot.json"), "utf8")));
      const r2 = scanSources([{ path: "schema.prisma", text }], { ...dbModel(snap.tables), requestedSchemas: ["public"], schemasFound: ["public"] });
      for (const rule of ["DBP001", "DBP004", "DBP005"]) expect(status(r2, `${rule}:relation SnapshotSummary.snapshot`)).toBe("unknown");
      expect(r2.prisma.diagnostics.some((d) => d.severity === "blocking" && d.message.includes("futureFlag"))).toBe(true);
      expect(r2.result.exitCode).toBe(3);
    });
  }
});

describe("IR-002 --out never writes through an existing link", () => {
  it("--force replaces the directory entry; a hard-linked file keeps its content", () => {
    const victim = join(work, "victim.prisma.txt");
    writeFileSync(victim, "ORIGINAL");
    const out = join(work, "out.json");
    try {
      linkSync(victim, out);
    } catch {
      return; // filesystem without hard links: nothing to test here
    }
    // Simulates a link swapped in after the initial checks (no inputs passed => no inode check).
    writeOut(out, "REPORT", true, []);
    expect(readFileSync(victim, "utf8")).toBe("ORIGINAL");
    expect(readFileSync(out, "utf8")).toBe("REPORT");
  });

  it("without --force an existing destination is never replaced", () => {
    const out = join(work, "exists.json");
    writeFileSync(out, "KEEP");
    expect(() => writeOut(out, "NEW", false, [])).toThrow(DbpError);
    expect(readFileSync(out, "utf8")).toBe("KEEP");
  });
});

describe("IR-003/IR-004 collector keeps partition FKs and PERIOD semantics", () => {
  it("normalizes a PERIOD foreign key and DBP004 reports it as unknown", () => {
    const n = normalize(
      [{ schema_name: "public", rel_name: "c", relkind: "r", is_partition: false, has_inheritance_children: false, parent_schemas: [], parent_tables: [] }],
      [],
      [
        {
          schema_name: "public",
          rel_name: "c",
          con_name: "c_fk",
          contype: "f",
          columns: ["pid", "valid_at"],
          ref_schema: "public",
          ref_table: "p",
          ref_columns: ["id", "valid_at"],
          condeferrable: false,
          convalidated: true,
          conenforced: true,
          conperiod: true,
        },
      ],
      [],
    );
    expect(n.tables[0]?.foreignKeys[0]?.period).toBe(true);
    const text = `${DS}model P {\n  id Int\n  validAt Unsupported("daterange") @map("valid_at")\n  cs C[]\n  @@id([id, validAt])\n  @@map("p")\n}\nmodel C {\n  id Int @id\n  pid Int\n  validAt Unsupported("daterange") @map("valid_at")\n  p P @relation(fields: [pid, validAt], references: [id, validAt])\n  @@map("c")\n}\n`;
    const db = dbModel([
      table("p", ["id", "valid_at"], [key("p_pkey", ["id", "valid_at"], { kind: "primary_key", period: true })]),
      table(
        "c",
        ["id", "pid", "valid_at"],
        [key("c_pkey", ["id"], { kind: "primary_key" })],
        [fk("c_fk", ["pid", "valid_at"], "p", ["id", "valid_at"], { period: true })],
      ),
    ]);
    const r = scanText(text, db);
    expect(r.checks.find((c) => c.id === "DBP004:relation C.p")?.reasonCode).toBe("fk_period_not_supported");
  });
});

describe("IR-005/IR-006 incomplete evidence is never treated as absence", () => {
  it("a column missing from an incomplete collection is unknown, not a DBP003 failure", () => {
    const r = scanFixture("healthy", {
      db: (d) => ({
        ...d,
        complete: false,
        gaps: [{ scope: "public", reason: "column query failed" }],
        tables: d.tables.map((t) => (t.name === "organizations" ? { ...t, columns: t.columns.filter((c) => c.name !== "name") } : t)),
      }),
    });
    expect(r.checks.find((c) => c.id === "DBP003:model Organization")?.reasonCode).toBe("incomplete_collection");
    expect(r.result.exitCode).toBe(3);
  });

  it("a different FK in an incomplete collection is not a mapping mismatch", () => {
    const r = scanFixture("healthy", {
      db: (d) => ({
        ...d,
        complete: false,
        gaps: [{ scope: "public", reason: "partial" }],
        tables: d.tables.map((t) => (t.name === "snapshot_summaries" ? { ...t, foreignKeys: [fk("other", ["organization_id"], "organizations", ["id"])] } : t)),
      }),
    });
    expect(status(r, "DBP004:relation SnapshotSummary.snapshot")).toBe("unknown");
  });

  it("snapshots claiming completeness while recording gaps are rejected; models with gaps never exit 0", () => {
    const s = JSON.parse(readFileSync(join(FIXTURES, "healthy", "snapshot.json"), "utf8"));
    s.gaps = [{ scope: "public", reason: "x" }];
    expect(() => parseSnapshot(s)).toThrow(DbpError);
    const r = scanFixture("healthy", { db: (d) => ({ ...d, complete: true, gaps: [{ scope: "public", reason: "x" }] }) });
    expect(r.result.exitCode).not.toBe(0);
    expect(r.coverage.completeWithinScope).toBe(false);
  });
});

describe("IR-008 IPv6 literals", () => {
  it("strips URL brackets from IPv6 hosts", () => {
    const t = parseDatabaseUrl("postgresql://u:p@[::1]:5432/db", "E");
    expect(t.host).toBe("::1");
    expect(t.loopback).toBe(true);
    expect(parseDatabaseUrl("postgresql://u:p@[2001:db8::5]/db", "E").host).toBe("2001:db8::5");
  });
});

describe("re-inspection findings IR-009 … IR-015", () => {
  it("IR-009: PSL escapes are decoded; unknown escapes block the model instead of being dropped", () => {
    const ok = scanText(
      `${DS}model T {\n  id Int @id\n  @@map("caf\\u00e9")\n}\n`,
      dbModel([table("café", ["id"], [key("p", ["id"], { kind: "primary_key" })])]),
    );
    expect(status(ok, "DBP003:model T")).toBe("pass");
    const bad = scanText(`${DS}model T {\n  id Int @id\n  @@map("t\\q")\n}\n`, dbModel([table("tq", ["id"])]));
    expect(status(bad, "DBP003:model T")).toBe("unknown");
    expect(bad.result.exitCode).toBe(3);
  });

  it("IR-010: inputs skipped by discovery limits make the result inconclusive", () => {
    const r = scanFixture("healthy");
    const withSkipped = scanSources([{ path: "schema.prisma", text: readFileSync(join(FIXTURES, "healthy", "schema.prisma"), "utf8") }], {
      ...dbModel(parseSnapshot(JSON.parse(readFileSync(join(FIXTURES, "healthy", "snapshot.json"), "utf8"))).tables),
    });
    expect(r.result.exitCode).toBe(0);
    expect(withSkipped.result.exitCode).toBe(0);
    // simulate a depth-limited subtree through the model builder
    const loaded = buildPrismaModel([], [], [{ path: "deep/x", reason: "maximum directory depth exceeded" }]);
    expect(loaded.diagnostics.some((d) => d.code === "SCHEMA_INPUT_NOT_READ" && d.severity === "blocking")).toBe(true);
    const excluded = buildPrismaModel([], [], [{ path: "node_modules", reason: "excluded directory" }]);
    expect(excluded.diagnostics.some((d) => d.code === "SCHEMA_INPUT_NOT_READ")).toBe(false);
  });

  it("IR-011: a FK repeating one pair does not match a composite relation; snapshots reject repeated FK columns", () => {
    const r = scanFixture("healthy", {
      db: (d) => ({
        ...d,
        tables: d.tables.map((t) =>
          t.name === "snapshot_summaries"
            ? {
                ...t,
                foreignKeys: [
                  fk("dup", ["organization_id", "organization_id", "organization_id"], "monthly_snapshots", [
                    "organization_id",
                    "organization_id",
                    "organization_id",
                  ]),
                ],
              }
            : t,
        ),
      }),
    });
    expect(status(r, "DBP004:relation SnapshotSummary.snapshot")).toBe("fail");
    const s = JSON.parse(readFileSync(join(FIXTURES, "healthy", "snapshot.json"), "utf8"));
    s.tables[2].foreignKeys[0].columns = ["organization_id", "organization_id", "organization_id"];
    expect(() => parseSnapshot(s)).toThrow(DbpError);
  });

  it("IR-012: no FK to an out-of-scope referenced table is unknown, not fk_missing", () => {
    const text = `datasource db {\n  provider = "postgresql"\n  schemas = ["core", "reporting"]\n}\nmodel Parent {\n  id Int @id\n  kids Child[]\n  @@schema("core")\n}\nmodel Child {\n  id Int @id\n  pid Int\n  p Parent @relation(fields: [pid], references: [id])\n  @@schema("reporting")\n}\n`;
    const db = dbModel([table("Child", ["id", "pid"], [key("pk", ["id"], { kind: "primary_key" })], [], "reporting")]);
    const r = scanText(text, db, null);
    expect(r.checks.find((c) => c.id === "DBP004:relation Child.p")?.reasonCode).toBe("reference_not_resolved");
  });

  it("IR-013: nullable domain-typed columns make DBP006 unknown", () => {
    const t = table("T", ["id", "v?"], [key("pk", ["id"], { kind: "primary_key" })]);
    (t.columns[1] as { domainType?: boolean }).domainType = true;
    const r = scanText(`${DS}model T {\n  id Int @id\n  v Int?\n}\n`, dbModel([t]));
    expect(r.checks.find((c) => c.id === "DBP006:field T.v")?.reasonCode).toBe("domain_nullability_not_evaluated");
  });

  it("IR-014: secrets are redacted before truncation", () => {
    const longUser = "u".repeat(60);
    const msg = formatError(new Error(`${"x".repeat(1990)} postgres://${longUser}:hunter2secret@h/db`));
    expect(msg).not.toContain("hunter2");
  });

  it("IR-015: restricting scope drops gaps that belong only to excluded schemas", () => {
    const s = JSON.parse(readFileSync(join(FIXTURES, "healthy", "snapshot.json"), "utf8"));
    s.requestedSchemas = ["other", "public"];
    s.complete = false;
    s.gaps = [{ scope: "other", reason: "permission denied" }];
    const db = restrictScope(snapshotToDatabaseModel(parseSnapshot(s), "snapshot"), ["public"]);
    expect(db.complete).toBe(true);
    expect(db.gaps).toEqual([]);
    const s2 = { ...s, gaps: [] };
    expect(restrictScope(snapshotToDatabaseModel(parseSnapshot(s2), "snapshot"), ["public"]).complete).toBe(false);
  });
});
