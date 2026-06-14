import { sql, type SQL } from 'drizzle-orm';
import type { PgColumn } from 'drizzle-orm/pg-core';
import { type CursorPayload, type SortDir, encodeCursor } from '@coglity/shared';

/**
 * Keyset (cursor) pagination predicate. Uses a row-value comparison
 * `(sortCol, idCol) < ($k0, $k1)` so Postgres can drive it from a composite
 * btree index — O(limit) at any depth, stable under concurrent inserts.
 */
export function keysetWhere(
  sortCol: PgColumn,
  idCol: PgColumn,
  cursor: CursorPayload,
): SQL {
  const [k0, k1] = cursor.k;
  return cursor.d === 'asc'
    ? sql`(${sortCol}, ${idCol}) > (${k0}, ${k1})`
    : sql`(${sortCol}, ${idCol}) < (${k0}, ${k1})`;
}

/** Cursor for the next page, built from the last row of the current one. */
export function nextCursorFrom(
  sortField: string,
  sortDir: SortDir,
  sortValue: unknown,
  id: string,
): string {
  const k0 = sortValue instanceof Date ? sortValue.toISOString() : String(sortValue ?? '');
  return encodeCursor({ k: [k0, id], s: sortField, d: sortDir });
}
