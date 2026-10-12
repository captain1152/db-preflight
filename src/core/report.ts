import { NOT_COVERED, runEngine } from "./engine.ts";
import type { Report } from "./report-types.ts";
import { RULE_IDS } from "./rules.ts";
import type { DatabaseModel, PrismaSchemaModel } from "./types.ts";
import { TOOL_VERSION } from "./version.ts";

export interface BuildReportInput {
  mode: Report["mode"];
  inputKind: "file" | "directory";
  prisma: PrismaSchemaModel;
  db: DatabaseModel;
  defaultSchema: string | null;
  generatedAt: string;
  safety: Omit<Report["safety"], "llmOrNetworkCalls" | "prismaInputsUnchangedVerified">;
}

export const DISCLAIMER =
  "Results cover only the supported checks listed in this report, evaluated against the collected metadata. They are not a guarantee that the database as a whole is correct, that data is consistent, or that any migration is safe.";

export function buildReport(input: BuildReportInput): Report {
  const { prisma, db } = input;
  const out = runEngine({ prisma, db, defaultSchema: input.defaultSchema });
  const totals = { checks: out.checks.length, pass: 0, fail: 0, unknown: 0, not_applicable: 0 };
  const unknownReasons = new Map<string, { count: number; example: string }>();
  for (const c of out.checks) {
    totals[c.status]++;
    if (c.status === "unknown") {
      const key = c.reasonCode ?? "unspecified";
      const prev = unknownReasons.get(key);
      unknownReasons.set(key, { count: (prev?.count ?? 0) + 1, example: prev?.example ?? `${c.subject}: ${c.reason ?? ""}` });
    }
  }
  const groups = out.findingGroups.length;
  let summary: string;
  if (out.resultStatus === "mismatch_found") {
    summary = `${totals.fail} check(s) found confirmed mismatches, grouped into ${groups} root-cause group(s).`;
    if (totals.unknown > 0 || !out.completeWithinScope) summary += ` Coverage is incomplete: ${totals.unknown} check(s) are unknown.`;
  } else if (out.resultStatus === "inconclusive") {
    summary = `No confirmed mismatches, but ${totals.unknown} required check(s) are unknown${out.blockingDiagnostics ? ` and ${out.blockingDiagnostics} Prisma construct(s) could not be evaluated` : ""}${db.complete ? "" : " and database metadata collection was incomplete"}; no conclusion can be drawn.`;
  } else {
    summary = `No mismatches found in the ${totals.pass} supported check(s) that passed (${totals.not_applicable} not applicable).`;
  }

  const ds = prisma.datasource;
  return {
    reportVersion: 1,
    toolVersion: TOOL_VERSION,
    generatedAt: input.generatedAt,
    mode: input.mode,
    scope: { dbSchemas: [...db.requestedSchemas], defaultSchema: input.defaultSchema, rules: RULE_IDS },
    prisma: {
      ormMajorAssumed: 7,
      inputKind: input.inputKind,
      files: prisma.files,
      skipped: prisma.skipped,
      datasource: {
        found: !!ds,
        provider: ds?.provider ?? null,
        relationMode: ds?.relationMode ?? null,
        relationModeSource: ds?.relationModeSource ?? "unknown",
        schemas: ds?.schemas ?? null,
      },
      counts: {
        models: prisma.models.filter((m) => m.blockKind === "model").length,
        views: prisma.models.filter((m) => m.blockKind === "view").length,
        enums: prisma.enums.length,
        relations: prisma.relations.length,
      },
      diagnostics: prisma.diagnostics,
    },
    database: {
      source: db.origin,
      snapshotOrigin: db.snapshotOrigin ?? null,
      collectedAt: db.collectedAt,
      serverVersion: db.server.version,
      requestedSchemas: db.requestedSchemas,
      schemasFound: db.schemasFound,
      collectionComplete: db.complete,
      gaps: db.gaps,
      note:
        db.origin === "live"
          ? "Metadata was read from the live catalog at collectedAt."
          : db.origin === "demo"
            ? "Built-in synthetic demo metadata; no database was contacted."
            : "Metadata comes from a snapshot taken at collectedAt; it may not reflect the database's current state.",
    },
    result: { status: out.resultStatus, exitCode: out.exitCode, summary, disclaimer: DISCLAIMER },
    checks: out.checks,
    findings: out.findings,
    findingGroups: out.findingGroups,
    coverage: {
      totals,
      unknownReasons: [...unknownReasons.entries()]
        .map(([reasonCode, v]) => ({ reasonCode, count: v.count, example: v.example }))
        .sort((a, b) => (a.reasonCode < b.reasonCode ? -1 : a.reasonCode > b.reasonCode ? 1 : 0)),
      blockingDiagnostics: out.blockingDiagnostics,
      completeWithinScope: out.completeWithinScope,
      notCovered: NOT_COVERED,
    },
    safety: { ...input.safety, prismaInputsUnchangedVerified: false, llmOrNetworkCalls: "none" },
  };
}
