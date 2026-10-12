import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { renderMarkdown } from "../../src/reporters/markdown.ts";
import { renderText } from "../../src/reporters/text.ts";
import { DS, dbModel, key, REPO, scanFixture, scanText, table } from "../helpers.ts";

describe("reporters", () => {
  const evilName = "evil\u001b[2J\u001b]0;pwned\u0007`x`<b>";
  const r = scanText(
    `${DS}model T {\n  id Int @id\n  @@map("${evilName.replace(/\u001b|\u0007/g, "")}")\n}\n`,
    dbModel([table(evilName, ["id"], [key("k\u001b[31m", ["id"])])]),
  );

  it("text output never contains terminal control sequences from data", () => {
    const text = renderText(scanFixture("composite-one-to-one-mismatch"), { color: false });
    expect(text).not.toMatch(/\u001b/);
    const t2 = renderText(r, { color: false });
    expect(t2).not.toMatch(/\u001b/);
    expect(t2).not.toMatch(/\u0007/);
  });

  it("markdown escapes HTML from data", () => {
    const md = renderMarkdown(scanFixture("composite-one-to-one-mismatch"));
    expect(md).toContain("# DB Preflight report");
    expect(md).not.toMatch(/<b>/);
  });

  it("text output separates checked-scope results from a whole-database guarantee", () => {
    const text = renderText(scanFixture("healthy"), { color: false });
    expect(text).toContain("NO MISMATCH IN CHECKED SCOPE");
    expect(text).toContain("not a guarantee that the database as a whole is correct");
  });
});

describe("demo data", () => {
  it("src/demo/data.ts is in sync with fixtures (run node scripts/gen-demo-data.mjs)", async () => {
    const dir = mkdtempSync(join(tmpdir(), "dbp-demo-"));
    try {
      const mod = (await import(`file://${join(REPO, "scripts", "gen-demo-data.mjs").replace(/\\/g, "/")}`)) as { renderDemoData: () => string };
      const expected = mod.renderDemoData();
      writeFileSync(join(dir, "x.ts"), expected);
      expect(readFileSync(join(REPO, "src", "demo", "data.ts"), "utf8").replace(/\r\n/g, "\n")).toBe(expected);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
