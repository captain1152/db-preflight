import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { DbpError } from "../../src/core/errors.ts";
import { discoverPrismaFiles } from "../../src/prisma/discover.ts";
import { loadPrismaSchema } from "../../src/prisma/index.ts";

const dirs: string[] = [];
function tmp(): string {
  const d = mkdtempSync(join(tmpdir(), "dbp 공백 한글-"));
  dirs.push(d);
  return d;
}
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

describe("schema discovery", () => {
  it("walks directories deterministically, skips excluded dirs, handles spaces/Korean and CRLF", () => {
    const root = tmp();
    mkdirSync(join(root, "모델 폴더"));
    mkdirSync(join(root, "node_modules"));
    writeFileSync(join(root, "b.prisma"), 'datasource db {\r\n  provider = "postgresql"\r\n}\r\n');
    writeFileSync(join(root, "모델 폴더", "a 파일.prisma"), "model A {\r\n  id Int @id\r\n  name String // 주석\r\n}\r\n");
    writeFileSync(join(root, "node_modules", "x.prisma"), "model X {\n  id Int @id\n}\n");
    writeFileSync(join(root, "notes.txt"), "ignored");
    const d = discoverPrismaFiles(root);
    expect(d.files.map((f) => f.relPath)).toEqual(["b.prisma", "모델 폴더/a 파일.prisma"]);
    expect(d.skipped).toContainEqual({ path: "node_modules", reason: "excluded directory" });
    const loaded = loadPrismaSchema(root);
    expect(loaded.model.models[0]?.fields[1]?.span).toMatchObject({ file: "모델 폴더/a 파일.prisma", line: 3, column: 3 });
  });

  it("does not follow symlinks", (ctx) => {
    const root = tmp();
    const outside = tmp();
    writeFileSync(join(outside, "secret.prisma"), "model S {\n  id Int @id\n}\n");
    writeFileSync(join(root, "a.prisma"), "model A {\n  id Int @id\n}\n");
    try {
      symlinkSync(join(outside, "secret.prisma"), join(root, "link.prisma"));
    } catch {
      ctx.skip("symlink creation not permitted on this machine (Windows without developer mode)");
      return;
    }
    const d = discoverPrismaFiles(root);
    expect(d.files.map((f) => f.relPath)).toEqual(["a.prisma"]);
    expect(d.skipped).toContainEqual({ path: "link.prisma", reason: "symbolic link not followed" });
  });

  it("enforces explicit input and limits", () => {
    const root = tmp();
    expect(() => discoverPrismaFiles(join(root, "missing"))).toThrow(DbpError);
    expect(() => discoverPrismaFiles(root)).toThrow(/no \.prisma files/);
    writeFileSync(join(root, "x.txt"), "x");
    expect(() => discoverPrismaFiles(join(root, "x.txt"))).toThrow(DbpError);
    writeFileSync(join(root, "big.prisma"), "x".repeat(2048));
    expect(() => discoverPrismaFiles(root, { maxFiles: 10, maxFileBytes: 1024, maxTotalBytes: 4096, maxDepth: 4 })).toThrow(/limit/);
    writeFileSync(join(root, "bad.prisma"), Buffer.from([0xff, 0xfe, 0x00]));
    expect(() => discoverPrismaFiles(join(root, "bad.prisma"))).toThrow(/UTF-8/);
  });
});
