import type { Check, EvidenceItem, Finding, Report } from "../core/report-types.ts";
import { safeText as t } from "../safety/sanitize.ts";

export interface TextOptions {
  color: boolean;
  maxListed?: number;
}

const RESULT_LABEL: Record<Report["result"]["status"], string> = {
  mismatch_found: "MISMATCH FOUND",
  inconclusive: "INCONCLUSIVE",
  no_mismatch_in_checked_scope: "NO MISMATCH IN CHECKED SCOPE",
};

export function evidenceLine(e: EvidenceItem): string {
  if (e.kind === "prisma") return `prisma  ${t(e.file)}:${e.line}:${e.column}  ${t(e.detail)}`;
  if (e.kind === "database") return `db      ${t(e.object)}  ${t(e.detail)}`;
  return `note    ${t(e.detail)}`;
}

export function renderText(r: Report, opts: TextOptions): string {
  const max = opts.maxListed ?? 25;
  const c = (code: string, s: string) => (opts.color ? `\u001b[${code}m${s}\u001b[0m` : s);
  const red = (s: string) => c("31;1", s);
  const yellow = (s: string) => c("33", s);
  const green = (s: string) => c("32", s);
  const bold = (s: string) => c("1", s);
  const L: string[] = [];

  L.push(bold(`DB Preflight ${t(r.toolVersion)} - ${r.mode === "demo" ? "demo (built-in synthetic data, no database)" : `scan (${r.mode})`}`));
  L.push(
    `Prisma:   ${r.prisma.files.length} file(s) from a ${r.prisma.inputKind}; evaluated with Prisma ORM ${r.prisma.ormMajorAssumed} semantics; relationMode ${t(r.prisma.datasource.relationMode ?? "unknown")} (${r.prisma.datasource.relationModeSource})`,
  );
  L.push(
    `Database: ${r.database.source}${r.database.snapshotOrigin ? (r.database.snapshotOrigin === "live" ? " (snapshot of a live database)" : " (synthetic snapshot)") : ""}, collected ${t(r.database.collectedAt)}, PostgreSQL ${t(r.database.serverVersion ?? "unknown")}, schemas [${r.scope.dbSchemas.map(t).join(", ")}], collection ${r.database.collectionComplete ? "complete" : "INCOMPLETE"}`,
  );
  if (r.scope.defaultSchema) L.push(`          --default-schema ${t(r.scope.defaultSchema)}`);
  L.push(`          ${t(r.database.note)}`);
  L.push("");
  const label = RESULT_LABEL[r.result.status];
  const colored = r.result.status === "mismatch_found" ? red(label) : r.result.status === "inconclusive" ? yellow(label) : green(label);
  L.push(`RESULT: ${colored} (exit code ${r.result.exitCode})`);
  L.push(`  ${t(r.result.summary)}`);
  L.push("");

  const byId = new Map(r.findings.map((f) => [f.id, f]));
  r.findingGroups.forEach((g, gi) => {
    L.push(bold(`[${gi + 1}] ${t(g.title)}`));
    for (const id of g.findingIds) {
      const f = byId.get(id) as Finding;
      L.push(`  ${f.severity === "error" ? red("[FAIL]") : yellow("[WARN]")} ${f.ruleId} ${t(f.title)}`);
      L.push(`     id: ${f.id}${f.relatedFindingIds.length ? `  related: ${f.relatedFindingIds.join(", ")}` : ""}`);
      L.push("     Observed:");
      for (const o of f.explanation.observed) L.push(`       - ${t(o)}`);
      L.push(`     Expected:   ${t(f.explanation.expected)}`);
      L.push(`     Difference: ${t(f.explanation.difference)}`);
      L.push(`     Impact:     ${t(f.explanation.impact)}`);
      L.push("     Evidence:");
      for (const e of f.evidence) L.push(`       - ${evidenceLine(e)}`);
      L.push("     Options for a human to review (not automatic fixes):");
      for (const o of f.reviewOptions) L.push(`       - ${t(o)}`);
      L.push("     Not checked:");
      for (const o of f.explanation.notChecked) L.push(`       - ${t(o)}`);
    }
    L.push("");
  });

  const unknown = r.checks.filter((x: Check) => x.status === "unknown");
  if (unknown.length > 0) {
    L.push(bold(`Unknown checks (${unknown.length}) - not evaluated, NOT treated as passing:`));
    for (const u of unknown.slice(0, max)) L.push(`  ${yellow("[?]")} ${u.ruleId} ${t(u.subject)}: ${t(u.reason ?? u.reasonCode ?? "")}`);
    if (unknown.length > max) L.push(`  ... and ${unknown.length - max} more (use --format json for the full list)`);
    L.push("");
  }

  const diags = r.prisma.diagnostics;
  if (diags.length > 0) {
    L.push(bold(`Prisma schema diagnostics (${diags.length}):`));
    for (const d of diags.slice(0, max)) {
      const where = d.span ? `${t(d.span.file)}:${d.span.line}:${d.span.column} ` : "";
      L.push(`  ${d.severity === "blocking" ? yellow("[blocking]") : "[" + d.severity + "]"} ${where}${d.code}: ${t(d.message)}`);
    }
    if (diags.length > max) L.push(`  ... and ${diags.length - max} more`);
    L.push("");
  }
  if (r.prisma.skipped.length > 0) {
    L.push(`Skipped inputs: ${r.prisma.skipped.map((s) => `${t(s.path)} (${t(s.reason)})`).join("; ")}`);
    L.push("");
  }
  if (r.database.gaps.length > 0) {
    L.push(`Collection gaps: ${r.database.gaps.map((g) => `${t(g.scope)}: ${t(g.reason)}`).join("; ")}`);
    L.push("");
  }

  const tot = r.coverage.totals;
  L.push(
    `Coverage: ${tot.checks} checks - pass ${tot.pass}, fail ${tot.fail}, unknown ${tot.unknown}, not applicable ${tot.not_applicable}. Complete within scope: ${r.coverage.completeWithinScope ? "yes" : "no"}.`,
  );
  L.push("Not covered by this tool:");
  for (const n of r.coverage.notCovered) L.push(`  - ${t(n)}`);
  L.push("");
  L.push(
    `Safety: database access ${r.safety.databaseAccess}; read-only transaction verified: ${fmtBool(r.safety.readOnlyTransactionVerified)}; Prisma input files unchanged (re-hashed): ${fmtBool(r.safety.prismaInputsUnchangedVerified)}; LLM/network calls: none.`,
  );
  L.push(`Note: ${t(r.result.disclaimer)}`);
  return `${L.join("\n")}\n`;
}

function fmtBool(v: boolean | null): string {
  return v === null ? "n/a" : v ? "yes" : "no";
}
