// Executable entry point (bundled to dist/db-preflight.cjs).
import { formatError } from "../safety/redact.ts";
import { safeText } from "../safety/sanitize.ts";
import { main } from "./main.ts";

main(process.argv.slice(2)).then(
  (code) => {
    process.exitCode = code;
  },
  (e: unknown) => {
    process.stderr.write(`db-preflight: error [INTERNAL]: ${safeText(formatError(e))}\n`);
    process.exitCode = 2;
  },
);
