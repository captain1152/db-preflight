// Tokenizer for the subset of the Prisma Schema Language that db-preflight understands.
// It never drops input silently: characters it cannot classify become "invalid" tokens
// that the parser reports as located diagnostics.

export type TokenType = "ident" | "number" | "string" | "punct" | "newline" | "comment" | "invalid" | "eof";

export interface Token {
  type: TokenType;
  /** For strings: the decoded value. For others: the raw text. */
  value: string;
  line: number;
  column: number;
  endLine: number;
  endColumn: number;
  /** Strings only: true if the closing quote was missing. */
  unterminated?: boolean;
  /** Strings only: first escape sequence that PSL does not define. */
  badEscape?: string;
}

const PUNCT_SINGLE = new Set(["{", "}", "(", ")", "[", "]", ",", ":", "=", "?", ".", "!"]);

function isIdentStart(ch: string): boolean {
  return /[A-Za-z_]/.test(ch);
}
function isIdentPart(ch: string): boolean {
  return /[A-Za-z0-9_]/.test(ch);
}

export function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  let line = 1;
  let col = 1;
  // Skip a UTF-8 BOM if present.
  if (input.charCodeAt(0) === 0xfeff) i = 1;

  const push = (type: TokenType, value: string, sl: number, sc: number, extra?: Partial<Token>) => {
    tokens.push({ type, value, line: sl, column: sc, endLine: line, endColumn: col, ...extra });
  };
  const advance = (n = 1) => {
    for (let k = 0; k < n; k++) {
      const ch = input[i];
      i++;
      if (ch === "\n") {
        line++;
        col = 1;
      } else {
        col++;
      }
    }
  };

  while (i < input.length) {
    const ch = input[i] as string;
    const sl = line;
    const sc = col;

    if (ch === "\r") {
      // CRLF or lone CR both count as one newline.
      if (input[i + 1] === "\n") {
        i++;
        advance();
      } else {
        i++;
        line++;
        col = 1;
      }
      tokens.push({ type: "newline", value: "\n", line: sl, column: sc, endLine: sl, endColumn: sc + 1 });
      continue;
    }
    if (ch === "\n") {
      advance();
      tokens.push({ type: "newline", value: "\n", line: sl, column: sc, endLine: sl, endColumn: sc + 1 });
      continue;
    }
    if (ch === " " || ch === "\t" || ch === "\f" || ch === "\v") {
      advance();
      continue;
    }
    if (ch === "/" && input[i + 1] === "/") {
      const start = i;
      while (i < input.length && input[i] !== "\n" && input[i] !== "\r") advance();
      push("comment", input.slice(start, i), sl, sc);
      continue;
    }
    if (ch === '"') {
      advance();
      let value = "";
      let terminated = false;
      let badEscape: string | undefined;
      while (i < input.length) {
        const c = input[i] as string;
        if (c === "\n" || c === "\r") break;
        if (c === "\\") {
          const next = input[i + 1];
          if (next === undefined) {
            advance();
            break;
          }
          // JSON-style escapes as accepted by Prisma's PSL string parser; anything else is an
          // error (inspection IR-009) instead of silently dropping the backslash.
          const map: Record<string, string> = { n: "\n", t: "\t", r: "\r", b: "\b", f: "\f", '"': '"', "\\": "\\", "/": "/" };
          if (map[next] !== undefined) {
            value += map[next];
            advance(2);
            continue;
          }
          if (next === "u" && /^[0-9a-fA-F]{4}$/.test(input.slice(i + 2, i + 6))) {
            value += String.fromCharCode(Number.parseInt(input.slice(i + 2, i + 6), 16));
            advance(6);
            continue;
          }
          badEscape ??= `\\${next}`;
          value += next;
          advance(2);
          continue;
        }
        if (c === '"') {
          advance();
          terminated = true;
          break;
        }
        value += c;
        advance();
      }
      push("string", value, sl, sc, { ...(terminated ? {} : { unterminated: true }), ...(badEscape ? { badEscape } : {}) });
      continue;
    }
    if (ch === "@") {
      if (input[i + 1] === "@") {
        advance(2);
        push("punct", "@@", sl, sc);
      } else {
        advance();
        push("punct", "@", sl, sc);
      }
      continue;
    }
    if (PUNCT_SINGLE.has(ch)) {
      advance();
      push("punct", ch, sl, sc);
      continue;
    }
    if (/[0-9]/.test(ch) || (ch === "-" && /[0-9]/.test(input[i + 1] ?? ""))) {
      const start = i;
      advance();
      while (i < input.length && /[0-9.eE_+-]/.test(input[i] as string)) {
        // Stop at "-" or "+" not following an exponent marker.
        const c = input[i] as string;
        if ((c === "-" || c === "+") && !/[eE]/.test(input[i - 1] as string)) break;
        advance();
      }
      push("number", input.slice(start, i), sl, sc);
      continue;
    }
    if (isIdentStart(ch)) {
      const start = i;
      while (i < input.length && isIdentPart(input[i] as string)) advance();
      push("ident", input.slice(start, i), sl, sc);
      continue;
    }
    // Anything else (including non-ASCII identifiers, which PSL does not allow) is reported.
    const cp = input.codePointAt(i) ?? 0;
    const width = cp > 0xffff ? 2 : 1;
    const raw = input.slice(i, i + width);
    i += width;
    col += width;
    push("invalid", raw, sl, sc);
  }
  tokens.push({ type: "eof", value: "", line, column: col, endLine: line, endColumn: col });
  return tokens;
}
