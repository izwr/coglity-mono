import { sql, type SQLWrapper } from 'drizzle-orm';
import type { CountResult } from '@coglity/shared';
import { db as rootDb } from '../db';

type DbHandle = typeof rootDb;

const DEFAULT_THRESHOLD = 50_000;

function threshold(): number {
  const raw = process.env.COUNT_ESTIMATE_THRESHOLD;
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : DEFAULT_THRESHOLD;
}

/**
 * Totals at scale: exact count(*) over millions of matching rows is a full
 * scan per request, so we first ask the planner. If its row estimate is
 * above the threshold we return the estimate (UI renders "≈1.2M"); below it
 * an exact count is cheap and we run the provided counter.
 *
 * `estimateQuery` should be a plain select over the filtered table (no
 * limit/offset/joins beyond what the filter needs) so the top plan node's
 * row estimate corresponds to the matching row count.
 */
export async function countWithEstimate(
  db: DbHandle,
  estimateQuery: SQLWrapper,
  exactCount: () => Promise<number>,
): Promise<CountResult> {
  let estimate = Number.POSITIVE_INFINITY;
  try {
    const rows = (await db.execute(sql`explain (format json) ${estimateQuery}`)) as Array<
      Record<string, unknown>
    >;
    const planColumn = rows[0]?.['QUERY PLAN'];
    const parsed = typeof planColumn === 'string' ? JSON.parse(planColumn) : planColumn;
    const planRows = Array.isArray(parsed)
      ? (parsed[0]?.Plan?.['Plan Rows'] as number | undefined)
      : undefined;
    if (typeof planRows === 'number') estimate = planRows;
  } catch {
    // EXPLAIN failure falls through to an exact count.
    estimate = 0;
  }

  if (estimate >= threshold()) {
    return { value: Math.round(estimate), isEstimate: true };
  }
  return { value: await exactCount(), isEstimate: false };
}
