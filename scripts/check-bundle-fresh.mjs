// Fails if the committed plugin bundle differs from a fresh build of the current sources.
// The plugin directory is what marketplace installs copy, so it must never be stale.
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repo = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = mkdtempSync(join(tmpdir(), "dbp-fresh-"));
try {
  execFileSync(process.execPath, [join(repo, "scripts/build.mjs"), "--out-dir", out, "--no-plugin"], { stdio: "pipe" });
  const stale = [];
  for (const f of ["db-preflight.cjs", "THIRD_PARTY_LICENSES.txt"]) {
    const fresh = readFileSync(join(out, f));
    const committed = readFileSync(join(repo, "plugins/claude/db-preflight/dist", f));
    if (!fresh.equals(committed)) stale.push(f);
  }
  if (!readFileSync(join(repo, "LICENSE")).equals(readFileSync(join(repo, "plugins/claude/db-preflight/dist/LICENSE")))) stale.push("LICENSE");
  if (stale.length) {
    console.error(`plugin bundle is stale: ${stale.join(", ")}. Run \`pnpm build\` and commit plugins/claude/db-preflight/dist.`);
    process.exit(1);
  }
  console.log("plugin bundle is up to date with the sources");
} finally {
  rmSync(out, { recursive: true, force: true });
}
