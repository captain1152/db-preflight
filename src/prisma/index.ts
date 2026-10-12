import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import type { PrismaSchemaModel } from "../core/types.ts";
import { type DiscoveredFile, discoverPrismaFiles } from "./discover.ts";
import { buildPrismaModel } from "./model.ts";
import { parsePrismaFile } from "./parser.ts";

export interface LoadedPrisma {
  model: PrismaSchemaModel;
  inputKind: "file" | "directory";
  files: DiscoveredFile[];
}

/** Parse in-memory sources (used by the demo and tests). Paths must be POSIX relative. */
export function analyzePrismaSources(sources: { path: string; text: string }[]): PrismaSchemaModel {
  const sorted = [...sources].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  const asts = sorted.map((s) => parsePrismaFile(s.path, s.text));
  const files = sorted.map((s) => {
    const buf = Buffer.from(s.text, "utf8");
    return { path: s.path, sha256: createHash("sha256").update(buf).digest("hex"), bytes: buf.length };
  });
  return buildPrismaModel(asts, files, []);
}

export function loadPrismaSchema(input: string): LoadedPrisma {
  const d = discoverPrismaFiles(input);
  const asts = d.files.map((f) => parsePrismaFile(f.relPath, f.text));
  const model = buildPrismaModel(
    asts,
    d.files.map((f) => ({ path: f.relPath, sha256: f.sha256, bytes: f.bytes })),
    d.skipped,
  );
  return { model, inputKind: d.inputKind, files: d.files };
}

/** Re-hash inputs after analysis; true only if every file is byte-identical. */
export function verifyInputsUnchanged(files: DiscoveredFile[]): boolean {
  try {
    return files.every((f) => createHash("sha256").update(readFileSync(f.absPath)).digest("hex") === f.sha256);
  } catch {
    return false;
  }
}
