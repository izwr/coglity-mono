import { z } from 'zod/v4';

/**
 * Keyset (cursor) pagination contract shared by the backend routes and the UI
 * services. Cursors encode the sort key of the last row of a page so the next
 * page is fetched with an indexed `(sortValue, id) < (k0, k1)` predicate
 * instead of OFFSET, which stays O(limit) at any depth.
 */

export type SortDir = 'asc' | 'desc';

export type CursorPayload = {
  /** Sort key of the last row: [sortValue (ISO string or text), id (uuid)] */
  k: [string, string];
  /** Sort field the cursor was issued for; requests must match it. */
  s: string;
  /** Sort direction the cursor was issued for. */
  d: SortDir;
};

export type CountResult = {
  value: number;
  isEstimate: boolean;
};

export type CursorPage<T> = {
  data: T[];
  /** Cursor for the next page, or null when the result set is exhausted. */
  nextCursor: string | null;
  /** Present on the first page only (no cursor supplied); null afterwards. */
  totalCount: CountResult | null;
};

export const cursorListQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  sortBy: z.string().optional(),
  sortDir: z.enum(['asc', 'desc']).default('desc'),
});

export type CursorListQuery = z.infer<typeof cursorListQuerySchema>;

/* Dependency-free base64url codec: this package compiles without DOM or node
   libs, so btoa/Buffer are unavailable at the type level. UTF-8 is handled via
   percent-encoding so non-ASCII sort values (e.g. titles) round-trip. */

const B64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const B64_LOOKUP: Record<string, number> = {};
for (let i = 0; i < B64_ALPHABET.length; i++) B64_LOOKUP[B64_ALPHABET[i]] = i;

function toBase64Url(s: string): string {
  // Percent-encode to UTF-8 bytes expressed as ASCII, then pack 3 bytes → 4 chars.
  const ascii = encodeURIComponent(s).replace(/%([0-9A-F]{2})/g, (_, hex: string) =>
    String.fromCharCode(parseInt(hex, 16)),
  );
  let out = '';
  for (let i = 0; i < ascii.length; i += 3) {
    const b0 = ascii.charCodeAt(i);
    const b1 = i + 1 < ascii.length ? ascii.charCodeAt(i + 1) : NaN;
    const b2 = i + 2 < ascii.length ? ascii.charCodeAt(i + 2) : NaN;
    out += B64_ALPHABET[b0 >> 2];
    out += B64_ALPHABET[((b0 & 3) << 4) | (Number.isNaN(b1) ? 0 : b1 >> 4)];
    if (!Number.isNaN(b1)) out += B64_ALPHABET[((b1 & 15) << 2) | (Number.isNaN(b2) ? 0 : b2 >> 6)];
    if (!Number.isNaN(b2)) out += B64_ALPHABET[b2 & 63];
  }
  return out;
}

function fromBase64Url(s: string): string {
  let bytes = '';
  for (let i = 0; i < s.length; i += 4) {
    const c0 = B64_LOOKUP[s[i]];
    const c1 = B64_LOOKUP[s[i + 1]];
    const c2 = s[i + 2] !== undefined ? B64_LOOKUP[s[i + 2]] : undefined;
    const c3 = s[i + 3] !== undefined ? B64_LOOKUP[s[i + 3]] : undefined;
    if (c0 === undefined || c1 === undefined) throw new Error('invalid base64url');
    bytes += String.fromCharCode((c0 << 2) | (c1 >> 4));
    if (c2 !== undefined) bytes += String.fromCharCode(((c1 & 15) << 4) | (c2 >> 2));
    if (c3 !== undefined) bytes += String.fromCharCode(((c2! & 3) << 6) | c3);
  }
  return decodeURIComponent(
    bytes.replace(/[\s\S]/g, (ch) => `%${ch.charCodeAt(0).toString(16).padStart(2, '0')}`),
  );
}

export function encodeCursor(payload: CursorPayload): string {
  return toBase64Url(JSON.stringify(payload));
}

/** Returns null on any malformed input; callers should respond 400. */
export function decodeCursor(cursor: string): CursorPayload | null {
  try {
    const parsed: unknown = JSON.parse(fromBase64Url(cursor));
    if (typeof parsed !== 'object' || parsed === null) return null;
    const p = parsed as Record<string, unknown>;
    if (
      !Array.isArray(p.k) ||
      p.k.length !== 2 ||
      typeof p.k[0] !== 'string' ||
      typeof p.k[1] !== 'string' ||
      typeof p.s !== 'string' ||
      (p.d !== 'asc' && p.d !== 'desc')
    ) {
      return null;
    }
    return { k: [p.k[0], p.k[1]], s: p.s, d: p.d };
  } catch {
    return null;
  }
}
