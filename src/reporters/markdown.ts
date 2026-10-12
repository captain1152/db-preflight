import type { EvidenceItem, Finding, Report } from "../core/report-types.ts";
import { mdCode as code, mdText as md } from "../safety/sanitize.ts";

function evidence(e: EvidenceItem): string {
  if (e.kind === "prisma") return `Prisma ${code(`${e.file}:${e.line}:${e.column}`)} — ${md(e.detail)}`;
  if (e.kind === "database") return `Database ${code(e.object)} — ${md(e.detail)}`;
  return `Note — ${md(e.detail)}`;
}

export function renderMarkdown(r: Report): string {
  const L: string[] = [];
  L.push(`# DB Preflight report`);
  L.push("");
  L.push(`| | |`);
  L.push(`|---|---|`);
  L.push(`| Result | **${r.result.status}** (exit code ${r.result.exitCode}) |`);
  L.push(`| Mode | ${r.mode} |`);
  L.push(`| Tool version | ${md(r.toolVersion)} |`);
  L.push(
    `| Prisma input | ${r.prisma.files.length} file(s), Prisma ORM ${r.prisma.ormMajorAssumed} semantics, relationMode ${md(r.prisma.datasource.relationMode ?? "unknown")} (${r.prisma.datasource.relationModeSource}) |`,
  );
  L.push(
    `| Database metadata | ${r.database.source}${r.database.snapshotOrigin ? (r.database.snapshotOrigin === "live" ? " (snapshot of a live database)" : " (synthetic snapshot)") : ""}, collected ${md(r.database.collectedAt)}, PostgreSQL ${md(r.database.serverVersion ?? "unknown")} |`,
  );
  L.push(`| Schemas in scope | ${r.scope.dbSchemas.map(code).join(", ")}${r.scope.defaultSchema ? ` (default schema ${code(r.scope.defaultSchema)})` : ""} |`);
  L.push(`| Collection complete | ${r.database.collectionComplete ? "yes" : "**no**"} |`);
  L.push("");
  L.push(md(r.result.summary));
  L.push("");
  L.push(`> ${md(r.result.disclaimer)}`);
  L.push("");

  const byId = new Map(r.findings.map((f) => [f.id, f]));
  if (r.findingGroups.length > 0) {
    L.push(`## Findings`);
    for (const g of r.findingGroups) {
      L.push("");
      L.push(`### ${md(g.title)}`);
      for (const id of g.findingIds) {
        const f = byId.get(id) as Finding;
        L.push("");
        L.push(`#### ${f.ruleId} (${f.severity}) — ${md(f.title)}`);
        L.push("");
        L.push(`Finding id ${code(f.id)}${f.relatedFindingIds.length ? `; related ${f.relatedFindingIds.map(code).join(", ")}` : ""}`);
        L.push("");
        L.push(`**Observed**`);
        L.push("");
        for (const o of f.explanation.observed) L.push(`- ${md(o)}`);
        L.push("");
        L.push(`**Expected:** ${md(f.explanation.expected)}`);
        L.push("");
        L.push(`**Difference:** ${md(f.explanation.difference)}`);
        L.push("");
        L.push(`**Impact:** ${md(f.explanation.impact)}`);
        L.push("");
        L.push(`**Evidence**`);
        L.push("");
        for (const e of f.evidence) L.push(`- ${evidence(e)}`);
        L.push("");
        L.push(`**Options for a human to review** (not automatic fixes)`);
        L.push("");
        for (const o of f.reviewOptions) L.push(`- ${md(o)}`);
        L.push("");
        L.push(`**Not checked**`);
        L.push("");
        for (const o of f.explanation.notChecked) L.push(`- ${md(o)}`);
      }
    }
    L.push("");
  }

  const unknown = r.checks.filter((c) => c.status === "unknown");
  if (unknown.length > 0) {
    L.push(`## Unknown checks (${unknown.length})`);
    L.push("");
    L.push("These were not evaluated and are **not** treated as passing.");
    L.push("");
    L.push("| Rule | Subject | Reason |");
    L.push("|---|---|---|");
    for (const u of unknown) L.push(`| ${u.ruleId} | ${code(u.subject)} | ${md(u.reason ?? u.reasonCode ?? "")} |`);
    L.push("");
  }
  if (r.prisma.diagnostics.length > 0) {
    L.push(`## Prisma schema diagnostics`);
    L.push("");
    for (const d of r.prisma.diagnostics) {
      L.push(`- **${d.severity}** ${d.span ? `${code(`${d.span.file}:${d.span.line}:${d.span.column}`)} ` : ""}${md(d.code)}: ${md(d.message)}`);
    }
    L.push("");
  }
  const tot = r.coverage.totals;
  L.push(`## Coverage`);
  L.push("");
  L.push(`| Checks | Pass | Fail | Unknown | Not applicable | Complete within scope |`);
  L.push(`|---|---|---|---|---|---|`);
  L.push(`| ${tot.checks} | ${tot.pass} | ${tot.fail} | ${tot.unknown} | ${tot.not_applicable} | ${r.coverage.completeWithinScope ? "yes" : "no"} |`);
  L.push("");
  L.push(`Not covered by this tool:`);
  L.push("");
  for (const n of r.coverage.notCovered) L.push(`- ${md(n)}`);
  L.push("");
  L.push(`## Safety`);
  L.push("");
  L.push(`- Database access: ${r.safety.databaseAccess}`);
  L.push(`- Read-only transaction verified: ${r.safety.readOnlyTransactionVerified === null ? "n/a" : r.safety.readOnlyTransactionVerified ? "yes" : "no"}`);
  L.push(
    `- Prisma input files unchanged (re-hashed after analysis): ${r.safety.prismaInputsUnchangedVerified === null ? "n/a" : r.safety.prismaInputsUnchangedVerified ? "yes" : "no"}`,
  );
  L.push(`- LLM or network calls by the tool: none`);
  return `${L.join("\n")}\n`;
}
