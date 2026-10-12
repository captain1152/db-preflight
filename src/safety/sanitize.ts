// Output safety for untrusted strings (DB identifiers, paths, snapshot contents).

/** Remove ANSI escape sequences and C0/C1 control characters (keeps nothing that can drive a terminal). */
export function stripControl(s: string): string {
  // ESC [ ... final byte, OSC ... BEL/ST, other ESC sequences.
  const noAnsi = s
    .replace(/\u001b\][^\u0007\u001b]*(\u0007|\u001b\\)?/g, "")
    .replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, "")
    .replace(/\u001b[@-Z\\-_]/g, "");
  let out = "";
  for (const ch of noAnsi) {
    const cp = ch.codePointAt(0) ?? 0;
    if (cp === 0x0a || cp === 0x09) {
      out += ch;
    } else if (cp < 0x20 || (cp >= 0x7f && cp < 0xa0) || cp === 0x2028 || cp === 0x2029 || (cp >= 0x202a && cp <= 0x202e) || (cp >= 0x2066 && cp <= 0x2069)) {
      out += `\\u{${cp.toString(16)}}`;
    } else {
      out += ch;
    }
  }
  return out;
}

/** Plain-text terminal output: control characters neutralised, single line. */
export function safeText(s: string): string {
  return stripControl(s).replace(/\n/g, "\\n");
}

/** Escape text for Markdown so it cannot create links, HTML, headings, tables or code fences. */
export function mdText(s: string): string {
  return safeText(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/([\\`*_{}[\]()#+\-.!|~])/g, "\\$1");
}

/** Inline code span that cannot be broken out of (backtick run length chosen from content). */
export function mdCode(s: string): string {
  // CommonMark does not interpret HTML or Markdown inside code spans; only the fence matters.
  const t = safeText(s);
  let longest = 0;
  for (const m of t.matchAll(/`+/g)) longest = Math.max(longest, m[0].length);
  const fence = "`".repeat(longest + 1);
  const pad = t.startsWith("`") || t.endsWith("`") || t === "" ? " " : "";
  return `${fence}${pad}${t}${pad}${fence}`;
}
