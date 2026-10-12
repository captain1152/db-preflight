// Secret redaction for every message that may leave the process (stderr, reports, worker IPC).

const REDACTED = "[REDACTED]";

/** Variants of a secret as it might appear in messages: raw, URL-encoded, form-encoded, decoded. */
export function secretVariants(secret: string): string[] {
  const out = new Set<string>();
  if (!secret) return [];
  out.add(secret);
  try {
    out.add(encodeURIComponent(secret));
  } catch {
    /* lone surrogate */
  }
  out.add(encodeURIComponent(secret).replace(/%20/g, "+"));
  try {
    out.add(decodeURIComponent(secret));
  } catch {
    /* not percent-encoded */
  }
  out.add(encodeURI(secret));
  // Lower-case percent escapes as produced by some libraries.
  out.add(encodeURIComponent(secret).replace(/%[0-9A-F]{2}/g, (m) => m.toLowerCase()));
  return [...out].filter((v) => v.length >= 1).sort((a, b) => b.length - a.length);
}

export function redact(text: string, secrets: readonly string[] = []): string {
  let out = text;
  for (const s of secrets) {
    for (const v of secretVariants(s)) {
      if (v.length < 2) continue; // avoid shredding unrelated text for 1-char secrets; URL patterns below still apply
      out = out.split(v).join(REDACTED);
    }
  }
  // Any URL userinfo (scheme://user:password@host) — keep the scheme only.
  out = out.replace(/\b([a-z][a-z0-9+.-]*):\/\/[^\s/@'"]*@/gi, `$1://${REDACTED}@`);
  // key=value secrets in connection strings / libpq style / query params.
  out = out.replace(/\b(password|passwd|pwd|sslpassword|sslkey|token|secret)(\s*[=:]\s*)("[^"]*"|'[^']*'|[^\s&;,'"]+)/gi, `$1$2${REDACTED}`);
  return out;
}

export interface SafeErrorInfo {
  code?: string;
  message: string;
}

/**
 * Flatten an error (including nested `cause` and AggregateError `errors`) into redacted
 * code+message pairs. Stack traces, `detail`, `hint`, `where` and other fields are dropped.
 */
export function describeError(err: unknown, secrets: readonly string[] = [], depth = 0): SafeErrorInfo[] {
  if (depth > 5 || err === null || err === undefined) return [];
  const out: SafeErrorInfo[] = [];
  if (err instanceof Error || (typeof err === "object" && err !== null && "message" in err)) {
    const e = err as { message?: unknown; code?: unknown; cause?: unknown; errors?: unknown };
    const code = typeof e.code === "string" ? e.code.slice(0, 64) : undefined;
    const msg = typeof e.message === "string" ? e.message : String(e.message);
    out.push({ ...(code ? { code } : {}), message: redact(msg, secrets).slice(0, 2000) });
    if (Array.isArray(e.errors)) for (const sub of e.errors.slice(0, 10)) out.push(...describeError(sub, secrets, depth + 1));
    if (e.cause !== undefined) out.push(...describeError(e.cause, secrets, depth + 1));
  } else {
    out.push({ message: redact(String(err), secrets).slice(0, 2000) });
  }
  return out;
}

export function formatError(err: unknown, secrets: readonly string[] = []): string {
  return describeError(err, secrets)
    .map((e) => (e.code ? `[${e.code}] ${e.message}` : e.message))
    .join(" <- caused by: ");
}
