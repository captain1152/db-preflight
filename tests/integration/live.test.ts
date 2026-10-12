// Integration tests against DISPOSABLE PostgreSQL containers created by pg-harness.ts.
// Images: DBP_PG_IMAGES (comma separated) or postgres:16.15-alpine,postgres:18.6-alpine.
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { collectCatalog, type QueryClient } from "../../src/postgres/collector.ts";
import { ALLOWED_SQL, QUERIES } from "../../src/postgres/queries.ts";
import { parseSnapshot } from "../../src/postgres/snapshot.ts";
import { FIXTURES, manifest } from "../helpers.ts";
import {
  adminClient,
  adminUrl,
  createFixtureDb,
  dockerAvailable,
  fingerprint,
  fixtureSql,
  metaUrl,
  type PgContainer,
  REPO,
  startPostgres,
  stopPostgres,
} from "./pg-harness.ts";

const BIN = join(REPO, "dist", "db-preflight.cjs");
const IMAGES = (process.env.DBP_PG_IMAGES ?? "postgres:16.15-alpine,postgres:18.6-alpine").split(",").filter(Boolean);
const FIXTURE_DBS = ["composite-one-to-one-mismatch", "healthy", "multi-schema-mapped", "relation-mode-prisma", "unsupported"];
const docker = dockerAvailable();
const work = mkdtempSync(join(tmpdir(), "dbp it "));

const HOSTILE = {
  DATABASE_URL: "postgresql://evil:evil-password@203.0.113.9:5432/prod",
  PGHOST: "203.0.113.9",
  PGPORT: "1",
  PGUSER: "evil",
  PGPASSWORD: "evil-password",
  PGDATABASE: "prod",
  PGOPTIONS: "-c default_transaction_read_only=off",
  PGREPLICATION: "database",
  PGBINARY: "true",
  PGSSLMODE: "verify-full",
  PGCLIENTENCODING: "LATIN1",
  PGPASSFILE: join(work, "pgpass-does-not-exist"),
};

function cli(args: string[], env: Record<string, string>) {
  const r = spawnSync(process.execPath, [BIN, ...args], {
    env: { PATH: process.env.PATH ?? "", SystemRoot: process.env.SystemRoot ?? "", ...HOSTILE, ...env },
    encoding: "utf8",
    timeout: 120_000,
  });
  return { code: r.status, stdout: r.stdout, stderr: r.stderr };
}

const dbName = (fixture: string) => `fx_${fixture.replace(/[^a-z0-9]/g, "_")}`;

function normalizeSnapshot(s: ReturnType<typeof parseSnapshot>) {
  return {
    requestedSchemas: s.requestedSchemas,
    schemasFound: s.schemasFound,
    complete: s.complete,
    gaps: s.gaps,
    tables: s.tables,
    otherRelations: s.otherRelations,
  };
}

afterAll(() => rmSync(work, { recursive: true, force: true }));

describe.skipIf(!docker.ok)("live PostgreSQL integration", () => {
  for (const image of IMAGES) {
    describe(image, () => {
      let c: PgContainer;
      const major = Number.parseInt(image.split(":")[1] ?? "0", 10);

      beforeAll(async () => {
        c = await startPostgres(image);
        for (const f of FIXTURE_DBS) await createFixtureDb(c, dbName(f), fixtureSql(f));
      });
      afterAll(() => {
        if (c) stopPostgres(c);
      });

      it("the metadata role cannot read table rows", async () => {
        const meta = adminClient(c, dbName("composite-one-to-one-mismatch"));
        // reuse admin client factory with meta credentials
        (meta as unknown as { user: string }).user = "dbp_meta";
        (meta as unknown as { password: () => Promise<string> }).password = async () => c.metaPassword;
        (meta as unknown as { connectionParameters: { user: string } }).connectionParameters.user = "dbp_meta";
        await meta.connect();
        await expect(meta.query("SELECT * FROM public.snapshot_summaries")).rejects.toMatchObject({ code: "42501" });
        await meta.end();
      });

      for (const f of FIXTURE_DBS) {
        it(`${f}: live snapshot matches the committed fixture snapshot; live scan matches snapshot scan; data unchanged`, async () => {
          const m = manifest(f);
          const before = await fingerprint(c, dbName(f));
          const out = join(work, `${major}-${f}.json`);
          rmSync(out, { force: true });
          const env = { DBP_IT_URL: metaUrl(c, dbName(f)) };
          const snap = cli(["snapshot", "--live", "--schemas", m.dbSchemas.join(","), "--db-url-env", "DBP_IT_URL", "--out", out], env);
          expect(snap.code, snap.stderr).toBe(0);
          const live = parseSnapshot(JSON.parse(readFileSync(out, "utf8")));
          const committed = parseSnapshot(JSON.parse(readFileSync(join(FIXTURES, f, m.snapshot), "utf8")));
          expect(normalizeSnapshot(live)).toEqual(normalizeSnapshot(committed));
          expect(live.readOnly.verified).toBe(true);
          expect(live.server.versionNum).toBeGreaterThanOrEqual(major * 10000);

          const args = ["scan", "--schema", join(FIXTURES, f, m.schema), "--format", "json", "--schemas", m.dbSchemas.join(",")];
          if (m.defaultSchema) args.push("--default-schema", m.defaultSchema);
          const liveScan = cli([...args, "--live", "--db-url-env", "DBP_IT_URL"], env);
          const snapScan = cli([...args, "--snapshot", join(FIXTURES, f, m.snapshot)], {});
          expect(liveScan.code, liveScan.stderr).toBe(m.expectedExitCode);
          expect(snapScan.code).toBe(m.expectedExitCode);
          const lr = JSON.parse(liveScan.stdout);
          const sr = JSON.parse(snapScan.stdout);
          expect(lr.checks.map((x: { id: string; status: string }) => [x.id, x.status])).toEqual(
            sr.checks.map((x: { id: string; status: string }) => [x.id, x.status]),
          );
          expect(lr.safety.readOnlyTransactionVerified).toBe(true);
          expect(lr.safety.roleVerifiedNotSuperuser).toBe(true);
          for (const id of lr.safety.catalogQueryIdsExecuted) expect(Object.keys(QUERIES)).toContain(id);
          expect(await fingerprint(c, dbName(f))).toBe(before);
        });
      }

      it("only allow-listed SQL is sent, inside a read-only transaction that is rolled back", async () => {
        const meta = adminClient(c, dbName("multi-schema-mapped"));
        (meta as unknown as { user: string }).user = "dbp_meta";
        (meta as unknown as { connectionParameters: { user: string } }).connectionParameters.user = "dbp_meta";
        (meta as unknown as { password: () => Promise<string> }).password = async () => c.metaPassword;
        await meta.connect();
        const sent: string[] = [];
        const recording: QueryClient = {
          query: async (text, values) => {
            sent.push(text);
            return (await meta.query(text, values as unknown[])) as unknown as { rows: Record<string, unknown>[] };
          },
        };
        const r = await collectCatalog(recording, ["core", "reporting"]);
        expect(sent.every((s) => ALLOWED_SQL.has(s))).toBe(true);
        expect(sent[0]).toBe(QUERIES.begin);
        expect(sent.at(-1)).toBe(QUERIES.rollback);
        expect(r.readOnlyVerified).toBe(true);
        expect(r.db.complete).toBe(true);
        const st = await meta.query("SELECT pg_catalog.current_setting('transaction_read_only') AS ro");
        expect((st.rows[0] as { ro: string }).ro).toBe("off"); // transaction ended; session default restored
        await meta.end();
      });

      it("superuser connections are refused without leaking the password", () => {
        const r = cli(["snapshot", "--live", "--schemas", "public", "--db-url-env", "DBP_ADMIN"], { DBP_ADMIN: adminUrl(c, dbName("healthy")) });
        expect(r.code).toBe(2);
        expect(r.stderr).toContain("SUPERUSER_REJECTED");
        expect(r.stderr).not.toContain(c.adminPassword);
      });

      it("wrong password fails with exit 2 and no secret in output", () => {
        const url = metaUrl(c, dbName("healthy")).replace(encodeURIComponent(c.metaPassword), encodeURIComponent("wrong-Pa55:/@"));
        const r = cli(["snapshot", "--live", "--schemas", "public", "--db-url-env", "DBP_BAD"], { DBP_BAD: url });
        expect(r.code).toBe(2);
        expect(`${r.stdout}${r.stderr}`).not.toContain("wrong-Pa55");
        expect(`${r.stdout}${r.stderr}`).not.toContain(encodeURIComponent("wrong-Pa55:/@"));
      });

      it("no db-preflight connections remain after runs", async () => {
        const a = adminClient(c);
        await a.connect();
        const rows = await a.query("SELECT count(*)::int AS n FROM pg_stat_activity WHERE application_name = 'db-preflight'");
        await a.end();
        expect((rows.rows[0] as { n: number }).n).toBe(0);
      });

      it("ordinary inheritance children make uniqueness, FK and nullability checks unknown", async () => {
        const db = "fx_inheritance";
        const noInherit = major >= 18 ? " NO INHERIT" : "";
        await createFixtureDb(
          c,
          db,
          `CREATE TABLE public.parents (id integer PRIMARY KEY);
           CREATE TABLE public.items (id integer NOT NULL, code text CONSTRAINT items_code_nn NOT NULL${noInherit}, parent_id integer REFERENCES public.parents(id), CONSTRAINT items_pkey PRIMARY KEY (id), CONSTRAINT items_code_key UNIQUE (code));
           CREATE TABLE public.items_archive (archived_at timestamp) INHERITS (public.items);
           ${major >= 18 ? "ALTER TABLE public.items_archive ALTER COLUMN code DROP NOT NULL;" : ""}`,
        );
        const dir = mkdtempSync(join(work, "inh-"));
        writeFileSync(
          join(dir, "s.prisma"),
          'datasource db {\n  provider = "postgresql"\n}\nmodel Parent {\n  id Int @id\n  items Item[]\n  @@map("parents")\n}\nmodel Item {\n  id Int @id\n  code String @unique\n  parentId Int? @map("parent_id")\n  parent Parent? @relation(fields: [parentId], references: [id])\n  @@map("items")\n}\n',
        );
        const r = cli(["scan", "--schema", dir, "--live", "--schemas", "public", "--default-schema", "public", "--db-url-env", "DBP_INH", "--format", "json"], {
          DBP_INH: metaUrl(c, db),
        });
        expect(r.code, r.stderr).toBe(3);
        const rep = JSON.parse(r.stdout);
        const st = (id: string) => rep.checks.find((x: { id: string }) => x.id === id)?.status;
        expect(st("DBP002:unique Item(code)")).toBe("unknown");
        expect(st("DBP004:relation Item.parent")).toBe("unknown");
        expect(st("DBP006:field Item.code")).toBe("unknown");
      });

      it("partition-inherited foreign keys are collected for models mapped to the parent or a leaf partition (IR-003)", async () => {
        const db = "fx_partitions";
        await createFixtureDb(
          c,
          db,
          `CREATE TABLE public.accounts (id integer PRIMARY KEY);
           CREATE TABLE public.events (id integer NOT NULL, account_id integer NOT NULL REFERENCES public.accounts(id), at date NOT NULL,
                                       CONSTRAINT events_pkey PRIMARY KEY (id, at)) PARTITION BY RANGE (at);
           CREATE TABLE public.events_2026 PARTITION OF public.events FOR VALUES FROM ('2026-01-01') TO ('2027-01-01');`,
        );
        const dir = mkdtempSync(join(work, "part-"));
        const model = (name: string, table: string) =>
          `model ${name} {\n  id Int\n  accountId Int @map("account_id")\n  at DateTime @db.Date\n  account Account @relation(fields: [accountId], references: [id])\n  @@id([id, at])\n  @@map("${table}")\n}\n`;
        writeFileSync(
          join(dir, "s.prisma"),
          `datasource db {\n  provider = "postgresql"\n}\nmodel Account {\n  id Int @id\n  events Event[]\n  leaf EventLeaf[]\n  @@map("accounts")\n}\n${model("Event", "events")}${model("EventLeaf", "events_2026")}`,
        );
        const r = cli(
          ["scan", "--schema", dir, "--live", "--schemas", "public", "--default-schema", "public", "--db-url-env", "DBP_PART", "--format", "json"],
          {
            DBP_PART: metaUrl(c, db),
          },
        );
        const rep = JSON.parse(r.stdout);
        const st = (id: string) => rep.checks.find((x: { id: string }) => x.id === id)?.status;
        expect(st("DBP004:relation Event.account")).toBe("pass");
        expect(st("DBP004:relation EventLeaf.account")).toBe("pass");
        expect(r.code, r.stderr).toBe(0);
      });

      it.runIf(major >= 18)("PostgreSQL 18 temporal (PERIOD) foreign keys are unknown, not pass (IR-004)", async () => {
        const db = "fx_period";
        await createFixtureDb(
          c,
          db,
          `CREATE EXTENSION IF NOT EXISTS btree_gist;
           CREATE TABLE public.p (id integer NOT NULL, valid_at daterange NOT NULL, CONSTRAINT p_pkey PRIMARY KEY (id, valid_at WITHOUT OVERLAPS));
           CREATE TABLE public.ch (id integer PRIMARY KEY, pid integer NOT NULL, valid_at daterange NOT NULL,
                                   CONSTRAINT ch_fk FOREIGN KEY (pid, PERIOD valid_at) REFERENCES public.p (id, PERIOD valid_at));`,
        );
        const dir = mkdtempSync(join(work, "period-"));
        writeFileSync(
          join(dir, "s.prisma"),
          'datasource db {\n  provider = "postgresql"\n}\nmodel P {\n  id Int\n  validAt Unsupported("daterange") @map("valid_at")\n  chs Ch[]\n  @@id([id, validAt])\n  @@map("p")\n}\nmodel Ch {\n  id Int @id\n  pid Int\n  validAt Unsupported("daterange") @map("valid_at")\n  p P @relation(fields: [pid, validAt], references: [id, validAt])\n  @@map("ch")\n}\n',
        );
        const r = cli(["scan", "--schema", dir, "--live", "--schemas", "public", "--default-schema", "public", "--db-url-env", "DBP_PER", "--format", "json"], {
          DBP_PER: metaUrl(c, db),
        });
        const rep = JSON.parse(r.stdout);
        expect(rep.checks.find((x: { id: string }) => x.id === "DBP004:relation Ch.p")?.reasonCode).toBe("fk_period_not_supported");
        expect(rep.checks.find((x: { id: string }) => x.id === "DBP002:id P(id, validAt)")?.status).toBe("unknown");
        expect(r.code).toBe(3);
      });

      it.runIf(major >= 18)("PostgreSQL 18 NOT NULL NOT VALID makes DBP006 unknown", async () => {
        const db = "fx_notvalid";
        await createFixtureDb(
          c,
          db,
          `CREATE TABLE public.things (id integer PRIMARY KEY, v integer);
           INSERT INTO public.things VALUES (1, NULL);
           ALTER TABLE public.things ADD CONSTRAINT things_v_nn NOT NULL v NOT VALID;`,
        );
        const dir = mkdtempSync(join(work, "nv-"));
        writeFileSync(join(dir, "s.prisma"), 'datasource db {\n  provider = "postgresql"\n}\nmodel Thing {\n  id Int @id\n  v Int\n  @@map("things")\n}\n');
        const r = cli(["scan", "--schema", dir, "--live", "--schemas", "public", "--default-schema", "public", "--db-url-env", "DBP_NV", "--format", "json"], {
          DBP_NV: metaUrl(c, db),
        });
        const rep = JSON.parse(r.stdout);
        expect(rep.checks.find((x: { id: string }) => x.id === "DBP006:field Thing.v")?.reasonCode).toBe("not_null_not_validated");
      });
    });
  }
});

describe.runIf(!docker.ok)("live PostgreSQL integration (docker unavailable)", () => {
  it.skip(`skipped: ${docker.reason ?? "docker unavailable"}`, () => {});
});
