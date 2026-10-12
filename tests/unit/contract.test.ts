// Validates real reports and snapshots against schemas/*.schema.json with a small validator for
// the JSON Schema subset those files use (type, const, enum, required, properties, items, $ref,
// minItems, minLength, maxLength).
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FIXTURES, REPO, scanFixture } from "../helpers.ts";

type Schema = Record<string, unknown>;

function validate(value: unknown, schema: Schema, root: Schema, path = "$"): string[] {
  if (typeof schema.$ref === "string") {
    const target = (schema.$ref as string)
      .replace("#/", "")
      .split("/")
      .reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], root);
    return validate(value, target as Schema, root, path);
  }
  const errs: string[] = [];
  const typeOf = (v: unknown) => (v === null ? "null" : Array.isArray(v) ? "array" : Number.isInteger(v) ? "integer" : typeof v);
  if ("const" in schema && value !== schema.const) errs.push(`${path}: expected const ${JSON.stringify(schema.const)}`);
  if (Array.isArray(schema.enum) && !schema.enum.includes(value as never)) errs.push(`${path}: ${JSON.stringify(value)} not in enum`);
  if (schema.type) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    const t = typeOf(value);
    if (!types.includes(t) && !(t === "integer" && types.includes("number"))) errs.push(`${path}: type ${t} not in ${types.join("|")}`);
  }
  if (typeof value === "string") {
    if (typeof schema.minLength === "number" && value.length < schema.minLength) errs.push(`${path}: too short`);
    if (typeof schema.maxLength === "number" && value.length > schema.maxLength) errs.push(`${path}: too long`);
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    for (const r of (schema.required as string[] | undefined) ?? []) if (!(r in (value as object))) errs.push(`${path}: missing ${r}`);
    for (const [k, sub] of Object.entries((schema.properties as Record<string, Schema> | undefined) ?? {})) {
      if (k in (value as object)) errs.push(...validate((value as Record<string, unknown>)[k], sub, root, `${path}.${k}`));
    }
  }
  if (Array.isArray(value)) {
    if (typeof schema.minItems === "number" && value.length < schema.minItems) errs.push(`${path}: too few items`);
    if (schema.items) {
      for (const [i, v] of value.entries()) errs.push(...validate(v, schema.items as Schema, root, `${path}[${i}]`));
    }
  }
  return errs;
}

const reportSchema = JSON.parse(readFileSync(join(REPO, "schemas/report.schema.json"), "utf8")) as Schema;
const snapshotSchema = JSON.parse(readFileSync(join(REPO, "schemas/snapshot.schema.json"), "utf8")) as Schema;
const fixtures = readdirSync(FIXTURES).filter((d) => {
  try {
    readFileSync(join(FIXTURES, d, "fixture.json"));
    return true;
  } catch {
    return false;
  }
});

describe("JSON contracts", () => {
  for (const f of fixtures) {
    it(`${f}: report matches schemas/report.schema.json`, () => {
      const report = JSON.parse(JSON.stringify(scanFixture(f)));
      expect(validate(report, reportSchema, reportSchema)).toEqual([]);
    });
    it(`${f}: snapshot matches schemas/snapshot.schema.json`, () => {
      const snap = JSON.parse(readFileSync(join(FIXTURES, f, "snapshot.json"), "utf8"));
      expect(validate(snap, snapshotSchema, snapshotSchema)).toEqual([]);
    });
  }

  it("the validator itself rejects a broken report", () => {
    const bad = JSON.parse(JSON.stringify(scanFixture("healthy")));
    bad.result.exitCode = 2;
    delete bad.coverage;
    bad.checks[0].status = "ok";
    expect(validate(bad, reportSchema, reportSchema).length).toBeGreaterThanOrEqual(3);
  });
});
