import { describe, expect, it } from "vitest";
import { analyzePrismaSources } from "../../src/prisma/index.ts";
import { parsePrismaFile } from "../../src/prisma/parser.ts";
import { tokenize } from "../../src/prisma/tokenizer.ts";

describe("tokenizer", () => {
  it("keeps comment markers inside strings and tracks CRLF line numbers", () => {
    const toks = tokenize('a "x // y"\r\nb // c\r\n');
    const str = toks.find((t) => t.type === "string");
    expect(str?.value).toBe("x // y");
    const b = toks.find((t) => t.type === "ident" && t.value === "b");
    expect(b?.line).toBe(2);
    expect(b?.column).toBe(1);
    expect(toks.filter((t) => t.type === "comment")).toHaveLength(1);
  });

  it("skips a BOM and decodes escapes", () => {
    const toks = tokenize('﻿x "a\\"b"');
    expect(toks[0]?.value).toBe("x");
    expect(toks[0]?.column).toBe(1);
    expect(toks[1]?.value).toBe('a"b');
  });

  it("reports unclassifiable characters as invalid tokens instead of dropping them", () => {
    const toks = tokenize("model 한글 {}");
    expect(toks.some((t) => t.type === "invalid")).toBe(true);
  });
});

describe("parser", () => {
  it("parses models, fields, attributes and block attributes with spans", () => {
    const ast = parsePrismaFile(
      "s.prisma",
      'model User {\n  id    Int    @id @default(autoincrement())\n  email String @unique @map("email_address")\n  posts Post[]\n  bio   String? @db.VarChar(200)\n\n  @@map("users")\n}\n',
    );
    expect(ast.diagnostics).toEqual([]);
    const m = ast.blocks[0];
    expect(m?.keyword).toBe("model");
    expect(m?.fields.map((f) => [f.name, f.typeName, f.isList, f.isOptional])).toEqual([
      ["id", "Int", false, false],
      ["email", "String", false, false],
      ["posts", "Post", true, false],
      ["bio", "String", false, true],
    ]);
    expect(m?.fields[1]?.span).toMatchObject({ file: "s.prisma", line: 3, column: 3 });
    expect(m?.fields[3]?.attributes[0]?.name).toBe("db.VarChar");
    expect(m?.blockAttributes[0]?.name).toBe("map");
  });

  it("reads multi-line attributes but warns that Prisma 7 rejects them", () => {
    const ast = parsePrismaFile(
      "m.prisma",
      "model A {\n  id Int @id\n  b  B @relation(\n    fields: [bId],\n    references: [id]\n  )\n  bId Int\n  @@unique([\n    bId\n  ])\n}\n",
    );
    const a = ast.blocks[0];
    expect(a?.fields.map((f) => f.name)).toEqual(["id", "b", "bId"]);
    const warnings = a?.diagnostics.filter((d) => d.code === "PSL_MULTILINE_REJECTED_BY_PRISMA") ?? [];
    expect(warnings).toHaveLength(2);
    expect(warnings.every((w) => w.severity === "warning")).toBe(true);
    expect(a?.blockAttributes[0]?.args?.[0]?.value.kind).toBe("array");
  });

  it("records a located blocking diagnostic for an unparseable line instead of skipping it silently", () => {
    const ast = parsePrismaFile("e.prisma", "model A {\n  id Int @id\n  broken Int @relation(fields: [x\n  ok String\n}\n");
    const a = ast.blocks[0];
    expect(a?.diagnostics.some((d) => d.severity === "blocking" && d.code === "PSL_SYNTAX" && (d.span?.line ?? 0) >= 3)).toBe(true);
    expect(a?.fields.map((f) => f.name)).toEqual(["id"]);
  });

  it("flags unknown top-level blocks and keeps parsing afterwards", () => {
    const ast = parsePrismaFile("u.prisma", "widget W {\n  x y\n}\nmodel M {\n  id Int @id\n}\n");
    expect(ast.diagnostics.some((d) => d.code === "PSL_UNSUPPORTED_BLOCK")).toBe(true);
    expect(ast.blocks.find((b) => b.keyword === "model")?.fields).toHaveLength(1);
  });
});

describe("model building", () => {
  it("separates generator blocks safely and ignores datasource URLs", () => {
    const m = analyzePrismaSources([
      {
        path: "a.prisma",
        text: 'generator client {\n  provider = "prisma-client"\n  output = "../x"\n}\ndatasource db {\n  provider = "postgresql"\n  url = env("SHOULD_NOT_BE_READ")\n  relationMode = "prisma"\n}\n',
      },
    ]);
    expect(m.datasource).toMatchObject({ provider: "postgresql", relationMode: "prisma", relationModeSource: "explicit" });
    expect(JSON.stringify(m)).not.toContain("SHOULD_NOT_BE_READ");
  });

  it("applies @map, @@map and @@schema and keeps Prisma and database names", () => {
    const m = analyzePrismaSources([
      {
        path: "a.prisma",
        text: 'datasource db {\n  provider = "postgresql"\n  schemas = ["core"]\n}\nmodel Account {\n  id Int @id @map("account_id")\n  @@map("accounts")\n  @@schema("core")\n}\n',
      },
    ]);
    const a = m.models[0];
    expect(a).toMatchObject({ name: "Account", dbName: "accounts", schema: "core" });
    expect(a?.fields[0]).toMatchObject({ name: "id", dbName: "account_id", isId: true });
  });

  it("orders multiple files deterministically regardless of input order", () => {
    const files = [
      { path: "b/z.prisma", text: "model Z {\n  id Int @id\n}\n" },
      { path: "a.prisma", text: "model A {\n  id Int @id\n}\n" },
    ];
    const one = analyzePrismaSources(files);
    const two = analyzePrismaSources([...files].reverse());
    expect(one.files.map((f) => f.path)).toEqual(["a.prisma", "b/z.prisma"]);
    expect(JSON.stringify(one)).toBe(JSON.stringify(two));
  });

  it("resolves named relations between one model pair and a self relation", () => {
    const m = analyzePrismaSources([
      {
        path: "s.prisma",
        text: [
          "model User {",
          "  id Int @id",
          "  managerId Int?",
          '  manager User? @relation("Mgmt", fields: [managerId], references: [id])',
          '  reports User[] @relation("Mgmt")',
          '  written Post[] @relation("Author")',
          '  edited Post[] @relation("Editor")',
          "}",
          "model Post {",
          "  id Int @id",
          "  authorId Int",
          "  editorId Int?",
          '  author User @relation("Author", fields: [authorId], references: [id])',
          '  editor User? @relation("Editor", fields: [editorId], references: [id])',
          "}",
        ].join("\n"),
      },
    ]);
    const byId = Object.fromEntries(m.relations.map((r) => [r.id, r]));
    expect(byId["User.manager"]).toMatchObject({ status: "resolved", kind: "one_to_many", name: "Mgmt" });
    expect(byId["Post.author"]).toMatchObject({ status: "resolved", kind: "one_to_many", other: { field: "written" } });
    expect(byId["Post.editor"]).toMatchObject({ status: "resolved", kind: "one_to_many", other: { field: "edited" } });
  });

  it("marks relations ambiguous instead of guessing", () => {
    const m = analyzePrismaSources([
      {
        path: "s.prisma",
        text: [
          "model User {",
          "  id Int @id",
          "  a Post[]",
          "  b Post[]",
          "}",
          "model Post {",
          "  id Int @id",
          "  uid Int",
          "  vid Int",
          "  u User @relation(fields: [uid], references: [id])",
          "  v User @relation(fields: [vid], references: [id])",
          "}",
          "model Lonely {",
          "  id Int @id",
          "  uid Int",
          "  user User2 @relation(fields: [uid], references: [id])",
          "}",
          "model User2 {",
          "  id Int @id",
          "}",
        ].join("\n"),
      },
    ]);
    const amb = m.relations.filter((r) => r.status === "ambiguous");
    expect(amb.length).toBeGreaterThanOrEqual(2);
    const lonely = m.relations.find((r) => r.id === "Lonely.user");
    expect(lonely).toMatchObject({ status: "ambiguous", kind: "unknown" });
    expect(lonely?.owner?.fields).toEqual(["uid"]);
  });

  it("identifies implicit many-to-many, views and composite types", () => {
    const m = analyzePrismaSources([
      {
        path: "s.prisma",
        text: "model A {\n  id Int @id\n  bs B[]\n}\nmodel B {\n  id Int @id\n  as A[]\n}\nview V {\n  id Int @unique\n}\ntype T {\n  x Int\n}\n",
      },
    ]);
    expect(m.relations[0]).toMatchObject({ kind: "implicit_many_to_many", status: "resolved" });
    expect(m.models.find((x) => x.name === "V")?.blockKind).toBe("view");
    expect(m.diagnostics.some((d) => d.code === "PRISMA_UNSUPPORTED_COMPOSITE_TYPE")).toBe(true);
  });

  it("marks partial uniques and unknown decision-affecting attributes as not evaluable", () => {
    const m = analyzePrismaSources([
      {
        path: "s.prisma",
        text: 'model A {\n  id Int @id\n  e String\n  x Int @shardKey\n  @@unique([e], where: raw("x > 0"))\n  @@fulltext([e])\n}\n',
      },
    ]);
    const a = m.models[0];
    expect(a?.uniques.find((u) => u.origin === "block")).toMatchObject({ supported: false });
    expect(a?.fields.find((f) => f.name === "x")?.issues[0]?.code).toBe("PRISMA_UNSUPPORTED_ATTRIBUTE");
    expect(a?.issues.some((i) => i.message.includes("@@fulltext"))).toBe(true);
  });

  it("keeps the model but marks it unknown when a line inside it cannot be parsed", () => {
    const m = analyzePrismaSources([{ path: "s.prisma", text: "model A {\n  id Int @id\n  ??? garbage\n}\n" }]);
    expect(m.models[0]?.issues.some((i) => i.code === "PSL_SYNTAX")).toBe(true);
  });
});
