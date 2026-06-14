import { Router, type Router as RouterType } from 'express';
import { and, eq, gte, lte, sql, inArray, desc } from 'drizzle-orm';
import { testRuns, testCases, testSuites } from '@coglity/shared/schema';
import {
  statsRunFiltersSchema,
  statsTimeseriesQuerySchema,
  statsBreakdownQuerySchema,
  statsHeatmapQuerySchema,
  type RunsOverview,
  type RunsTimeseries,
  type RunsBreakdown,
  type RunsHeatmap,
  type RunState,
  type TimeseriesBucket,
} from '@coglity/shared';
import { db } from '../db';

/**
 * Aggregation-first reporting. Raw run rows are never listed from here —
 * every endpoint returns range-bounded aggregates the UI can drill into by
 * re-querying with narrower filters. The (project_id, state, created_at)
 * index keeps these GROUP BYs fast into tens of millions of rows/project;
 * beyond that (or for all-time ranges) the hardening step is a
 * test_runs_daily_rollup materialized view that wide ranges get routed to.
 */
const router: RouterType = Router({ mergeParams: true });

const MAX_RANGE_DAYS = 366;
const MAX_BUCKETS = 500;
const BUCKET_MS: Record<TimeseriesBucket, number> = {
  hour: 3_600_000,
  day: 86_400_000,
  week: 7 * 86_400_000,
};

type RunFilters = {
  from?: Date;
  to?: Date;
  state?: RunState;
  environment?: string;
  language?: string;
  testCaseId?: string;
  testSuiteId?: string;
};

function resolveRange(filters: RunFilters): { from: Date; to: Date } | { error: string } {
  const to = filters.to ?? new Date();
  const from = filters.from ?? new Date(to.getTime() - 30 * 86_400_000);
  if (from.getTime() > to.getTime()) return { error: 'from must be before to' };
  if (to.getTime() - from.getTime() > MAX_RANGE_DAYS * 86_400_000)
    return { error: `Range too wide (max ${MAX_RANGE_DAYS} days)` };
  return { from, to };
}

function runConditions(projectIds: string[], filters: RunFilters, from: Date, to: Date) {
  const conditions = [
    inArray(testRuns.projectId, projectIds),
    gte(testRuns.createdAt, from),
    lte(testRuns.createdAt, to),
  ];
  if (filters.state) conditions.push(eq(testRuns.state, filters.state));
  if (filters.environment) conditions.push(eq(testRuns.environment, filters.environment));
  if (filters.language) conditions.push(eq(testRuns.language, filters.language));
  if (filters.testCaseId) conditions.push(eq(testRuns.testCaseId, filters.testCaseId));
  if (filters.testSuiteId) conditions.push(eq(testCases.testSuiteId, filters.testSuiteId));
  return conditions;
}

/** testSuiteId filters and suite/case breakdowns need the test_cases join. */
function needsCaseJoin(filters: RunFilters): boolean {
  return Boolean(filters.testSuiteId);
}

function emptyByState(): Record<RunState, number> {
  return { queued: 0, running: 0, passed: 0, failed: 0, errored: 0, cancelled: 0 };
}

function passRateOf(byState: Record<RunState, number>): number | null {
  const terminal = byState.passed + byState.failed + byState.errored;
  return terminal > 0 ? byState.passed / terminal : null;
}

// ── Overview: totals + state distribution + pass rate ─────────
router.get('/runs/overview', async (req, res) => {
  const ids = req.projectIdsScope ?? [];
  const parsed = statsRunFiltersSchema.safeParse({ ...req.query });
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    return;
  }
  const range = resolveRange(parsed.data);
  if ('error' in range) {
    res.status(400).json({ error: range.error });
    return;
  }
  const rangeOut = { from: range.from.toISOString(), to: range.to.toISOString() };

  if (ids.length === 0) {
    const empty: RunsOverview = {
      range: rangeOut,
      total: { value: 0, isEstimate: false },
      byState: emptyByState(),
      passRate: null,
      avgDurationMs: null,
    };
    res.json(empty);
    return;
  }

  const where = and(...runConditions(ids, parsed.data, range.from, range.to));
  let query = db
    .select({
      state: testRuns.state,
      count: sql<number>`cast(count(*) as int)`,
      durSum: sql<number>`coalesce(sum(${testRuns.recordingDurationMs}) filter (where ${testRuns.recordingDurationMs} > 0), 0)`.mapWith(
        Number,
      ),
      durCount: sql<number>`cast(count(*) filter (where ${testRuns.recordingDurationMs} > 0) as int)`,
    })
    .from(testRuns)
    .$dynamic();
  if (needsCaseJoin(parsed.data))
    query = query.innerJoin(testCases, eq(testRuns.testCaseId, testCases.id));
  const rows = await query.where(where).groupBy(testRuns.state);

  const byState = emptyByState();
  let total = 0;
  let durSum = 0;
  let durCount = 0;
  for (const row of rows) {
    byState[row.state] = row.count;
    total += row.count;
    durSum += row.durSum;
    durCount += row.durCount;
  }

  const overview: RunsOverview = {
    range: rangeOut,
    total: { value: total, isEstimate: false },
    byState,
    passRate: passRateOf(byState),
    avgDurationMs: durCount > 0 ? Math.round(durSum / durCount) : null,
  };
  res.json(overview);
});

// ── Timeseries: bucketed pass/fail counts ──────────────────────
router.get('/runs/timeseries', async (req, res) => {
  const ids = req.projectIdsScope ?? [];
  const parsed = statsTimeseriesQuerySchema.safeParse({ ...req.query });
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    return;
  }
  const { bucket } = parsed.data;
  const range = resolveRange(parsed.data);
  if ('error' in range) {
    res.status(400).json({ error: range.error });
    return;
  }
  const bucketCount = Math.ceil((range.to.getTime() - range.from.getTime()) / BUCKET_MS[bucket]);
  if (bucketCount > MAX_BUCKETS) {
    res.status(400).json({ error: `Too many buckets (${bucketCount} > ${MAX_BUCKETS}); use a coarser bucket` });
    return;
  }
  const rangeOut = { from: range.from.toISOString(), to: range.to.toISOString() };

  if (ids.length === 0) {
    res.json({ range: rangeOut, bucket, points: [] } satisfies RunsTimeseries);
    return;
  }

  // bucket comes from a zod enum whitelist, so raw interpolation is safe.
  const bucketExpr = sql<Date>`date_trunc('${sql.raw(bucket)}', ${testRuns.createdAt})`;
  const where = and(...runConditions(ids, parsed.data, range.from, range.to));

  let query = db
    .select({
      ts: bucketExpr,
      total: sql<number>`cast(count(*) as int)`,
      passed: sql<number>`cast(count(*) filter (where ${testRuns.state} = 'passed') as int)`,
      failed: sql<number>`cast(count(*) filter (where ${testRuns.state} = 'failed') as int)`,
      errored: sql<number>`cast(count(*) filter (where ${testRuns.state} = 'errored') as int)`,
    })
    .from(testRuns)
    .$dynamic();
  if (needsCaseJoin(parsed.data))
    query = query.innerJoin(testCases, eq(testRuns.testCaseId, testCases.id));
  const rows = await query.where(where).groupBy(bucketExpr).orderBy(bucketExpr);

  const points = rows.map((row) => ({
    ts: row.ts instanceof Date ? row.ts.toISOString() : new Date(String(row.ts)).toISOString(),
    total: row.total,
    passed: row.passed,
    failed: row.failed,
    errored: row.errored,
  }));

  res.json({ range: rangeOut, bucket, points } satisfies RunsTimeseries);
});

// ── Breakdown: top-N group-bys for drill-down ──────────────────
router.get('/runs/breakdown', async (req, res) => {
  const ids = req.projectIdsScope ?? [];
  const parsed = statsBreakdownQuerySchema.safeParse({ ...req.query });
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    return;
  }
  const { by, limit } = parsed.data;
  const range = resolveRange(parsed.data);
  if ('error' in range) {
    res.status(400).json({ error: range.error });
    return;
  }
  const rangeOut = { from: range.from.toISOString(), to: range.to.toISOString() };

  if (ids.length === 0) {
    res.json({ range: rangeOut, by, rows: [] } satisfies RunsBreakdown);
    return;
  }

  const where = and(...runConditions(ids, parsed.data, range.from, range.to));

  const counts = {
    total: sql<number>`cast(count(*) as int)`,
    passed: sql<number>`cast(count(*) filter (where ${testRuns.state} = 'passed') as int)`,
    failed: sql<number>`cast(count(*) filter (where ${testRuns.state} = 'failed') as int)`,
    errored: sql<number>`cast(count(*) filter (where ${testRuns.state} = 'errored') as int)`,
  };

  let rows: Array<{
    key: string;
    label: string | null;
    total: number;
    passed: number;
    failed: number;
    errored: number;
  }>;

  if (by === 'testSuite') {
    rows = await db
      .select({ key: testSuites.id, label: testSuites.name, ...counts })
      .from(testRuns)
      .innerJoin(testCases, eq(testRuns.testCaseId, testCases.id))
      .innerJoin(testSuites, eq(testCases.testSuiteId, testSuites.id))
      .where(where)
      .groupBy(testSuites.id, testSuites.name)
      .orderBy(desc(sql`count(*)`))
      .limit(limit);
  } else if (by === 'testCase') {
    rows = await db
      .select({ key: testCases.id, label: testCases.title, ...counts })
      .from(testRuns)
      .innerJoin(testCases, eq(testRuns.testCaseId, testCases.id))
      .where(where)
      .groupBy(testCases.id, testCases.title)
      .orderBy(desc(sql`count(*)`))
      .limit(limit);
  } else {
    const keyCol =
      by === 'environment'
        ? testRuns.environment
        : by === 'language'
          ? testRuns.language
          : testRuns.state;
    let query = db
      .select({ key: sql<string>`${keyCol}::text`, label: sql<string>`${keyCol}::text`, ...counts })
      .from(testRuns)
      .$dynamic();
    if (needsCaseJoin(parsed.data))
      query = query.innerJoin(testCases, eq(testRuns.testCaseId, testCases.id));
    rows = await query
      .where(where)
      .groupBy(keyCol)
      .orderBy(desc(sql`count(*)`))
      .limit(limit);
  }

  const out: RunsBreakdown = {
    range: rangeOut,
    by,
    rows: rows.map((row) => {
      const terminal = row.passed + row.failed + row.errored;
      return {
        key: row.key,
        label: row.label ?? row.key,
        total: row.total,
        passed: row.passed,
        failed: row.failed,
        passRate: terminal > 0 ? row.passed / terminal : null,
      };
    }),
  };
  res.json(out);
});

// ── Heatmap: failure density, top-N suites × last N days ──────
router.get('/runs/heatmap', async (req, res) => {
  const ids = req.projectIdsScope ?? [];
  const parsed = statsHeatmapQuerySchema.safeParse({ ...req.query });
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    return;
  }
  const { days, limit } = parsed.data;
  const to = new Date();
  const from = new Date(to.getTime() - days * 86_400_000);
  from.setUTCHours(0, 0, 0, 0);
  const rangeOut = { from: from.toISOString(), to: to.toISOString() };

  const cols: string[] = [];
  for (let t = from.getTime(); t <= to.getTime(); t += 86_400_000) {
    cols.push(new Date(t).toISOString().slice(0, 10));
  }

  if (ids.length === 0) {
    res.json({ range: rangeOut, cols, rows: [] } satisfies RunsHeatmap);
    return;
  }

  const dayExpr = sql<Date>`date_trunc('day', ${testRuns.createdAt})`;
  const cells = await db
    .select({
      suiteId: testSuites.id,
      suiteName: testSuites.name,
      day: dayExpr,
      failures: sql<number>`cast(count(*) as int)`,
    })
    .from(testRuns)
    .innerJoin(testCases, eq(testRuns.testCaseId, testCases.id))
    .innerJoin(testSuites, eq(testCases.testSuiteId, testSuites.id))
    .where(
      and(
        inArray(testRuns.projectId, ids),
        gte(testRuns.createdAt, from),
        inArray(testRuns.state, ['failed', 'errored']),
      ),
    )
    .groupBy(testSuites.id, testSuites.name, dayExpr);

  // Rank suites by total failures, keep top-N, lay cells out against cols.
  const bySuite = new Map<string, { suiteName: string; total: number; perDay: Map<string, number> }>();
  for (const cell of cells) {
    const day =
      cell.day instanceof Date
        ? cell.day.toISOString().slice(0, 10)
        : String(cell.day).slice(0, 10);
    const entry = bySuite.get(cell.suiteId) ?? {
      suiteName: cell.suiteName,
      total: 0,
      perDay: new Map<string, number>(),
    };
    entry.total += cell.failures;
    entry.perDay.set(day, (entry.perDay.get(day) ?? 0) + cell.failures);
    bySuite.set(cell.suiteId, entry);
  }

  const rows = [...bySuite.entries()]
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, limit)
    .map(([suiteId, entry]) => ({
      suiteId,
      suiteName: entry.suiteName,
      cells: cols.map((col) => entry.perDay.get(col) ?? 0),
    }));

  res.json({ range: rangeOut, cols, rows } satisfies RunsHeatmap);
});

export default router;
