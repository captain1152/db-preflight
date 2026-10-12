// Structural parser for a declared subset of the Prisma Schema Language (Prisma ORM 7).
// It is intentionally tolerant: it does not validate relations (so schemas that fail
// `prisma validate` with P1012 are still analyzable), but every construct it cannot
// parse is reported as a located diagnostic instead of being skipped silently.

import type { Diagnostic, SourceSpan } from "../core/types.ts";
import { type Token, tokenize } from "./tokenizer.ts";

export type Expr =
  | { kind: "string"; value: string; span: SourceSpan }
  | { kind: "number"; value: string; span: SourceSpan }
  | { kind: "ident"; name: string; span: SourceSpan }
  | { kind: "array"; items: Expr[]; span: SourceSpan }
  | { kind: "call"; name: string; args: Arg[]; span: SourceSpan };

export interface Arg {
  name?: string;
  value: Expr;
  span: SourceSpan;
}

export interface AttributeNode {
  block: boolean;
  /** e.g. "relation", "db.VarChar". */
  name: string;
  args: Arg[] | null;
  span: SourceSpan;
}

export interface FieldNode {
  name: string;
  typeName: string;
  typeArgs: Arg[] | null;
  isList: boolean;
  isOptional: boolean;
  attributes: AttributeNode[];
  span: SourceSpan;
  nameSpan: SourceSpan;
}

export interface PropertyNode {
  key: string;
  value: Expr;
  span: SourceSpan;
}

export interface EnumValueNode {
  name: string;
  attributes: AttributeNode[];
  span: SourceSpan;
}

export interface BlockNode {
  keyword: string;
  name: string;
  span: SourceSpan;
  known: boolean;
  fields: FieldNode[];
  blockAttributes: AttributeNode[];
  properties: PropertyNode[];
  enumValues: EnumValueNode[];
  /** Diagnostics raised while parsing this block's body. */
  diagnostics: Diagnostic[];
}

export interface FileAst {
  file: string;
  blocks: BlockNode[];
  /** Diagnostics outside any block. */
  diagnostics: Diagnostic[];
}

const KNOWN_BLOCKS = new Set(["model", "view", "enum", "datasource", "generator", "type"]);

class ParseError extends Error {
  readonly token: Token;
  constructor(message: string, token: Token) {
    super(message);
    this.token = token;
  }
}

export function parsePrismaFile(file: string, text: string): FileAst {
  const p = new Parser(file, tokenize(text));
  return p.parseFile();
}

class Parser {
  private pos = 0;
  private readonly file: string;
  private readonly tokens: Token[];
  /** Set when a newline was consumed inside an argument list or array. */
  private multiline = false;
  constructor(file: string, tokens: Token[]) {
    this.file = file;
    this.tokens = tokens;
  }

  private span(start: Token, end: Token): SourceSpan {
    return { file: this.file, line: start.line, column: start.column, endLine: end.endLine, endColumn: end.endColumn };
  }

  private peek(offset = 0): Token {
    return this.tokens[Math.min(this.pos + offset, this.tokens.length - 1)] as Token;
  }
  private prev(): Token {
    return this.tokens[Math.max(this.pos - 1, 0)] as Token;
  }
  private next(): Token {
    const t = this.peek();
    if (t.type !== "eof") this.pos++;
    return t;
  }
  private isPunct(t: Token, v: string): boolean {
    return t.type === "punct" && t.value === v;
  }
  private expectPunct(v: string): Token {
    const t = this.peek();
    if (!this.isPunct(t, v)) throw new ParseError(`expected "${v}" but found ${describe(t)}`, t);
    return this.next();
  }
  /** Skip newlines and comments inside brackets/parentheses (Prisma 7 itself rejects such newlines). */
  private skipTrivia(): void {
    while (this.peek().type === "newline" || this.peek().type === "comment") {
      if (this.peek().type === "newline") this.multiline = true;
      this.pos++;
    }
  }
  /** Skip blank lines and comments between statements. */
  private skipStatementTrivia(): void {
    while (this.peek().type === "newline" || this.peek().type === "comment") this.pos++;
  }
  private diag(code: string, message: string, t: Token, extra?: Partial<Diagnostic>): Diagnostic {
    return { code, severity: "blocking", message, span: this.span(t, t), ...extra };
  }

  parseFile(): FileAst {
    const blocks: BlockNode[] = [];
    const diagnostics: Diagnostic[] = [];
    for (;;) {
      this.skipStatementTrivia();
      const t = this.peek();
      if (t.type === "eof") break;
      if (t.type === "invalid" && t.value === "/" && this.peek(1).value === "*") {
        diagnostics.push(this.diag("PSL_UNSUPPORTED_COMMENT", "block comments are not part of PSL", t));
        this.recoverTopLevel();
        continue;
      }
      if (t.type !== "ident") {
        diagnostics.push(this.diag("PSL_UNEXPECTED_TOKEN", `unexpected ${describe(t)} at top level`, t));
        this.recoverTopLevel();
        continue;
      }
      const keywordTok = this.next();
      const nameTok = this.peek();
      if (nameTok.type !== "ident") {
        diagnostics.push(this.diag("PSL_UNEXPECTED_TOKEN", `expected a name after "${keywordTok.value}"`, nameTok));
        this.recoverTopLevel();
        continue;
      }
      this.next();
      this.skipTrivia();
      if (!this.isPunct(this.peek(), "{")) {
        diagnostics.push(this.diag("PSL_UNEXPECTED_TOKEN", `expected "{" after ${keywordTok.value} ${nameTok.value}`, this.peek()));
        this.recoverTopLevel();
        continue;
      }
      this.next();
      const known = KNOWN_BLOCKS.has(keywordTok.value);
      const block: BlockNode = {
        keyword: keywordTok.value,
        name: nameTok.value,
        span: this.span(keywordTok, nameTok),
        known,
        fields: [],
        blockAttributes: [],
        properties: [],
        enumValues: [],
        diagnostics: [],
      };
      if (!known) {
        diagnostics.push({
          code: "PSL_UNSUPPORTED_BLOCK",
          severity: "blocking",
          message: `block type "${keywordTok.value}" is not supported by db-preflight v0.1`,
          span: block.span,
        });
        this.skipBalancedBody();
      } else {
        this.parseBody(block);
      }
      const closing = this.prev();
      block.span = this.span(keywordTok, closing);
      blocks.push(block);
    }
    return { file: this.file, blocks, diagnostics };
  }

  /** Skip to the end of the current top-level construct. */
  private recoverTopLevel(): void {
    let depth = 0;
    for (;;) {
      const t = this.peek();
      if (t.type === "eof") return;
      if (this.isPunct(t, "{")) depth++;
      if (this.isPunct(t, "}")) {
        depth--;
        this.next();
        if (depth <= 0) return;
        continue;
      }
      if (t.type === "newline" && depth === 0) {
        this.next();
        return;
      }
      this.next();
    }
  }

  /** Consume tokens until the "}" that closes an already-opened block. */
  private skipBalancedBody(): void {
    let depth = 1;
    for (;;) {
      const t = this.next();
      if (t.type === "eof") return;
      if (this.isPunct(t, "{")) depth++;
      if (this.isPunct(t, "}")) {
        depth--;
        if (depth === 0) return;
      }
    }
  }

  /** Skip the remainder of a statement line (respecting nesting) without consuming a closing "}". */
  private skipRestOfLine(): void {
    let depth = 0;
    for (;;) {
      const t = this.peek();
      if (t.type === "eof") return;
      if (depth === 0 && (t.type === "newline" || this.isPunct(t, "}"))) return;
      if (this.isPunct(t, "(") || this.isPunct(t, "[") || this.isPunct(t, "{")) depth++;
      if (this.isPunct(t, ")") || this.isPunct(t, "]") || (this.isPunct(t, "}") && depth > 0)) depth--;
      this.next();
    }
  }

  private atEndOfStatement(): boolean {
    const t = this.peek();
    return t.type === "newline" || t.type === "comment" || t.type === "eof" || this.isPunct(t, "}");
  }

  private parseBody(block: BlockNode): void {
    for (;;) {
      this.skipStatementTrivia();
      const t = this.peek();
      if (t.type === "eof") {
        block.diagnostics.push(this.diag("PSL_UNTERMINATED_BLOCK", `block ${block.keyword} ${block.name} is not closed`, t));
        return;
      }
      if (this.isPunct(t, "}")) {
        this.next();
        return;
      }
      const start = this.pos;
      this.multiline = false;
      try {
        if (this.isPunct(t, "@@")) {
          block.blockAttributes.push(this.parseAttribute());
        } else if (t.type === "ident") {
          if (block.keyword === "datasource" || block.keyword === "generator") {
            block.properties.push(this.parseProperty());
          } else if (block.keyword === "enum") {
            block.enumValues.push(this.parseEnumValue());
          } else {
            block.fields.push(this.parseField());
          }
        } else {
          throw new ParseError(`unexpected ${describe(t)} in ${block.keyword} ${block.name}`, t);
        }
        if (!this.atEndOfStatement()) {
          throw new ParseError(`unexpected ${describe(this.peek())} after statement`, this.peek());
        }
        if (this.multiline) {
          const startTok = this.tokens[start] as Token;
          block.diagnostics.push({
            code: "PSL_MULTILINE_REJECTED_BY_PRISMA",
            severity: "warning",
            message:
              "this statement spans several lines; db-preflight read it, but Prisma ORM 7 rejects newlines inside attribute arguments and arrays (prisma validate reports a syntax error)",
            span: this.span(startTok, this.prev()),
            model: block.name,
          });
        }
      } catch (e) {
        if (!(e instanceof ParseError)) throw e;
        const startTok = this.tokens[start] as Token;
        const fieldName = startTok.type === "ident" ? startTok.value : undefined;
        block.diagnostics.push({
          code: "PSL_SYNTAX",
          severity: "blocking",
          message: e.message,
          span: this.span(e.token, e.token),
          model: block.name,
          ...(fieldName && block.keyword !== "datasource" && block.keyword !== "generator" ? { field: fieldName } : {}),
        });
        // Drop any partially parsed statement and resynchronise at the next line.
        this.skipRestOfLine();
      }
    }
  }

  private parseProperty(): PropertyNode {
    const keyTok = this.next();
    this.expectPunct("=");
    const value = this.parseExpr();
    return { key: keyTok.value, value, span: this.span(keyTok, this.prev()) };
  }

  private parseEnumValue(): EnumValueNode {
    const nameTok = this.next();
    const attributes: AttributeNode[] = [];
    while (this.isPunct(this.peek(), "@")) attributes.push(this.parseAttribute());
    return { name: nameTok.value, attributes, span: this.span(nameTok, this.prev()) };
  }

  private parseField(): FieldNode {
    const nameTok = this.next();
    const typeTok = this.peek();
    if (typeTok.type !== "ident") throw new ParseError(`expected a type for field "${nameTok.value}"`, typeTok);
    this.next();
    let typeArgs: Arg[] | null = null;
    if (this.isPunct(this.peek(), "(")) typeArgs = this.parseArgs();
    let isList = false;
    let isOptional = false;
    if (this.isPunct(this.peek(), "[")) {
      this.next();
      this.expectPunct("]");
      isList = true;
    }
    if (this.isPunct(this.peek(), "?")) {
      this.next();
      isOptional = true;
    }
    if (this.isPunct(this.peek(), "?") || this.isPunct(this.peek(), "[") || this.isPunct(this.peek(), "!")) {
      throw new ParseError(`unsupported type modifier ${describe(this.peek())} on field "${nameTok.value}"`, this.peek());
    }
    const attributes: AttributeNode[] = [];
    while (this.isPunct(this.peek(), "@")) attributes.push(this.parseAttribute());
    return {
      name: nameTok.value,
      typeName: typeTok.value,
      typeArgs,
      isList,
      isOptional,
      attributes,
      span: this.span(nameTok, this.prev()),
      nameSpan: this.span(nameTok, nameTok),
    };
  }

  private parseAttribute(): AttributeNode {
    const at = this.next(); // "@" or "@@"
    const block = at.value === "@@";
    const first = this.peek();
    if (first.type !== "ident") throw new ParseError(`expected an attribute name after "${at.value}"`, first);
    this.next();
    let name = first.value;
    while (this.isPunct(this.peek(), ".")) {
      this.next();
      const part = this.peek();
      if (part.type !== "ident") throw new ParseError(`expected a name after "." in attribute ${at.value}${name}`, part);
      this.next();
      name += `.${part.value}`;
    }
    let args: Arg[] | null = null;
    if (this.isPunct(this.peek(), "(")) args = this.parseArgs();
    return { block, name, args, span: this.span(at, this.prev()) };
  }

  private parseArgs(): Arg[] {
    this.expectPunct("(");
    const args: Arg[] = [];
    this.skipTrivia();
    while (!this.isPunct(this.peek(), ")")) {
      const start = this.peek();
      let name: string | undefined;
      if (start.type === "ident" && this.isPunct(this.peekSkippingTrivia(1), ":")) {
        name = this.next().value;
        this.skipTrivia();
        this.expectPunct(":");
        this.skipTrivia();
      }
      const value = this.parseExpr();
      args.push(name !== undefined ? { name, value, span: this.span(start, this.prev()) } : { value, span: this.span(start, this.prev()) });
      this.skipTrivia();
      if (this.isPunct(this.peek(), ",")) {
        this.next();
        this.skipTrivia();
        continue;
      }
      if (!this.isPunct(this.peek(), ")")) throw new ParseError(`expected "," or ")" but found ${describe(this.peek())}`, this.peek());
    }
    this.expectPunct(")");
    return args;
  }

  private peekSkippingTrivia(offset: number): Token {
    let seen = 0;
    for (let k = this.pos; k < this.tokens.length; k++) {
      const t = this.tokens[k] as Token;
      if (t.type === "newline" || t.type === "comment") continue;
      if (seen === offset) return t;
      seen++;
    }
    return this.tokens[this.tokens.length - 1] as Token;
  }

  private parseExpr(): Expr {
    this.skipTrivia();
    const t = this.peek();
    if (t.type === "string") {
      if (t.unterminated) throw new ParseError("unterminated string literal", t);
      if (t.badEscape) throw new ParseError(`unsupported escape sequence ${t.badEscape} in string literal`, t);
      this.next();
      return { kind: "string", value: t.value, span: this.span(t, t) };
    }
    if (t.type === "number") {
      this.next();
      return { kind: "number", value: t.value, span: this.span(t, t) };
    }
    if (this.isPunct(t, "[")) {
      this.next();
      const items: Expr[] = [];
      this.skipTrivia();
      while (!this.isPunct(this.peek(), "]")) {
        items.push(this.parseExpr());
        this.skipTrivia();
        if (this.isPunct(this.peek(), ",")) {
          this.next();
          this.skipTrivia();
          continue;
        }
        if (!this.isPunct(this.peek(), "]")) throw new ParseError(`expected "," or "]" but found ${describe(this.peek())}`, this.peek());
      }
      const end = this.next();
      return { kind: "array", items, span: this.span(t, end) };
    }
    if (t.type === "ident") {
      this.next();
      let name = t.value;
      while (this.isPunct(this.peek(), ".") && this.peek(1).type === "ident") {
        this.next();
        name += `.${this.next().value}`;
      }
      if (this.isPunct(this.peek(), "(")) {
        const args = this.parseArgs();
        return { kind: "call", name, args, span: this.span(t, this.prev()) };
      }
      return { kind: "ident", name, span: this.span(t, this.prev()) };
    }
    throw new ParseError(`expected a value but found ${describe(t)}`, t);
  }
}

function describe(t: Token): string {
  switch (t.type) {
    case "eof":
      return "end of file";
    case "newline":
      return "end of line";
    case "string":
      return "string literal";
    case "invalid":
      return `unsupported character U+${(t.value.codePointAt(0) ?? 0).toString(16).toUpperCase().padStart(4, "0")}`;
    default:
      return `"${t.value.length > 40 ? `${t.value.slice(0, 40)}…` : t.value}"`;
  }
}
