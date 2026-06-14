import { z } from 'zod/v4';
import type { CountResult } from './pagination';

/**
 * Aggregation-first reporting contracts. Raw run rows are never listed in
 * bulk; the UI renders these pre-aggregated shapes and drills down by
 * re-querying with narrower filters.
 */

export const TIMESERIES_BUCKETS = ['hour', 'day', 'week'] as const;
export type TimeseriesBucket = (typeof TIMESERIES_BUCKETS)[number];

export const BREAKDOWN_DIMENSIONS = [
  'environment',
  'language',
  'state',
  'testSuite',
  'testCase',
] as const;
export type BreakdownDimension = (typeof BREAKDOWN_DIMENSIONS)[number];

export const RUN_STATES = ['queued', 'running', 'passed', 'failed', 'errored', 'cancelled'] as const;
export type RunState = (typeof RUN_STATES)[number];

/** Filters every stats endpoint accepts. Range defaults to the last 30 days. */
export const statsRunFiltersSchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  state: z.enum(RUN_STATES).optional(),
  environment: z.string().max(50).optional(),
  language: z.string().max(10).optional(),
  testCaseId: z.uuid().optional(),
  testSuiteId: z.uuid().optional(),
});

export const statsTimeseriesQuerySchema = statsRunFiltersSchema.extend({
  bucket: z.enum(TIMESERIES_BUCKETS).default('day'),
});

export const statsBreakdownQuerySchema = statsRunFiltersSchema.extend({
  by: z.enum(BREAKDOWN_DIMENSIONS).default('state'),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export type StatsRange = { from: string; to: string };

export type RunsOverview = {
  range: StatsRange;
  total: CountResult;
  byState: Record<RunState, number>;
  /** Pass rate over terminal runs (passed/failed/errored), 0..1; null if none. */
  passRate: number | null;
  avgDurationMs: number | null;
};

export type TimeseriesPoint = {
  ts: string;
  total: number;
  passed: number;
  failed: number;
  errored: number;
};

export type RunsTimeseries = {
  range: StatsRange;
  bucket: TimeseriesBucket;
  points: TimeseriesPoint[];
};

export type BreakdownRow = {
  /** Raw filter value for drill-down (enum value, code, or uuid). */
  key: string;
  /** Human label (suite/case title, or the key itself for scalar dims). */
  label: string;
  total: number;
  passed: number;
  failed: number;
  /** Pass rate over terminal runs in this group, 0..1; null if none. */
  passRate: number | null;
};

export type RunsBreakdown = {
  range: StatsRange;
  by: BreakdownDimension;
  rows: BreakdownRow[];
};

export const statsHeatmapQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(31).default(14),
  limit: z.coerce.number().int().min(1).max(20).default(10),
});

export type RunsHeatmap = {
  range: StatsRange;
  /** ISO date (day) per column, oldest first. */
  cols: string[];
  /** Top-N suites by failure count; cells align with cols. */
  rows: { suiteId: string; suiteName: string; cells: number[] }[];
};
