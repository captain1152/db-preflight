// Dev tool (Node >= 22.18 / 24, type stripping): regenerate fixtures/*/snapshot.json for fixtures
// whose fixture.json sets "snapshotSource": "live", by applying their db.sql to a DISPOSABLE
// local container and running the built CLI's `snapshot --live` as the metadata-only role.
// Usage: pnpm build && node scripts/regen-fixture-snapshots.ts [image]
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createFixtureDb, fixtureSql, metaUrl, REPO, startPostgres, stopPostgres } from "../tests/integration/pg-harness.ts";

const image = process.argv[2] ?? "postgres:16.15-alpine";
const c = await startPostgres(image);
try {
  for (const dir of readdirSync(join(REPO, "fixtures")).sort()) {
    let m: { snapshotSource?: string; dbSchemas: string[] };
    try {
      m = JSON.parse(readFileSync(join(REPO, "fixtures", dir, "fixture.json"), "utf8"));
    } catch {
      continue;
    }
    if (m.snapshotSource !== "live") continue;
    const db = `fx_${dir.replace(/[^a-z0-9]/g, "_")}`;
    await createFixtureDb(c, db, fixtureSql(dir));
    const out = join(tmpdir(), `dbp-regen-${dir}.json`);
    rmSync(out, { force: true });
    execFileSync(
      process.execPath,
      [join(REPO, "dist/db-preflight.cjs"), "snapshot", "--live", "--schemas", m.dbSchemas.join(","), "--db-url-env", "DBP_REGEN_URL", "--out", out],
      {
        env: { PATH: process.env.PATH ?? "", SystemRoot: process.env.SystemRoot ?? "", DBP_REGEN_URL: metaUrl(c, db) },
        stdio: ["ignore", "inherit", "inherit"],
      },
    );
    writeFileSync(join(REPO, "fixtures", dir, "snapshot.json"), readFileSync(out, "utf8"));
    rmSync(out, { force: true });
    console.log(`regenerated fixtures/${dir}/snapshot.json from ${image}`);
  }
} finally {
  stopPostgres(c);
}
