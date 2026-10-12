// Report contract (reportVersion 1). Mirrored by schemas/report.schema.json.

import type { CollectionGap, Diagnostic, PrismaFileInfo, SkippedInput } from "./types.ts";

export type RuleId = "DBP001" | "DBP002" | "DBP003" | "DBP004" | "DBP005" | "DBP006";
export type CheckStatus = "pass" | "fail" | "unknown" | "not_applicable";
export type Severity = "error" | "warning";

export type EvidenceItem =
  | { kind: "prisma"; file: string; line: number; column: number; detail: string }
  | { kind: "database"; object: string; detail: string; constraint?: string; columns?: string[] }
  | { kind: "note"; detail: string };

export interface Check {
  id: string;
  ruleId: RuleId;
  subject: string;
  status: CheckStatus;
  /** Machine-readable reason for unknown / not_applicable / fail. */
  reasonCode?: string;
  reason?: string;
  evidence: EvidenceItem[];
  findingId?: string;
}

export interface Finding {
  id: string;
  ruleId: RuleId;
  severity: Severity;
  title: string;
  subject: string;
  groupId: string;
  relatedFindingIds: string[];
  explanation: {
    observed: string[];
    expected: string;
    difference: string;
    impact: string;
    notChecked: string[];
  };
  evidence: EvidenceItem[];
  /** Conditional options for a human to review. Never an automatic fix. */
  reviewOptions: string[];
}

export interface FindingGroup {
  groupId: string;
  title: string;
  findingIds: string[];
}

export type ResultStatus = "no_mismatch_in_checked_scope" | "mismatch_found" | "inconclusive";

export interface Report {
  reportVersion: 1;
  toolVersion: string;
  generatedAt: string;
  mode: "live" | "snapshot" | "demo";
  scope: {
    dbSchemas: string[];
    defaultSchema: string | null;
    rules: RuleId[];
  };
  prisma: {
    ormMajorAssumed: 7;
    inputKind: "file" | "directory";
    files: PrismaFileInfo[];
    skipped: SkippedInput[];
    datasource: {
      found: boolean;
      provider: string | null;
      relationMode: string | null;
      relationModeSource: "explicit" | "default" | "unknown";
      schemas: string[] | null;
    };
    counts: { models: number; views: number; enums: number; relations: number };
    diagnostics: Diagnostic[];
  };
  database: {
    source: "live" | "snapshot" | "demo";
    snapshotOrigin: "live" | "synthetic" | null;
    collectedAt: string;
    serverVersion: string | null;
    requestedSchemas: string[];
    schemasFound: string[];
    collectionComplete: boolean;
    gaps: CollectionGap[];
    note: string;
  };
  result: {
    status: ResultStatus;
    exitCode: 0 | 1 | 3;
    summary: string;
    disclaimer: string;
  };
  checks: Check[];
  findings: Finding[];
  findingGroups: FindingGroup[];
  coverage: {
    totals: { checks: number; pass: number; fail: number; unknown: number; not_applicable: number };
    unknownReasons: { reasonCode: string; count: number; example: string }[];
    blockingDiagnostics: number;
    completeWithinScope: boolean;
    notCovered: string[];
  };
  safety: {
    databaseAccess: "none" | "live_catalog_metadata";
    /** null when no live connection was made. */
    readOnlyTransactionVerified: boolean | null;
    roleVerifiedNotSuperuser: boolean | null;
    catalogQueryIdsExecuted: string[] | null;
    /** Re-hashed after analysis; true only when verified. null when no files were read (demo). */
    prismaInputsUnchangedVerified: boolean | null;
    llmOrNetworkCalls: "none";
  };
}
