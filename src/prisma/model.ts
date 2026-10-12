// AST -> normalized PrismaSchemaModel: attribute interpretation, @map/@@map/@@schema,
// uniqueness declarations and relation resolution. No validation step can abort the
// analysis; problems become diagnostics or per-model/per-field issues.

import type {
  DatasourceInfo,
  Diagnostic,
  FieldKind,
  PrismaEnumDef,
  PrismaField,
  PrismaFileInfo,
  PrismaModelDef,
  PrismaSchemaModel,
  RelationAttribute,
  RelationEnd,
  ResolvedRelation,
  SkippedInput,
  SourceSpan,
  UniqueDecl,
} from "../core/types.ts";
import { compareStrings } from "./discover.ts";
import type { Arg, AttributeNode, BlockNode, Expr, FieldNode, FileAst } from "./parser.ts";

export const PRISMA_SCALARS = new Set(["String", "Boolean", "Int", "BigInt", "Float", "Decimal", "DateTime", "Json", "Bytes"]);

/** Field attributes that do not change any v0.1 decision. */
const NEUTRAL_FIELD_ATTRIBUTES = new Set(["default", "updatedAt", "ignore"]);
/** Block attributes that do not change any v0.1 decision. */
const NEUTRAL_BLOCK_ATTRIBUTES = new Set(["index"]);

const ID_UNIQUE_FIELD_ARGS = new Set(["map", "length", "sort", "clustered"]);
const ID_UNIQUE_BLOCK_ARGS = new Set(["fields", "name", "map", "length", "sort", "clustered"]);
const RELATION_ARGS = new Set(["name", "fields", "references", "map", "onDelete", "onUpdate"]);

export function buildPrismaModel(asts: FileAst[], files: PrismaFileInfo[], skipped: SkippedInput[]): PrismaSchemaModel {
  const diagnostics: Diagnostic[] = [];
  const blocks: BlockNode[] = [];
  for (const ast of asts) {
    diagnostics.push(...ast.diagnostics);
    blocks.push(...ast.blocks);
  }

  // Inputs that were found but not read (depth limit, symlinks) may contain models: the result
  // cannot be complete (inspection IR-010). Intentionally excluded directories are not gaps.
  for (const s of skipped) {
    if (s.reason === "excluded directory") continue;
    diagnostics.push({
      code: "SCHEMA_INPUT_NOT_READ",
      severity: "blocking",
      message: `input "${s.path}" was not read (${s.reason}); models it may contain were not analyzed`,
    });
  }

  // ---- name tables -------------------------------------------------------
  const typeNames = new Map<string, BlockNode>();
  const duplicateNames = new Set<string>();
  for (const b of blocks) {
    if (!["model", "view", "enum", "type"].includes(b.keyword)) continue;
    if (typeNames.has(b.name)) {
      duplicateNames.add(b.name);
      diagnostics.push({
        code: "PRISMA_DUPLICATE_NAME",
        severity: "blocking",
        message: `"${b.name}" is declared more than once`,
        span: b.span,
        model: b.name,
      });
    } else {
      typeNames.set(b.name, b);
    }
  }
  const modelNames = new Set(blocks.filter((b) => b.keyword === "model").map((b) => b.name));
  const viewNames = new Set(blocks.filter((b) => b.keyword === "view").map((b) => b.name));
  const enumNames = new Set(blocks.filter((b) => b.keyword === "enum").map((b) => b.name));
  const compositeNames = new Set(blocks.filter((b) => b.keyword === "type").map((b) => b.name));

  // ---- datasource ---------------------------------------------------------
  const datasources = blocks.filter((b) => b.keyword === "datasource");
  let datasource: DatasourceInfo | undefined;
  if (datasources.length > 1) {
    diagnostics.push({
      code: "PRISMA_MULTIPLE_DATASOURCES",
      severity: "blocking",
      message: "more than one datasource block found; relationMode and schemas cannot be determined",
      span: (datasources[1] as BlockNode).span,
    });
  } else if (datasources.length === 1) {
    datasource = readDatasource(datasources[0] as BlockNode, diagnostics);
  } else {
    diagnostics.push({
      code: "PRISMA_NO_DATASOURCE",
      severity: "warning",
      message: "no datasource block found in the scanned files; relationMode is unknown",
    });
  }

  for (const b of blocks) {
    if (b.keyword === "type") {
      diagnostics.push({
        code: "PRISMA_UNSUPPORTED_COMPOSITE_TYPE",
        severity: "blocking",
        message: `composite type "${b.name}" is not supported (MongoDB-only feature)`,
        span: b.span,
      });
    }
    if (b.keyword === "datasource" || b.keyword === "generator" || b.keyword === "type" || !b.known) {
      diagnostics.push(...b.diagnostics);
    }
  }

  // ---- models / views -----------------------------------------------------
  const models: PrismaModelDef[] = [];
  for (const b of blocks) {
    if (b.keyword !== "model" && b.keyword !== "view") continue;
    const model = readModel(b, { modelNames, viewNames, enumNames, compositeNames }, diagnostics);
    if (duplicateNames.has(b.name)) {
      model.issues.push({ code: "PRISMA_DUPLICATE_NAME", severity: "blocking", message: `"${b.name}" is declared more than once`, model: b.name });
    }
    if (datasource?.schemas && !model.schema) {
      diagnostics.push({
        code: "PRISMA_MISSING_SCHEMA_ATTRIBUTE",
        severity: "warning",
        message: `datasource declares schemas but ${b.keyword} "${b.name}" has no @@schema`,
        span: model.span,
        model: model.name,
      });
    }
    if (datasource?.schemas && model.schema && !datasource.schemas.includes(model.schema)) {
      diagnostics.push({
        code: "PRISMA_SCHEMA_NOT_DECLARED",
        severity: "warning",
        message: `@@schema("${model.schema}") on "${b.name}" is not listed in datasource schemas`,
        span: model.span,
        model: model.name,
      });
    }
    models.push(model);
  }
  models.sort((a, b) => compareStrings(a.name, b.name));

  const enums: PrismaEnumDef[] = blocks
    .filter((b) => b.keyword === "enum")
    .map((b) => {
      const schemaAttr = b.blockAttributes.find((a) => a.name === "schema");
      const schema = schemaAttr ? firstString(schemaAttr.args) : undefined;
      for (const d of b.diagnostics) diagnostics.push(d);
      return schema ? { name: b.name, schema, span: b.span } : { name: b.name, span: b.span };
    })
    .sort((a, b) => compareStrings(a.name, b.name));

  // Every model/field issue must be visible in the report and must prevent a complete result
  // (inspection IR-001); parser diagnostics were already added above.
  const reported = new Set(diagnostics);
  for (const m of models) {
    for (const d of [...m.issues, ...m.fields.flatMap((f) => f.issues)]) {
      if (!reported.has(d)) {
        diagnostics.push(d);
        reported.add(d);
      }
    }
  }
  const relations = resolveRelations(models);
  return { files, skipped, ...(datasource ? { datasource } : {}), models, enums, relations, diagnostics };
}

function readDatasource(b: BlockNode, diagnostics: Diagnostic[]): DatasourceInfo {
  const info: DatasourceInfo = { relationModeSource: "default", relationMode: "foreignKeys", span: b.span };
  // Repeated relationMode declarations are ambiguous whatever their values or order (REV-001).
  const relationModeProps = b.properties.filter((p) => p.key === "relationMode");
  const duplicateRelationMode = relationModeProps[1];
  if (duplicateRelationMode) {
    delete info.relationMode;
    info.relationModeSource = "unknown";
    diagnostics.push({
      code: "PRISMA_RELATION_MODE_DUPLICATE",
      severity: "blocking",
      message: "relationMode is declared more than once in the datasource block; foreign-key checks are unknown",
      span: duplicateRelationMode.span,
    });
  }
  for (const p of b.properties) {
    if (p.key === "relationMode" && duplicateRelationMode) continue;
    if (p.key === "provider") {
      if (p.value.kind === "string") info.provider = p.value.value;
      else
        diagnostics.push({ code: "PRISMA_PROVIDER_NOT_LITERAL", severity: "blocking", message: "datasource provider is not a string literal", span: p.span });
    } else if (p.key === "relationMode") {
      if (p.value.kind === "string" && (p.value.value === "prisma" || p.value.value === "foreignKeys")) {
        info.relationMode = p.value.value;
        info.relationModeSource = "explicit";
      } else {
        delete info.relationMode;
        info.relationModeSource = "unknown";
        diagnostics.push({
          code: "PRISMA_RELATION_MODE_UNKNOWN",
          severity: "warning",
          message: 'relationMode is not "foreignKeys" or "prisma"; foreign-key checks are unknown',
          span: p.span,
        });
      }
    } else if (p.key === "schemas") {
      if (p.value.kind === "array" && p.value.items.every((i) => i.kind === "string")) {
        info.schemas = p.value.items.map((i) => (i as { value: string }).value);
      } else {
        diagnostics.push({
          code: "PRISMA_SCHEMAS_NOT_LITERAL",
          severity: "blocking",
          message: "datasource schemas is not a list of string literals",
          span: p.span,
        });
      }
    }
    // url/directUrl/shadowDatabaseUrl/extensions are intentionally neither evaluated nor reported.
  }
  // A statement that failed to parse may have been a (second) relationMode, and the parser keeps a
  // property whose trailing syntax failed, so any blocking problem inside the datasource block
  // makes the relation mode unknown, even an explicit-looking one (RV-004 / RV-009). The block's
  // own diagnostics count wherever they point (an unclosed block reports at EOF, past its span);
  // span containment is only used for file-level diagnostics (INS-001).
  const blockingInside =
    b.diagnostics.some((d) => d.severity === "blocking") ||
    diagnostics.some((d) => d.severity === "blocking" && d.span !== undefined && spanWithin(d.span, b.span));
  if (blockingInside && info.relationModeSource !== "unknown") {
    delete info.relationMode;
    info.relationModeSource = "unknown";
    diagnostics.push({
      code: "PRISMA_RELATION_MODE_UNKNOWN",
      severity: "warning",
      message: "the datasource block contains a statement that could not be read; relationMode and foreign-key checks are unknown",
      span: b.span,
    });
  }
  return info;
}

function spanWithin(inner: SourceSpan, outer: SourceSpan): boolean {
  if (inner.file !== outer.file) return false;
  const before = (l1: number, c1: number, l2: number, c2: number) => l1 < l2 || (l1 === l2 && c1 <= c2);
  return before(outer.line, outer.column, inner.line, inner.column) && before(inner.endLine, inner.endColumn, outer.endLine, outer.endColumn);
}

interface NameTables {
  modelNames: Set<string>;
  viewNames: Set<string>;
  enumNames: Set<string>;
  compositeNames: Set<string>;
}

function readModel(b: BlockNode, names: NameTables, diagnostics: Diagnostic[]): PrismaModelDef {
  const model: PrismaModelDef = {
    name: b.name,
    blockKind: b.keyword === "view" ? "view" : "model",
    dbName: b.name,
    fields: [],
    uniques: [],
    ignored: false,
    issues: [],
    span: b.span,
  };
  for (const d of b.diagnostics) {
    diagnostics.push(d);
    // A statement that could not be parsed might have been anything (even a uniqueness
    // declaration), so the whole model becomes unknown rather than "analyzed without it".
    if (d.severity === "blocking") model.issues.push(d);
  }

  for (const f of b.fields) model.fields.push(readField(b.name, f, names, model));
  const fieldNames = new Set(model.fields.map((f) => f.name));
  for (const f of model.fields) {
    if (f.isId || f.isUnique) {
      const attr = f.isId ? "id" : "unique";
      const node = b.fields.find((n) => n.name === f.name)?.attributes.find((a) => a.name === attr);
      const bad = node?.args?.find((a) => a.name !== undefined && !ID_UNIQUE_FIELD_ARGS.has(a.name));
      model.uniques.push({
        kind: f.isId ? "id" : "unique",
        fields: [f.name],
        origin: "field",
        supported: !bad,
        ...(bad ? { unsupportedReason: `argument "${bad.name}" on @${attr} is not evaluated by v0.1` } : {}),
        span: node?.span ?? f.span,
      });
    }
  }

  for (const a of b.blockAttributes) {
    switch (a.name) {
      case "map": {
        const v = firstString(a.args) ?? namedString(a.args, "name");
        if (v === undefined) model.issues.push(issue("PRISMA_BAD_MAP", "@@map needs a string argument", a, b.name));
        else model.dbName = v;
        break;
      }
      case "schema": {
        const v = firstString(a.args);
        if (v === undefined) model.issues.push(issue("PRISMA_BAD_SCHEMA", "@@schema needs a string argument", a, b.name));
        else model.schema = v;
        break;
      }
      case "ignore":
        model.ignored = true;
        break;
      case "id":
      case "unique": {
        model.uniques.push(readBlockUnique(a, fieldNames));
        break;
      }
      default:
        if (NEUTRAL_BLOCK_ATTRIBUTES.has(a.name)) break;
        model.issues.push(issue("PRISMA_UNSUPPORTED_ATTRIBUTE", `block attribute @@${a.name} is not supported by v0.1`, a, b.name));
    }
  }
  return model;
}

function readBlockUnique(a: AttributeNode, fieldNames: Set<string>): UniqueDecl {
  const kind = a.name === "id" ? "id" : "unique";
  const listExpr = a.args?.find((x) => x.name === undefined)?.value ?? a.args?.find((x) => x.name === "fields")?.value;
  const decl: UniqueDecl = { kind, fields: [], origin: "block", supported: true, span: a.span };
  if (listExpr?.kind !== "array") {
    decl.supported = false;
    decl.unsupportedReason = `@@${a.name} has no field list`;
    return decl;
  }
  for (const item of listExpr.items) {
    const name = fieldRefName(item);
    if (name === undefined) {
      decl.supported = false;
      decl.unsupportedReason = `@@${a.name} contains an entry that is not a field reference`;
    } else {
      decl.fields.push(name);
      if (!fieldNames.has(name)) {
        decl.supported = false;
        decl.unsupportedReason = `@@${a.name} references unknown field "${name}"`;
      }
    }
  }
  const bad = a.args?.find((x) => x.name !== undefined && !ID_UNIQUE_BLOCK_ARGS.has(x.name));
  if (bad) {
    decl.supported = false;
    decl.unsupportedReason =
      bad.name === "where" ? `partial @@${a.name}(where: ...) is not evaluated by v0.1` : `argument "${bad.name}" on @@${a.name} is not evaluated by v0.1`;
  }
  if (a.args && a.args.filter((x) => x.name === undefined).length > 1) {
    decl.supported = false;
    decl.unsupportedReason = `@@${a.name} has unexpected positional arguments`;
  }
  return decl;
}

function readField(modelName: string, f: FieldNode, names: NameTables, model: PrismaModelDef): PrismaField {
  const field: PrismaField = {
    name: f.name,
    dbName: f.name,
    typeName: f.typeName,
    kind: classifyType(f, names),
    isList: f.isList,
    isOptional: f.isOptional,
    isId: false,
    isUnique: false,
    ignored: false,
    issues: [],
    span: f.span,
  };
  if (field.kind === "unknown_type") {
    const what = names.compositeNames.has(f.typeName) ? "composite type" : names.viewNames.has(f.typeName) ? "view" : "unknown type";
    field.issues.push({
      code: "PRISMA_UNKNOWN_FIELD_TYPE",
      severity: "blocking",
      message: `field "${f.name}" uses ${what} "${f.typeName}", which v0.1 cannot evaluate`,
      span: f.span,
      model: modelName,
      field: f.name,
    });
  }
  for (const a of f.attributes) {
    switch (a.name) {
      case "id":
        field.isId = true;
        break;
      case "unique":
        field.isUnique = true;
        break;
      case "map": {
        const v = firstString(a.args) ?? namedString(a.args, "name");
        if (v === undefined) field.issues.push(issue("PRISMA_BAD_MAP", "@map needs a string argument", a, modelName, f.name));
        else field.dbName = v;
        break;
      }
      case "relation":
        field.relation = readRelation(a, modelName, f.name, field);
        break;
      default:
        if (a.name === "ignore") field.ignored = true;
        if (NEUTRAL_FIELD_ATTRIBUTES.has(a.name) || a.name.startsWith("db.")) break;
        field.issues.push(issue("PRISMA_UNSUPPORTED_ATTRIBUTE", `field attribute @${a.name} is not supported by v0.1`, a, modelName, f.name));
    }
  }
  if (field.relation && field.kind !== "relation") {
    field.issues.push({
      code: "PRISMA_RELATION_ON_NON_RELATION",
      severity: "blocking",
      message: `@relation on "${f.name}", whose type is not a model`,
      span: f.span,
      model: modelName,
      field: f.name,
    });
  }
  void model;
  return field;
}

function classifyType(f: FieldNode, names: NameTables): FieldKind {
  if (f.typeName === "Unsupported" && f.typeArgs) return "unsupported_type";
  if (PRISMA_SCALARS.has(f.typeName)) return "scalar";
  if (names.enumNames.has(f.typeName)) return "enum";
  if (names.modelNames.has(f.typeName)) return "relation";
  return "unknown_type";
}

function readRelation(a: AttributeNode, modelName: string, fieldName: string, field: PrismaField): RelationAttribute {
  const rel: RelationAttribute = { span: a.span };
  const args = a.args ?? [];
  const positional = args.filter((x) => x.name === undefined);
  if (positional.length > 1) field.issues.push(issue("PRISMA_BAD_RELATION", "@relation has more than one positional argument", a, modelName, fieldName));
  const nameExpr = positional[0]?.value ?? args.find((x) => x.name === "name")?.value;
  if (nameExpr) {
    if (nameExpr.kind === "string") rel.name = nameExpr.value;
    else field.issues.push(issue("PRISMA_BAD_RELATION", "@relation name must be a string", a, modelName, fieldName));
  }
  for (const key of ["fields", "references"] as const) {
    const e = args.find((x) => x.name === key)?.value;
    if (!e) continue;
    const list = e.kind === "array" ? e.items.map(fieldRefName) : [undefined];
    if (list.some((n) => n === undefined)) {
      field.issues.push(issue("PRISMA_BAD_RELATION", `@relation ${key} must be a list of field names`, a, modelName, fieldName));
    } else {
      rel[key] = list as string[];
    }
  }
  const bad = args.find((x) => x.name !== undefined && !RELATION_ARGS.has(x.name));
  if (bad) field.issues.push(issue("PRISMA_UNSUPPORTED_ATTRIBUTE", `@relation argument "${bad.name}" is not supported by v0.1`, a, modelName, fieldName));
  return rel;
}

function fieldRefName(e: Expr): string | undefined {
  if (e.kind === "ident" && !e.name.includes(".")) return e.name;
  // e.g. a(sort: Desc) or a(length: 10)
  if (e.kind === "call" && !e.name.includes(".") && e.args.every((x) => x.name === "sort" || x.name === "length" || x.name === "ops")) return e.name;
  return undefined;
}

function firstString(args: Arg[] | null): string | undefined {
  const a = args?.find((x) => x.name === undefined);
  return a && a.value.kind === "string" ? a.value.value : undefined;
}
function namedString(args: Arg[] | null, name: string): string | undefined {
  const a = args?.find((x) => x.name === name);
  return a && a.value.kind === "string" ? a.value.value : undefined;
}

function issue(code: string, message: string, a: AttributeNode, model: string, field?: string): Diagnostic {
  return { code, severity: "blocking", message, span: a.span, model, ...(field ? { field } : {}) };
}

// ---------------------------------------------------------------------------
// Relation resolution
// ---------------------------------------------------------------------------

export function resolveRelations(models: PrismaModelDef[]): ResolvedRelation[] {
  const groups = new Map<string, RelationEnd[]>();
  const fieldOf = new Map<string, PrismaField>();
  const targetOf = new Map<string, string>();
  for (const m of models) {
    if (m.blockKind !== "model") continue;
    for (const f of m.fields) {
      if (f.kind !== "relation") continue;
      const [a, b] = [m.name, f.typeName].sort(compareStrings) as [string, string];
      const key = JSON.stringify([a, b, f.relation?.name ?? ""]);
      const end: RelationEnd = { model: m.name, field: f.name, isList: f.isList, isOptional: f.isOptional, span: f.span };
      fieldOf.set(`${m.name}.${f.name}`, f);
      targetOf.set(`${m.name}.${f.name}`, f.typeName);
      const list = groups.get(key) ?? [];
      list.push(end);
      groups.set(key, list);
    }
  }

  const out: ResolvedRelation[] = [];
  for (const [key, ends] of groups) {
    const relName = (JSON.parse(key) as string[])[2] || undefined;
    ends.sort((x, y) => compareStrings(`${x.model}.${x.field}`, `${y.model}.${y.field}`));
    const withFields = ends.filter((e) => (fieldOf.get(`${e.model}.${e.field}`)?.relation?.fields?.length ?? 0) > 0);
    const base = { ...(relName ? { name: relName } : {}), ends };
    const ownerInfo = (e: RelationEnd) => {
      const f = fieldOf.get(`${e.model}.${e.field}`) as PrismaField;
      return { ...e, fields: f.relation?.fields ?? [], references: f.relation?.references ?? [] };
    };
    const idOf = (e: RelationEnd) => `${e.model}.${e.field}`;

    if (ends.length === 2) {
      const [e1, e2] = ends as [RelationEnd, RelationEnd];
      if (withFields.length === 1) {
        const ownerEnd = withFields[0] as RelationEnd;
        const otherEnd = ownerEnd === e1 ? e2 : e1;
        const owner = ownerInfo(ownerEnd);
        const referencedModel = targetOf.get(idOf(ownerEnd)) as string;
        let reason: string | undefined;
        if (ownerEnd.isList) reason = "the side declaring fields/references is a list";
        else if (owner.fields.length !== owner.references.length) reason = "fields and references have different lengths";
        else if (otherEnd.model !== referencedModel || targetOf.get(idOf(otherEnd)) !== ownerEnd.model) reason = "relation ends do not point at each other";
        if (reason) {
          out.push({ id: idOf(ownerEnd), ...base, status: "ambiguous", kind: "unknown", owner, other: otherEnd, referencedModel, reason });
        } else {
          out.push({
            id: idOf(ownerEnd),
            ...base,
            status: "resolved",
            kind: otherEnd.isList ? "one_to_many" : "one_to_one",
            owner,
            other: otherEnd,
            referencedModel,
          });
        }
        continue;
      }
      if (withFields.length === 0) {
        if (e1.isList && e2.isList) {
          out.push({ id: `${idOf(e1)}<->${idOf(e2)}`, ...base, status: "resolved", kind: "implicit_many_to_many" });
        } else {
          out.push({
            id: `${idOf(e1)}<->${idOf(e2)}`,
            ...base,
            status: "ambiguous",
            kind: "unknown",
            reason: "neither side declares fields/references",
          });
        }
        continue;
      }
      out.push({ id: `${idOf(e1)}<->${idOf(e2)}`, ...base, status: "ambiguous", kind: "unknown", reason: "both sides declare fields/references" });
      continue;
    }
    if (ends.length === 1) {
      const only = ends[0] as RelationEnd;
      if (withFields.length === 1 && !only.isList) {
        out.push({
          id: idOf(only),
          ...base,
          status: "ambiguous",
          kind: "unknown",
          owner: ownerInfo(only),
          referencedModel: targetOf.get(idOf(only)) as string,
          reason: "the opposite relation field is missing, so 1:1 vs 1:n cannot be determined",
        });
      } else {
        out.push({ id: idOf(only), ...base, status: "ambiguous", kind: "unknown", reason: "the opposite relation field is missing" });
      }
      continue;
    }
    out.push({
      id: ends.map(idOf).join("<->"),
      ...base,
      status: "ambiguous",
      kind: "unknown",
      reason: `${ends.length} relation fields share this model pair and relation name; add distinct relation names`,
    });
  }
  out.sort((a, b) => compareStrings(a.id, b.id));
  return out;
}
