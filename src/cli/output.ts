// Guarded --out writing: never overwrites by default, and never (even with --force) writes
// onto an input file, a .prisma file, a symlink or a hard link of an input.

import { randomBytes } from "node:crypto";
import { closeSync, existsSync, linkSync, lstatSync, openSync, realpathSync, renameSync, rmSync, statSync, writeSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { DbpError } from "../core/errors.ts";

function canonical(p: string): string {
  const abs = resolve(p);
  let dir: string;
  try {
    dir = realpathSync.native(dirname(abs));
  } catch {
    throw new DbpError("OUT_DIR_MISSING", "--out directory does not exist");
  }
  const full = resolve(dir, basename(abs));
  return process.platform === "win32" || process.platform === "darwin" ? full.toLowerCase() : full;
}

export function checkOutPath(out: string, inputs: string[], force: boolean): void {
  if (out.toLowerCase().endsWith(".prisma")) {
    throw new DbpError("OUT_IS_PRISMA", "--out must not be a .prisma file");
  }
  const target = canonical(out);
  const inputSet = new Set(
    inputs.map((p) => {
      try {
        return canonical(p);
      } catch {
        return resolve(p);
      }
    }),
  );
  if (inputSet.has(target)) {
    throw new DbpError("OUT_IS_INPUT", "--out must not point at an input file (Prisma schema or snapshot)");
  }
  if (existsSync(out) || lstatExists(out)) {
    const st = lstatSync(out);
    if (st.isSymbolicLink()) throw new DbpError("OUT_IS_SYMLINK", "--out must not be a symbolic link");
    if (!st.isFile()) throw new DbpError("OUT_NOT_FILE", "--out exists and is not a regular file");
    for (const i of inputs) {
      try {
        const s = statSync(i);
        if (s.ino === st.ino && s.dev === st.dev && st.ino !== 0) {
          throw new DbpError("OUT_IS_INPUT", "--out is a hard link to an input file");
        }
      } catch (e) {
        if (e instanceof DbpError) throw e;
      }
    }
    if (!force) throw new DbpError("OUT_EXISTS", "--out file already exists; pass --force to overwrite it");
  }
}

function lstatExists(p: string): boolean {
  try {
    lstatSync(p);
    return true;
  } catch {
    return false;
  }
}

/**
 * Write via an exclusive temporary file in the destination directory, re-check the destination,
 * then publish with a no-clobber hard link (default) or an atomic rename (--force). Neither
 * operation writes through an existing file, symlink or hard link at the destination, so an input
 * swapped in during a long live collection cannot be truncated (inspection IR-002).
 * Residual risk: replacing the parent directory itself between the re-check and the rename.
 */
export function writeOut(out: string, content: string, force: boolean, inputs: string[] = []): void {
  const abs = resolve(out);
  const tmp = join(dirname(abs), `.${basename(abs)}.${randomBytes(6).toString("hex")}.tmp`);
  let fd: number;
  try {
    fd = openSync(tmp, "wx", 0o600);
  } catch (e) {
    throw new DbpError("OUT_WRITE_FAILED", `could not write next to the --out file (${(e as { code?: string }).code ?? "error"})`);
  }
  try {
    try {
      writeSync(fd, content);
    } finally {
      closeSync(fd);
    }
    checkOutPath(out, inputs, force);
    if (force) {
      renameSync(tmp, abs);
      return;
    }
    try {
      linkSync(tmp, abs);
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (code === "EEXIST") throw new DbpError("OUT_EXISTS", "--out file already exists; pass --force to overwrite it");
      // Filesystems without hard links: fall back to an exclusive create.
      const out2 = openSync(abs, "wx", 0o600);
      try {
        writeSync(out2, content);
      } finally {
        closeSync(out2);
      }
    }
  } finally {
    rmSync(tmp, { force: true });
  }
}
