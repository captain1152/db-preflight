// Test-only: run the pinned Prisma ORM 7 CLI (`prisma validate`) against our synthetic fixtures
// and compare with the expected outcome recorded in each manifest. This never touches a
// database and is NOT part of the product runtime. Each schema is copied into a fresh temp
// directory so no project prisma.config.* or .env can be picked up.
import { execFileSync } from "node:child_process";
import { cpSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repo = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(join(repo, "package.json"));
const prismaPkg = require("prisma/package.json");
if (prismaPkg.version !== "7.10.0") {
  console.error(`expected pinned prisma 7.10.0, found ${prismaPkg.version}`);
  process.exit(2);
}
const prismaCli = join(dirname(require.resolve("prisma/package.json")), "build", "index.js");

// Minimal environment: no DATABASE_URL or other ambient variables are forwarded.
const env = {
  PATH: process.env.PATH ?? "",
  ...(process.env.SystemRoot ? { SystemRoot: process.env.SystemRoot } : {}),
  CHECKPOINT_DISABLE: "1",
  PRISMA_HIDE_UPDATE_MESSAGE: "1",
  NO_COLOR: "1",
};

function validate(schemaPath) {
  const work = mkdtempSync(join(tmpdir(), "dbp-prisma-"));
  try {
    const isDir = statSync(schemaPath).isDirectory();
    const target = join(work, isDir ? "schema" : basename(schemaPath));
    cpSync(schemaPath, target, { recursive: true });
    try {
      execFileSync(process.execPath, [prismaCli, "validate", "--schema", target], { cwd: work, env, stdio: "pipe" });
      return { ok: true, p1012: false, message: "", errors: [] };
    } catch (e) {
      const out = `${e.stdout ?? ""}${e.stderr ?? ""}`;
      const errors = out
        .split(/\r?\n/)
        .filter((l) => /^\s*error:/.test(l))
        .map((l) => l.trim());
      return { ok: false, p1012: out.includes("P1012"), message: errors[0] ?? "", errors };
    }
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

const cases = [];
const semantics = JSON.parse(readFileSync(join(repo, "fixtures/prisma-semantics/manifest.json"), "utf8"));
for (const [name, expected] of Object.entries(semantics.variants)) {
  cases.push({ name: `prisma-semantics/${name}`, path: join(repo, "fixtures/prisma-semantics", `${name}.prisma`), expected: expected.prismaValidate });
}
for (const dir of readdirSync(join(repo, "fixtures")).sort()) {
  const manifestPath = join(repo, "fixtures", dir, "fixture.json");
  try {
    statSync(manifestPath);
  } catch {
    continue;
  }
  const m = JSON.parse(readFileSync(manifestPath, "utf8"));
  cases.push({ name: dir, path: join(repo, "fixtures", dir, m.schema), expected: m.prismaValidate, expectedError: m.prismaExpectedError });
}

let failures = 0;
for (const c of cases) {
  const r = validate(c.path);
  const got = r.ok ? "pass" : r.p1012 ? "fail-P1012" : "fail";
  let okExpect = c.expected === got || (c.expected === "fail" && got.startsWith("fail"));
  if (okExpect && c.expectedError) {
    // Every reported error must be the expected relation error: a syntax error must not
    // satisfy the proof by accident (plan review R4).
    const syntax = r.errors.some((l) => /not a valid (field|definition)|Field declarations don't require/i.test(l));
    const allExpected = r.errors.length > 0 && r.errors.every((l) => l.includes(c.expectedError));
    okExpect = !syntax && allExpected;
  }
  if (!okExpect) failures++;
  console.log(`${okExpect ? "ok  " : "FAIL"} ${c.name}: expected ${c.expected}, got ${got}${r.message ? ` | ${r.message}` : ""}`);
}
console.log(`\nprisma ${prismaPkg.version}: ${cases.length - failures}/${cases.length} fixtures matched expectations`);
process.exit(failures ? 1 : 0);
