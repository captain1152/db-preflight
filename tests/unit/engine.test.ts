import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { evaluateUniqueness } from "../../src/core/uniqueness.ts";
import { DS, dbModel, FIXTURES, fk, key, manifest, scanFixture, scanSources, scanText, status, table } from "../helpers.ts";

const FIXTURE_NAMES = readdirSync(FIXTURES).filter((d) => {
  try {
    readFileSync(join(FIXTURES, d, "fixture.json"));
    return true;
  } catch {
    return false;
  }
});

describe("fixtures", () => {
  for (const name of FIXTURE_NAMES) {
    it(`${name}: exit code, expected checks and finding groups`, () => {
      const m = manifest(name);
      const r = scanFixture(name);
      expect(r.result.exitCode).toBe(m.expectedExitCode);
      for (const [id, st] of Object.entries(m.expectedChecks)) expect([id, status(r, id)]).toEqual([id, st]);
      expect(r.findingGroups).toHaveLength(m.expectedFindingGroups);
    });
  }

  it("composite mismatch: DBP001 and DBP005 are one linked root cause with Prisma and DB evidence", () => {
    const r = scanFixture("composite-one-to-one-mismatch");
    expect(r.findings.map((f) => f.ruleId)).toEqual(["DBP001", "DBP005"]);
    const [d1, d5] = r.findings;
    expect(d1?.groupId).toBe(d5?.groupId);
    expect(d1?.relatedFindingIds).toEqual([d5?.id]);
    expect(d5?.evidence.some((e) => e.kind === "prisma" && e.file === "reporting.prisma" && e.line === 25)).toBe(true);
    expect(d5?.evidence.some((e) => e.kind === "database" && e.object === "public.snapshot_summaries")).toBe(true);
    // Never claims duplicates exist and never offers UNIQUE as an unconditional fix.
    const text = JSON.stringify(r.findings);
    expect(text).toContain("does not mean duplicates currently exist");
    expect(text).not.toMatch(/add (a )?unique (constraint )?to fix/i);
  });

  it("is deterministic: same input gives identical checks, ids and order", () => {
    const a = scanFixture("multi-schema-mapped");
    const b = scanFixture("multi-schema-mapped");
    expect(JSON.stringify({ ...a, generatedAt: "" })).toBe(JSON.stringify({ ...b, generatedAt: "" }));
  });

  it("does not assume public when no default schema is given", () => {
    const r = scanFixture("composite-one-to-one-mismatch", { defaultSchema: null });
    expect(status(r, "DBP003:model SnapshotSummary")).toBe("unknown");
    expect(r.checks.find((c) => c.id === "DBP003:model SnapshotSummary")?.reasonCode).toBe("default_schema_unknown");
    // DBP001 needs no database and still fails => exit 1 with incomplete coverage.
    expect(r.result.exitCode).toBe(1);
    expect(r.coverage.completeWithinScope).toBe(false);
  });

  it("treats an incomplete collection as unknown, never as missing", () => {
    const r = scanFixture("healthy", { db: (db) => ({ ...db, complete: false, gaps: [{ scope: "public", reason: "query failed" }], tables: [] }) });
    expect(status(r, "DBP003:model SnapshotSummary")).toBe("unknown");
    expect(r.result.exitCode).toBe(3);
  });

  it("treats an out-of-scope schema as unknown", () => {
    const r = scanFixture("healthy", { defaultSchema: "elsewhere" });
    expect(r.checks.find((c) => c.id === "DBP003:model SnapshotSummary")?.reasonCode).toBe("schema_out_of_scope");
    expect(r.result.exitCode).toBe(3);
  });
});

describe("prisma-semantics manifest (DBP001 agrees with prisma@7.10.0)", () => {
  const sem = JSON.parse(readFileSync(join(FIXTURES, "prisma-semantics", "manifest.json"), "utf8")) as {
    variants: Record<string, { dbp001: string }>;
  };
  for (const [name, v] of Object.entries(sem.variants)) {
    it(name, () => {
      const text = readFileSync(join(FIXTURES, "prisma-semantics", `${name}.prisma`), "utf8");
      const r = scanText(text, dbModel([]), null);
      const owner = name.startsWith("single") ? "Profile.user" : "Child.parent";
      expect(status(r, `DBP001:relation ${owner}`)).toBe(v.dbp001);
    });
  }
});

const ONE_TO_ONE = `${DS}
model User {
  id      Int      @id
  profile Profile?
}
model Profile {
  id     Int  @id
  userId Int  @map("user_id")
  user   User @relation(fields: [userId], references: [id])
  UNIQ
}
`;

describe("DBP001 / DBP002 / DBP005 interplay", () => {
  const users = table("User", ["id"], [key("User_pkey", ["id"], { kind: "primary_key" })]);
  const fkUser = fk("Profile_user_id_fkey", ["user_id"], "User", ["id"]);

  it("DB is unique but Prisma declaration is missing: DBP001 fail, DBP005 pass", () => {
    const db = dbModel([
      users,
      table("Profile", ["id", "user_id"], [key("Profile_pkey", ["id"], { kind: "primary_key" }), key("Profile_user_id_key", ["user_id"])], [fkUser]),
    ]);
    const r = scanText(ONE_TO_ONE.replace("UNIQ", ""), db);
    expect(status(r, "DBP001:relation Profile.user")).toBe("fail");
    expect(status(r, "DBP005:relation Profile.user")).toBe("pass");
    expect(r.findings).toHaveLength(1);
  });

  it("Prisma declares @unique but DB does not enforce it: DBP002 + DBP005 linked, DBP001 pass", () => {
    const db = dbModel([users, table("Profile", ["id", "user_id"], [key("Profile_pkey", ["id"], { kind: "primary_key" })], [fkUser])]);
    const r = scanText(ONE_TO_ONE.replace("UNIQ", "@@unique([userId])"), db);
    expect(status(r, "DBP001:relation Profile.user")).toBe("pass");
    expect(status(r, "DBP002:unique Profile(userId)")).toBe("fail");
    expect(status(r, "DBP005:relation Profile.user")).toBe("fail");
    const groups = r.findingGroups.filter((g) => g.groupId === "relation:Profile.user");
    expect(groups[0]?.findingIds).toHaveLength(2);
    expect(r.findingGroups).toHaveLength(1);
  });
});

describe("uniqueness semantics", () => {
  const t = (keys: ReturnType<typeof key>[], extra = {}) => table("t", ["a", "b", "c", "d?"], keys, [], "public", extra);

  it("subset key guarantees the superset; superset key does not guarantee the subset", () => {
    expect(evaluateUniqueness(t([key("k", ["a"])]), ["a", "b"], true).status).toBe("guaranteed");
    expect(evaluateUniqueness(t([key("k", ["a", "b", "c"])]), ["a", "b"], true).status).toBe("not_guaranteed");
  });

  it("ignores key order and does not count INCLUDE columns as key", () => {
    expect(evaluateUniqueness(t([key("k", ["b", "a"])]), ["a", "b"], true).status).toBe("guaranteed");
    expect(evaluateUniqueness(t([key("k", ["c"], { includeColumns: ["a", "b"], kind: "unique_index" })]), ["a", "b"], true).status).toBe("not_guaranteed");
  });

  it("partial, expression, invalid, deferrable, period and exclusion keys are unknown, not 'missing'", () => {
    for (const extra of [
      { partial: true },
      { valid: false },
      { deferrable: true, immediate: false },
      { period: true },
      { kind: "exclusion_constraint" as const },
    ]) {
      expect(evaluateUniqueness(t([key("k", ["a"], extra)]), ["a", "b"], true).status).toBe("unknown");
    }
    expect(evaluateUniqueness(t([key("k", null, { kind: "unique_index" })]), ["a"], true).status).toBe("unknown");
  });

  it("ordinary inheritance children make uniqueness unknown; incomplete collection too", () => {
    const inh = { inheritance: { isPartition: false, hasInheritanceChildren: true, inheritsFrom: [] } };
    expect(evaluateUniqueness(t([key("k", ["a"])], inh), ["a"], true).status).toBe("unknown");
    expect(evaluateUniqueness(t([]), ["a"], false).status).toBe("unknown");
  });

  it("a nullable column in a guaranteeing key passes with a note about non-null rows", () => {
    const db = dbModel([table("Thing", ["id", "code?"], [key("pk", ["id"], { kind: "primary_key" }), key("u", ["code"])])]);
    const r = scanText(`${DS}model Thing {\n  id Int @id\n  code String? @unique\n}\n`, db);
    const c = r.checks.find((x) => x.id === "DBP002:unique Thing(code)");
    expect(c?.status).toBe("pass");
    expect(c?.evidence.some((e) => e.kind === "note" && e.detail.includes("non-null"))).toBe(true);
  });
});

describe("DBP003 / DBP004 / DBP006", () => {
  const prisma = `${DS}
model Author {
  id    Int    @id
  name  String
  posts Post[]
  @@map("authors")
}
model Post {
  id       Int    @id
  a        Int
  b        Int
  title    String
  subtitle String?
  author   Author @relation(fields: [a, b], references: [id, id2])
  @@map("posts")
}
`.replace("  name  String\n", "  name  String\n  id2   Int\n");

  const authors = table("authors", ["id", "id2", "name"], [key("authors_pkey", ["id"], { kind: "primary_key" }), key("authors_id_id2", ["id", "id2"])]);

  it("FK with swapped column pairing is a DBP004 mismatch", () => {
    const posts = table(
      "posts",
      ["id", "a", "b", "title", "subtitle?"],
      [key("posts_pkey", ["id"], { kind: "primary_key" })],
      [fk("posts_fk", ["a", "b"], "authors", ["id2", "id"])],
    );
    const r = scanText(prisma, dbModel([authors, posts]));
    const c = r.checks.find((x) => x.id === "DBP004:relation Post.author");
    expect(c?.status).toBe("fail");
    expect(c?.reasonCode).toBe("fk_mapping_mismatch");
  });

  it("FK listed in a different column order but same pairs passes", () => {
    const posts = table(
      "posts",
      ["id", "a", "b", "title", "subtitle?"],
      [key("posts_pkey", ["id"], { kind: "primary_key" })],
      [fk("posts_fk", ["b", "a"], "authors", ["id2", "id"])],
    );
    const r = scanText(prisma, dbModel([authors, posts]));
    expect(status(r, "DBP004:relation Post.author")).toBe("pass");
  });

  it("missing FK fails with foreignKeys and is not applicable with relationMode = prisma", () => {
    const posts = table("posts", ["id", "a", "b", "title", "subtitle?"], [key("posts_pkey", ["id"], { kind: "primary_key" })]);
    expect(scanText(prisma, dbModel([authors, posts])).checks.find((x) => x.id === "DBP004:relation Post.author")?.reasonCode).toBe("fk_missing");
    const rm = prisma.replace('provider = "postgresql"', 'provider = "postgresql"\n  relationMode = "prisma"');
    expect(status(scanText(rm, dbModel([authors, posts])), "DBP004:relation Post.author")).toBe("not_applicable");
  });

  it("NOT VALID foreign key is unknown, not pass", () => {
    const posts = table(
      "posts",
      ["id", "a", "b", "title", "subtitle?"],
      [key("posts_pkey", ["id"], { kind: "primary_key" })],
      [fk("posts_fk", ["a", "b"], "authors", ["id", "id2"], { validated: false })],
    );
    expect(status(scanText(prisma, dbModel([authors, posts])), "DBP004:relation Post.author")).toBe("unknown");
  });

  it("nullability mismatches in both directions; relation optionality is never used", () => {
    const posts = table(
      "posts",
      ["id", "a", "b", "title?", "subtitle"],
      [key("posts_pkey", ["id"], { kind: "primary_key" })],
      [fk("posts_fk", ["a", "b"], "authors", ["id", "id2"])],
    );
    const r = scanText(prisma, dbModel([authors, posts]));
    expect(r.checks.find((x) => x.id === "DBP006:field Post.title")?.reasonCode).toBe("required_but_nullable");
    expect(r.checks.find((x) => x.id === "DBP006:field Post.subtitle")?.reasonCode).toBe("optional_but_not_null");
    expect(r.checks.some((x) => x.id === "DBP006:field Post.author")).toBe(false);
    expect(r.findings.find((f) => f.subject === "field Post.subtitle")?.severity).toBe("warning");
  });

  it("missing column fails DBP003 and dependent checks become unknown (no double counting)", () => {
    const posts = table(
      "posts",
      ["id", "a", "b", "subtitle?"],
      [key("posts_pkey", ["id"], { kind: "primary_key" })],
      [fk("posts_fk", ["a", "b"], "authors", ["id", "id2"])],
    );
    const r = scanText(prisma, dbModel([authors, posts]));
    expect(status(r, "DBP003:model Post")).toBe("fail");
    expect(r.checks.find((x) => x.id === "DBP006:field Post.title")?.reasonCode).toBe("blocked_by_DBP003");
  });

  it("does not look tables up by Prisma logical names", () => {
    const db = dbModel([table("Post", ["id", "a", "b", "title", "subtitle?"]), table("Author", ["id", "id2", "name"])]);
    const r = scanText(prisma, db);
    expect(status(r, "DBP003:model Post")).toBe("fail");
  });

  it("same table name in two schemas resolves by @@schema", () => {
    const text = `datasource db {\n  provider = "postgresql"\n  schemas = ["a", "b"]\n}\nmodel X {\n  id Int @id\n  @@map("events")\n  @@schema("a")\n}\nmodel Y {\n  id Int @id\n  v Int\n  @@map("events")\n  @@schema("b")\n}\n`;
    const db = dbModel([
      table("events", ["id"], [key("p", ["id"], { kind: "primary_key" })], [], "a"),
      table("events", ["id"], [key("p", ["id"], { kind: "primary_key" })], [], "b"),
    ]);
    const r = scanText(text, db, null);
    expect(status(r, "DBP003:model X")).toBe("pass");
    expect(status(r, "DBP003:model Y")).toBe("fail");
  });

  it("a model mapped to a view in the database is unknown", () => {
    const db = dbModel([], { otherRelations: [{ schema: "public", name: "v_thing", kind: "view" }], requestedSchemas: ["public"] });
    const r = scanText(`${DS}model Thing {\n  id Int @id\n  @@map("v_thing")\n}\n`, db);
    expect(r.checks.find((x) => x.id === "DBP003:model Thing")?.reasonCode).toBe("unsupported_relation_kind");
  });

  it("NOT NULL NOT VALID and ordinary inheritance make DBP006 unknown", () => {
    const thing = table("Thing", ["id", "v"], [key("pk", ["id"], { kind: "primary_key" })]);
    (thing.columns[1] as { notNullUnvalidated?: boolean }).notNullUnvalidated = true;
    const r = scanText(`${DS}model Thing {\n  id Int @id\n  v Int\n}\n`, dbModel([thing]));
    expect(r.checks.find((x) => x.id === "DBP006:field Thing.v")?.reasonCode).toBe("not_null_not_validated");
    const inh = table("Thing", ["id", "v"], [key("pk", ["id"], { kind: "primary_key" })], [], "public", {
      inheritance: { isPartition: false, hasInheritanceChildren: true, inheritsFrom: [] },
    });
    const r2 = scanText(`${DS}model Thing {\n  id Int @id\n  v Int\n}\n`, dbModel([inh]));
    expect(status(r2, "DBP006:field Thing.v")).toBe("unknown");
    expect(status(r2, "DBP002:id Thing(id)")).toBe("unknown");
  });
});

describe("unsupported syntax is never 'healthy'", () => {
  it("a model with an unparseable line yields unknown checks and exit 3", () => {
    const db = dbModel([table("A", ["id"], [key("pk", ["id"], { kind: "primary_key" })])]);
    const r = scanSources([{ path: "s.prisma", text: `${DS}model A {\n  id Int @id\n  ??? what\n}\n` }], db);
    expect(status(r, "DBP003:model A")).toBe("unknown");
    expect(r.result.exitCode).toBe(3);
  });

  it("missing datasource makes relation-mode checks unknown", () => {
    const db = dbModel([table("A", ["id"]), table("B", ["id", "aId"])]);
    const r = scanText("model A {\n  id Int @id\n  bs B[]\n}\nmodel B {\n  id Int @id\n  aId Int\n  a A @relation(fields: [aId], references: [id])\n}\n", db);
    expect(r.checks.find((x) => x.id === "DBP004:relation B.a")?.reasonCode).toBe("relation_mode_unknown");
  });
});
