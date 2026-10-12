// Deterministic, read-only discovery of .prisma files under an explicit --schema path.
// No prisma.config.* is loaded or executed; symlinks are never followed.

import { createHash } from "node:crypto";
import { lstatSync, readdirSync, readFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { DbpError } from "../core/errors.ts";
import type { SkippedInput } from "../core/types.ts";

export interface DiscoveryLimits {
  maxFiles: number;
  maxFileBytes: number;
  maxTotalBytes: number;
  maxDepth: number;
}

export const DISCOVERY_LIMITS: DiscoveryLimits = {
  maxFiles: 500,
  maxFileBytes: 5 * 1024 * 1024,
  maxTotalBytes: 20 * 1024 * 1024,
  maxDepth: 32,
};

const EXCLUDED_DIRS = new Set(["node_modules", ".git", "dist", "build", "out", "coverage", ".next", ".turbo", "generated"]);

export interface DiscoveredFile {
  /** POSIX relative path from the input root. */
  relPath: string;
  absPath: string;
  text: string;
  sha256: string;
  bytes: number;
}

export interface DiscoveryResult {
  inputKind: "file" | "directory";
  root: string;
  files: DiscoveredFile[];
  skipped: SkippedInput[];
}

/** Byte-order (code unit) comparison, independent of locale. */
export function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

const utf8 = new TextDecoder("utf-8", { fatal: true });

export function discoverPrismaFiles(input: string, limits: DiscoveryLimits = DISCOVERY_LIMITS): DiscoveryResult {
  const abs = resolve(input);
  let st: ReturnType<typeof lstatSync>;
  try {
    st = lstatSync(abs);
  } catch {
    throw new DbpError("SCHEMA_NOT_FOUND", "--schema path does not exist or is not readable");
  }
  if (st.isSymbolicLink()) {
    throw new DbpError("SCHEMA_SYMLINK", "--schema must not be a symbolic link (symlinks are not followed)");
  }
  const skipped: SkippedInput[] = [];
  const found: { relPath: string; absPath: string }[] = [];
  let root: string;
  let inputKind: "file" | "directory";

  if (st.isFile()) {
    if (!abs.toLowerCase().endsWith(".prisma")) {
      throw new DbpError("SCHEMA_NOT_PRISMA", "--schema file must have the .prisma extension");
    }
    inputKind = "file";
    root = dirname(abs);
    found.push({ relPath: basename(abs), absPath: abs });
  } else if (st.isDirectory()) {
    inputKind = "directory";
    root = abs;
    const walk = (dir: string, rel: string, depth: number) => {
      if (depth > limits.maxDepth) {
        skipped.push({ path: rel || ".", reason: "maximum directory depth exceeded" });
        return;
      }
      const entries = readdirSync(dir, { withFileTypes: true })
        .map((e) => e.name)
        .sort(compareStrings);
      for (const name of entries) {
        const childAbs = join(dir, name);
        const childRel = rel ? `${rel}/${name}` : name;
        const cst = lstatSync(childAbs);
        // Name-based exclusions apply before symlink classification: an excluded name is out of
        // scope whether it is a directory or a link to one, and its target is never followed (REV-002).
        if ((cst.isDirectory() || cst.isSymbolicLink()) && EXCLUDED_DIRS.has(name)) {
          skipped.push({ path: childRel, reason: "excluded directory" });
          continue;
        }
        if (cst.isSymbolicLink()) {
          skipped.push({ path: childRel, reason: "symbolic link not followed" });
          continue;
        }
        if (cst.isDirectory()) {
          walk(childAbs, childRel, depth + 1);
        } else if (cst.isFile() && name.toLowerCase().endsWith(".prisma")) {
          found.push({ relPath: childRel, absPath: childAbs });
          if (found.length > limits.maxFiles) {
            throw new DbpError("SCHEMA_TOO_MANY_FILES", `more than ${limits.maxFiles} .prisma files under --schema`);
          }
        }
      }
    };
    walk(abs, "", 0);
  } else {
    throw new DbpError("SCHEMA_NOT_FILE", "--schema must be a regular file or a directory");
  }

  if (found.length === 0) {
    throw new DbpError("SCHEMA_EMPTY", "no .prisma files found under --schema");
  }

  let total = 0;
  const files: DiscoveredFile[] = [];
  for (const f of found) {
    const size = lstatSync(f.absPath).size;
    if (size > limits.maxFileBytes) {
      throw new DbpError("SCHEMA_FILE_TOO_LARGE", `${f.relPath} exceeds the ${limits.maxFileBytes} byte limit`);
    }
    total += size;
    if (total > limits.maxTotalBytes) {
      throw new DbpError("SCHEMA_TOO_LARGE", `.prisma files exceed the ${limits.maxTotalBytes} byte total limit`);
    }
    const buf = readFileSync(f.absPath);
    let text: string;
    try {
      text = utf8.decode(buf);
    } catch {
      throw new DbpError("SCHEMA_NOT_UTF8", `${f.relPath} is not valid UTF-8`);
    }
    files.push({
      relPath: f.relPath,
      absPath: f.absPath,
      text,
      sha256: createHash("sha256").update(buf).digest("hex"),
      bytes: buf.length,
    });
  }
  return { inputKind, root, files, skipped };
}
