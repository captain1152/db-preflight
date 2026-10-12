// Generates fixtures/prisma-semantics/*.prisma: small synthetic variants used to pin down which
// uniqueness declarations Prisma ORM 7 accepts on the owning side of a 1:1 relation.
// Expected outcomes live in fixtures/prisma-semantics/manifest.json and are checked by
// `pnpm test:prisma` (real prisma@7.10.0) and by unit tests (our DBP001 implementation).
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures", "prisma-semantics");
mkdirSync(root, { recursive: true });

const composite = {
  "composite-none": { child: "id Int @id", uniq: "" },
  "composite-exact-unique": { child: "id Int @id", uniq: "@@unique([a, b, c])" },
  "composite-reordered-unique": { child: "id Int @id", uniq: "@@unique([c, a, b])" },
  "composite-subset-unique": { child: "id Int @id", uniq: "@@unique([a, b])" },
  "composite-superset-unique": { child: "id Int @id", uniq: "@@unique([a, b, c, id])" },
  "composite-exact-id": { child: "", uniq: "@@id([a, b, c])" },
  "composite-reordered-id": { child: "", uniq: "@@id([b, a, c])" },
  "composite-single-field-unique": { child: "id Int @id", uniq: "", aAttr: " @unique" },
};
for (const [name, v] of Object.entries(composite)) {
  const lines = [
    "datasource db {",
    '  provider = "postgresql"',
    "}",
    "",
    "model Parent {",
    "  a     Int",
    "  b     Int",
    "  c     Int",
    "  child Child?",
    "",
    "  @@id([a, b, c])",
    "}",
    "",
    "model Child {",
    ...(v.child ? [`  ${v.child}`] : []),
    `  a      Int${v.aAttr ?? ""}`,
    "  b      Int",
    "  c      Int",
    "  parent Parent @relation(fields: [a, b, c], references: [a, b, c])",
    ...(v.uniq ? ["", `  ${v.uniq}`] : []),
    "}",
    "",
  ];
  writeFileSync(join(root, `${name}.prisma`), lines.join("\n"));
}

const single = {
  "single-none": "  userId Int",
  "single-unique": "  userId Int @unique",
  "single-block-unique": "  userId Int\n\n  @@unique([userId])",
};
for (const [name, field] of Object.entries(single)) {
  const text = [
    "datasource db {",
    '  provider = "postgresql"',
    "}",
    "",
    "model User {",
    "  id      Int      @id",
    "  profile Profile?",
    "}",
    "",
    "model Profile {",
    "  id   Int  @id",
    "  user User @relation(fields: [userId], references: [id])",
    field,
    "}",
    "",
  ].join("\n");
  writeFileSync(join(root, `${name}.prisma`), text);
}
// single-id: relation field is the model's own @id.
writeFileSync(
  join(root, "single-id.prisma"),
  [
    "datasource db {",
    '  provider = "postgresql"',
    "}",
    "",
    "model User {",
    "  id      Int      @id",
    "  profile Profile?",
    "}",
    "",
    "model Profile {",
    "  userId Int  @id",
    "  user   User @relation(fields: [userId], references: [id])",
    "}",
    "",
  ].join("\n"),
);
mkdirSync(dirname(root), { recursive: true });
