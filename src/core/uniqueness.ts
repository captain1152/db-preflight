// Database-side uniqueness semantics. A set of columns F is guaranteed unique (for rows
// where all of F is non-null) iff some supported key K satisfies K ⊆ F.

import type { DbTable, DbUniqueKey } from "./types.ts";

export interface UniquenessResult {
  status: "guaranteed" | "not_guaranteed" | "unknown";
  key?: DbUniqueKey;
  reasonCode?: string;
  reason?: string;
  /** Keys whose semantics v0.1 does not evaluate but that might cover F. */
  uncertainKeys: DbUniqueKey[];
}

/** Why a key cannot be used as a plain uniqueness guarantee, or undefined if it can. */
export function unsupportedKeyReason(k: DbUniqueKey): string | undefined {
  if (k.kind === "exclusion_constraint") return "exclusion constraint semantics are not evaluated";
  if (k.columns === null || k.expression) return "expression index";
  if (k.partial) return "partial index (WHERE clause)";
  if (!k.valid) return "index is not valid";
  if (k.deferrable || !k.immediate) return "deferrable uniqueness";
  if (k.period) return "WITHOUT OVERLAPS / PERIOD key";
  return undefined;
}

export function isSubset(subset: readonly string[], superset: readonly string[]): boolean {
  const s = new Set(superset);
  return subset.every((c) => s.has(c));
}

export function evaluateUniqueness(table: DbTable, columns: string[], schemaComplete: boolean): UniquenessResult {
  if (table.inheritance.hasInheritanceChildren) {
    return {
      status: "unknown",
      reasonCode: "ordinary_inheritance",
      reason: "table has ordinary (INHERITS) child tables whose rows are not covered by its unique indexes",
      uncertainKeys: [],
    };
  }
  const supported = table.uniqueKeys
    .filter((k) => unsupportedKeyReason(k) === undefined && k.columns !== null && k.columns.length > 0)
    .filter((k) => isSubset(k.columns as string[], columns))
    .sort((a, b) => (a.columns?.length ?? 0) - (b.columns?.length ?? 0) || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  if (supported.length > 0) {
    return { status: "guaranteed", key: supported[0] as DbUniqueKey, uncertainKeys: [] };
  }
  const uncertain = table.uniqueKeys.filter((k) => unsupportedKeyReason(k) !== undefined && (k.columns === null || isSubset(k.columns, columns)));
  if (uncertain.length > 0) {
    return {
      status: "unknown",
      reasonCode: "unsupported_unique_semantics",
      reason: `possible uniqueness via ${uncertain.map((k) => `${k.name} (${unsupportedKeyReason(k)})`).join(", ")} is not evaluated`,
      uncertainKeys: uncertain,
    };
  }
  if (!schemaComplete) {
    return {
      status: "unknown",
      reasonCode: "incomplete_collection",
      reason: "metadata collection for this schema was incomplete",
      uncertainKeys: [],
    };
  }
  return { status: "not_guaranteed", uncertainKeys: [] };
}
