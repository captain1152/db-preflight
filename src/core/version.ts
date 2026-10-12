declare const __DBP_VERSION__: string | undefined;

/** Replaced at bundle time; falls back for tests run from source. */
export const TOOL_VERSION: string = typeof __DBP_VERSION__ === "string" ? __DBP_VERSION__ : "0.1.0";
export const REPORT_VERSION = 1;
export const SNAPSHOT_VERSION = 1;
/** The only Prisma ORM major whose schema semantics v0.1 implements. */
export const PRISMA_ORM_MAJOR = 7;
