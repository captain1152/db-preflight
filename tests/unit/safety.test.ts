import { describe, expect, it } from "vitest";
import { DbpError } from "../../src/core/errors.ts";
import { isLoopback, parseDatabaseUrl, validateEnvName } from "../../src/postgres/connection.ts";
import { workerEnv } from "../../src/postgres/live.ts";
import { describeError, formatError, redact } from "../../src/safety/redact.ts";
import { mdCode, mdText, safeText, stripControl } from "../../src/safety/sanitize.ts";

const PASSWORD = "p@ss:w/rd%20 ü&x=1";
const URL_RAW = `postgresql://reader:${encodeURIComponent(PASSWORD)}@db.example.test:5432/app?sslmode=verify-full`;

describe("redaction", () => {
  it("removes raw, URL-encoded, form-encoded and decoded variants of a secret", () => {
    const variants = [PASSWORD, encodeURIComponent(PASSWORD), encodeURIComponent(PASSWORD).replace(/%20/g, "+"), encodeURIComponent(PASSWORD).toLowerCase()];
    for (const v of variants) {
      const out = redact(`failed for ${v} and url ${URL_RAW}`, [URL_RAW, PASSWORD]);
      expect(out).not.toContain(PASSWORD);
      expect(out).not.toContain(encodeURIComponent(PASSWORD));
      expect(out).not.toContain("reader:");
    }
  });

  it("removes URL userinfo and key=value secrets even without known secrets", () => {
    const out = redact("connect postgres://u:hunter2@h/db failed; password=hunter2 token: abc");
    expect(out).not.toContain("hunter2");
    expect(out).not.toContain("abc");
    expect(out).toContain("postgres://[REDACTED]@h/db");
  });

  it("walks nested causes and AggregateErrors, dropping stacks and details", () => {
    const inner = Object.assign(new Error(`password authentication failed for ${URL_RAW}`), { code: "28P01", detail: PASSWORD });
    const agg = new AggregateError([new Error(`ECONNREFUSED ${PASSWORD}`)], "all attempts failed");
    const outer = new Error("collector failed", { cause: Object.assign(agg, { cause: inner }) });
    const text = formatError(outer, [URL_RAW, PASSWORD]);
    expect(text).not.toContain(PASSWORD);
    expect(text).not.toContain(encodeURIComponent(PASSWORD));
    expect(text).toContain("28P01");
    expect(text).not.toMatch(/at .*\.ts:\d+/);
    expect(describeError(outer).length).toBeGreaterThanOrEqual(3);
  });
});

describe("connection URL handling", () => {
  it("parses explicit targets and never echoes the URL in errors", () => {
    const t = parseDatabaseUrl(URL_RAW, "X");
    expect(t).toMatchObject({ host: "db.example.test", port: 5432, database: "app", user: "reader", password: PASSWORD, sslMode: "verify-full" });
    for (const bad of [
      "not a url " + PASSWORD,
      `mysql://u:${PASSWORD}@h/db`,
      `postgres://u:${encodeURIComponent(PASSWORD)}@/db`,
      `postgres://u:${encodeURIComponent(PASSWORD)}@h/`,
      `postgres://:${encodeURIComponent(PASSWORD)}@h/db`,
      `postgres://u:${encodeURIComponent(PASSWORD)}@h/db?options=-c%20x`,
      `postgres://u:${encodeURIComponent(PASSWORD)}@h/db?sslmode=no-verify`,
    ]) {
      try {
        parseDatabaseUrl(bad, "MY_ENV");
        expect.unreachable(`should reject ${bad}`);
      } catch (e) {
        expect(e).toBeInstanceOf(DbpError);
        const msg = (e as Error).message;
        expect(msg).not.toContain(PASSWORD);
        expect(msg).not.toContain(encodeURIComponent(PASSWORD));
        expect(msg).toContain("MY_ENV");
      }
    }
  });

  it("defaults: verified TLS for remote hosts, no TLS for loopback, require => verify-full", () => {
    expect(parseDatabaseUrl("postgres://u@db.internal/x", "E").sslMode).toBe("verify-full");
    expect(parseDatabaseUrl("postgres://u@127.0.0.1/x", "E").sslMode).toBe("disable");
    expect(parseDatabaseUrl("postgres://u@db.internal/x?sslmode=require", "E").sslMode).toBe("verify-full");
    expect(parseDatabaseUrl("postgres://u@db.internal/x?sslmode=disable", "E").warnings[0]).toMatch(/not encrypted/);
    expect(isLoopback("[::1]")).toBe(true);
    expect(isLoopback("localhost.evil.test")).toBe(false);
  });

  it("only accepts environment variable names for --db-url-env", () => {
    expect(validateEnvName("DB_PREFLIGHT_DATABASE_URL")).toBe("DB_PREFLIGHT_DATABASE_URL");
    expect(() => validateEnvName("postgres://u:p@h/db")).toThrow(DbpError);
    expect(() => validateEnvName("1BAD")).toThrow(DbpError);
  });

  it("the live worker environment contains no PG*, DATABASE_URL, HOME or NODE_OPTIONS", () => {
    const env = workerEnv({
      PGPASSWORD: "x",
      PGHOST: "evil",
      PGPASSFILE: "/tmp/p",
      PGOPTIONS: "-c a=b",
      DATABASE_URL: "postgres://evil",
      HOME: "/home/u",
      APPDATA: "C:/x",
      NODE_OPTIONS: "--require evil.js",
      SystemRoot: "C:\\Windows",
      DB_PREFLIGHT_DATABASE_URL: "postgres://secret",
    });
    expect(Object.keys(env).sort()).toEqual(["SystemRoot"]);
  });
});

describe("output escaping", () => {
  const evil = "users\u001b[31m\u001b]8;;http://x\u0007link\u001b]8;;\u0007\r\n# heading <img src=x onerror=alert(1)> [a](http://x) `code` \u202e";
  it("strips ANSI/OSC sequences and control characters for terminals", () => {
    const s = safeText(evil);
    expect(s).not.toMatch(/\u001b/);
    expect(s).not.toContain("\r");
    expect(s).not.toContain("\n");
    expect(s).not.toContain("\u202e");
    expect(stripControl("a\u0000b")).toBe("a\\u{0}b");
  });
  it("escapes Markdown/HTML and builds unbreakable code spans", () => {
    const m = mdText(evil);
    expect(m).not.toContain("<img");
    expect(m).toContain("\\[a\\]");
    expect(m).not.toMatch(/^#/);
    const c = mdCode("a`b``c");
    expect(c.startsWith("```")).toBe(true);
    expect(c.endsWith("```")).toBe(true);
  });
});
