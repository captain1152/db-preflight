// Builds the single-file CLI bundle and copies it, with license notices, into the Claude
// plugin directory (which marketplace installs copy on their own; see docs/publishing.md).
//
//   dist/db-preflight.cjs                         (npm package bin)
//   dist/THIRD_PARTY_LICENSES.txt
//   plugins/claude/db-preflight/dist/...          (committed; checked for freshness in CI)
//
// Usage: node scripts/build.mjs [--out-dir DIR] [--no-plugin]
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const repo = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const outDir = args.includes("--out-dir") ? args[args.indexOf("--out-dir") + 1] : join(repo, "dist");
const copyToPlugin = !args.includes("--no-plugin");
const pkg = JSON.parse(readFileSync(join(repo, "package.json"), "utf8"));

mkdirSync(outDir, { recursive: true });
const result = await build({
  entryPoints: [join(repo, "src/cli/bin.ts")],
  outfile: join(outDir, "db-preflight.cjs"),
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node20",
  charset: "utf8",
  legalComments: "none",
  minify: false,
  sourcemap: false,
  metafile: true,
  logLevel: "warning",
  // Optional native / Cloudflare transports of pg are never used by db-preflight.
  external: ["pg-native", "pg-cloudflare", "cloudflare:sockets"],
  define: { __DBP_VERSION__: JSON.stringify(pkg.version) },
  banner: { js: `#!/usr/bin/env node\n// db-preflight ${pkg.version} - bundled CLI. License: MIT. Third-party notices: THIRD_PARTY_LICENSES.txt` },
});

// Collect bundled third-party packages from the metafile.
const packages = new Map();
for (const input of Object.keys(result.metafile.inputs)) {
  const norm = input.split(sep).join("/");
  const idx = norm.lastIndexOf("node_modules/");
  if (idx === -1) continue;
  const restPath = norm.slice(idx + "node_modules/".length);
  const parts = restPath.split("/");
  const name = parts[0].startsWith("@") ? `${parts[0]}/${parts[1]}` : parts[0];
  const pkgDir = join(repo, norm.slice(0, idx + "node_modules/".length), name);
  if (!packages.has(name)) packages.set(name, pkgDir);
}
const sections = [];
for (const name of [...packages.keys()].sort()) {
  const dir = packages.get(name);
  const meta = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
  const licFile = ["LICENSE", "LICENSE.md", "LICENSE.txt", "license", "LICENCE"].map((f) => join(dir, f)).find((f) => existsSync(f));
  const text = licFile ? readFileSync(licFile, "utf8").replace(/\r\n/g, "\n").trim() : `(no license file shipped; package.json declares "${meta.license}")`;
  sections.push(`${"=".repeat(78)}\n${meta.name}@${meta.version} - ${meta.license}\n${"=".repeat(78)}\n${text}\n`);
}
const notices = `Third-party software bundled in db-preflight.cjs (db-preflight ${pkg.version})\n\n${sections.join("\n")}`;
writeFileSync(join(outDir, "THIRD_PARTY_LICENSES.txt"), notices);
const licenses = [...packages.keys()].sort().map((n) => {
  const m = JSON.parse(readFileSync(join(packages.get(n), "package.json"), "utf8"));
  return `${m.name}@${m.version} (${m.license})`;
});

if (copyToPlugin) {
  const pluginDist = join(repo, "plugins/claude/db-preflight/dist");
  mkdirSync(pluginDist, { recursive: true });
  copyFileSync(join(outDir, "db-preflight.cjs"), join(pluginDist, "db-preflight.cjs"));
  copyFileSync(join(outDir, "THIRD_PARTY_LICENSES.txt"), join(pluginDist, "THIRD_PARTY_LICENSES.txt"));
  copyFileSync(join(repo, "LICENSE"), join(pluginDist, "LICENSE"));
}
console.log(`built ${relative(repo, join(outDir, "db-preflight.cjs"))}; bundled packages: ${licenses.join(", ") || "none"}`);
