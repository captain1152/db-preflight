// Package smoke test: proves that the distributable artifacts work WITHOUT the source checkout
// and WITHOUT node_modules.
//  1. Copy only plugins/claude/db-preflight into a temp folder whose path has spaces and Korean.
//  2. Run its bundled CLI (demo + offline scans) from a separate "project" folder.
//  3. On Windows, run the same through PowerShell to verify quoting and exit codes.
//  4. `npm pack` the package, extract the tarball elsewhere, and run the CLI from it.
import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const repo = join(dirname(fileURLToPath(import.meta.url)), "..");
const root = mkdtempSync(join(tmpdir(), "dbp smoke 공백-"));
const results = [];
let failed = 0;

function check(name, ok, detail = "") {
  results.push(`${ok ? "ok  " : "FAIL"} ${name}${detail ? ` - ${detail}` : ""}`);
  if (!ok) failed++;
}

// Minimal environment: no NODE_PATH, no PG*, no DATABASE_URL.
const env = { PATH: process.env.PATH ?? "", ...(process.env.SystemRoot ? { SystemRoot: process.env.SystemRoot } : {}) };

// fs.cpSync on Windows with Node 22 writes to a mis-encoded path when the destination contains
// non-ASCII characters (observed with 22.23.3; 24.x is fine), so copy with basic fs calls.
function copyDir(src, dst) {
  mkdirSync(dst, { recursive: true });
  for (const e of readdirSync(src, { withFileTypes: true })) {
    if (e.isDirectory()) copyDir(join(src, e.name), join(dst, e.name));
    else if (e.isFile()) copyFileSync(join(src, e.name), join(dst, e.name));
  }
}

function runNode(bin, args, cwd) {
  const r = spawnSync(process.execPath, [bin, ...args], { cwd, env, encoding: "utf8", timeout: 60_000 });
  return { code: r.status, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
}

try {
  // ---- 1. plugin directory alone ------------------------------------------------------------
  const pluginCopy = join(root, "plugin copy", "db-preflight");
  copyDir(join(repo, "plugins/claude/db-preflight"), pluginCopy);
  const required = [
    ".claude-plugin/plugin.json",
    "skills/scan/SKILL.md",
    "skills/explain/SKILL.md",
    "dist/db-preflight.cjs",
    "dist/THIRD_PARTY_LICENSES.txt",
    "dist/LICENSE",
  ];
  for (const f of required) check(`plugin contains ${f}`, existsSync(join(pluginCopy, f)));
  check("plugin copy has no node_modules", !existsSync(join(pluginCopy, "node_modules")));
  const skillText = readFileSync(join(pluginCopy, "skills/scan/SKILL.md"), "utf8");
  const pluginRootVar = ["$", "{CLAUDE_PLUGIN_ROOT}"].join("");
  check("skill uses the bundled CLI via the plugin root variable", skillText.includes(`${pluginRootVar}/dist/db-preflight.cjs`));
  check("skill does not reference the source tree", !/\.\.\/\.\.\/src|src\/cli/.test(skillText));
  check("skill never runs an npx-installed CLI", !/npx\s+(-y\s+)?(--yes\s+)?db-preflight/.test(skillText));

  const project = join(root, "user project 한글");
  mkdirSync(project, { recursive: true });
  copyDir(join(repo, "fixtures/composite-one-to-one-mismatch"), join(project, "broken"));
  copyDir(join(repo, "fixtures/healthy"), join(project, "healthy"));
  const bin = join(pluginCopy, "dist", "db-preflight.cjs");

  const demo = runNode(bin, ["demo", "--format", "json"], project);
  let demoDoc = null;
  try {
    demoDoc = JSON.parse(demo.stdout);
  } catch {}
  check("plugin bundle: demo exits 1 with one JSON document", demo.code === 1 && demoDoc?.mode === "demo", `code=${demo.code}`);
  const broken = runNode(bin, ["scan", "--schema", "broken/schema", "--snapshot", "broken/snapshot.json", "--default-schema", "public"], project);
  check("plugin bundle: relative-path scan of broken fixture exits 1", broken.code === 1, `code=${broken.code}`);
  const healthy = runNode(bin, ["scan", "--schema", "healthy/schema.prisma", "--snapshot", "healthy/snapshot.json", "--default-schema", "public"], project);
  check("plugin bundle: healthy fixture exits 0", healthy.code === 0, `code=${healthy.code}`);

  if (process.platform === "win32") {
    // PowerShell needs its usual environment to start; database-related variables are removed.
    const psEnv = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^(PG|DATABASE_URL$|DB_PREFLIGHT|NODE_PATH$|NODE_OPTIONS$)/i.test(k)));
    const psRun = (script) => {
      const enc = Buffer.from(script, "utf16le").toString("base64");
      return spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-EncodedCommand", enc], {
        cwd: project,
        env: psEnv,
        encoding: "utf8",
        timeout: 60_000,
      });
    };
    const q = bin.replace(/'/g, "''");
    const psDemo = psRun(`& node '${q}' demo --format json > $null; exit $LASTEXITCODE`);
    check("PowerShell: spaced/Korean plugin path, demo exit code 1 propagated", psDemo.status === 1, `code=${psDemo.status}`);
    const psScan = psRun(
      `& node '${q}' scan --schema 'healthy/schema.prisma' --snapshot 'healthy/snapshot.json' --default-schema public > $null; exit $LASTEXITCODE`,
    );
    check("PowerShell: offline scan from project CWD exits 0", psScan.status === 0, `code=${psScan.status}`);
  }

  // ---- 2. npm tarball ------------------------------------------------------------------------
  // npm on Windows runs through cmd.exe, so the pack output directory is kept ASCII-only and
  // quoted (Node joins shell arguments unescaped; the temp root itself may contain spaces).
  // The tarball is then extracted and executed under the spaced/Korean path.
  const packDir = mkdtempSync(join(tmpdir(), "dbp-pack-"));
  const win = process.platform === "win32";
  execFileSync(win ? "npm.cmd" : "npm", ["pack", "--pack-destination", win ? `"${packDir}"` : packDir, "--silent"], {
    cwd: repo,
    encoding: "utf8",
    shell: win,
  });
  const tgz = readdirSync(packDir).find((f) => f.endsWith(".tgz"));
  check("npm pack produced a tarball", !!tgz);
  if (tgz) {
    const extract = join(root, "extracted pkg 한글");
    mkdirSync(extract, { recursive: true });
    // GNU tar (e.g. Git Bash on Windows) reads "C:" in an archive or -C path as a remote host,
    // so extract in place with a drive-less relative archive path; bsdtar accepts the same.
    const archive = relative(extract, join(packDir, tgz)).split(sep).join("/");
    execFileSync("tar", ["-xzf", archive], { cwd: extract });
    const pkgRoot = join(extract, "package");
    const files = [];
    const walk = (d, rel = "") => {
      for (const n of readdirSync(d, { withFileTypes: true })) {
        const r = rel ? `${rel}/${n.name}` : n.name;
        if (n.isDirectory()) walk(join(d, n.name), r);
        else files.push(r);
      }
    };
    walk(pkgRoot);
    for (const f of [
      "dist/db-preflight.cjs",
      "dist/THIRD_PARTY_LICENSES.txt",
      "LICENSE",
      "README.md",
      "package.json",
      "schemas/report.schema.json",
      "schemas/snapshot.schema.json",
    ]) {
      check(`tarball contains ${f}`, files.includes(f));
    }
    check("tarball contains no src/, tests/ or fixtures/", !files.some((f) => /^(src|tests|fixtures)\//.test(f)));
    check("tarball contains no .env or snapshots of real DBs", !files.some((f) => /(^|\/)\.env/.test(f)));
    rmSync(packDir, { recursive: true, force: true });
    const r = runNode(join(pkgRoot, "dist", "db-preflight.cjs"), ["demo"], extract);
    check("tarball: demo runs without node_modules and exits 1", r.code === 1 && r.stdout.includes("MISMATCH FOUND"), `code=${r.code}`);
    const v = runNode(join(pkgRoot, "dist", "db-preflight.cjs"), ["--version"], extract);
    const pkg = JSON.parse(readFileSync(join(repo, "package.json"), "utf8"));
    check("tarball: --version matches package.json", v.stdout.trim() === pkg.version, v.stdout.trim());
  }
} finally {
  rmSync(root, { recursive: true, force: true });
}

console.log(results.join("\n"));
console.log(`\npackage smoke: ${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
