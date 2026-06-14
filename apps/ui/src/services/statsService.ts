import type {
  RunsOverview,
  RunsTimeseries,
  RunsBreakdown,
  RunsHeatmap,
  TimeseriesBucket,
  BreakdownDimension,
} from '@coglity/shared';
import { api } from './api';

export interface StatsRunFilters {
  from?: string;
  to?: string;
  state?: string;
  environment?: string;
  language?: string;
  testCaseId?: string;
  testSuiteId?: string;
}

function withScope(projectIds: string[], params?: object) {
  return { ...params, projectIds: projectIds.join(',') };
}

const EMPTY_RANGE = { from: '', to: '' };

export const statsService = {
  async overview(
    orgId: string,
    projectIds: string[],
    filters?: StatsRunFilters,
  ): Promise<RunsOverview> {
    if (!orgId || projectIds.length === 0) {
      return {
        range: EMPTY_RANGE,
        total: { value: 0, isEstimate: false },
        byState: { queued: 0, running: 0, passed: 0, failed: 0, errored: 0, cancelled: 0 },
        passRate: null,
        avgDurationMs: null,
      };
    }
    const { data } = await api.get<RunsOverview>(`/organizations/${orgId}/stats/runs/overview`, {
      params: withScope(projectIds, filters),
    });
    return data;
  },

  async timeseries(
    orgId: string,
    projectIds: string[],
    bucket: TimeseriesBucket,
    filters?: StatsRunFilters,
  ): Promise<RunsTimeseries> {
    if (!orgId || projectIds.length === 0) return { range: EMPTY_RANGE, bucket, points: [] };
    const { data } = await api.get<RunsTimeseries>(
      `/organizations/${orgId}/stats/runs/timeseries`,
      { params: withScope(projectIds, { ...filters, bucket }) },
    );
    return data;
  },

  async heatmap(
    orgId: string,
    projectIds: string[],
    params?: { days?: number; limit?: number },
  ): Promise<RunsHeatmap> {
    if (!orgId || projectIds.length === 0) return { range: EMPTY_RANGE, cols: [], rows: [] };
    const { data } = await api.get<RunsHeatmap>(`/organizations/${orgId}/stats/runs/heatmap`, {
      params: withScope(projectIds, params),
    });
    return data;
  },

  async breakdown(
    orgId: string,
    projectIds: string[],
    by: BreakdownDimension,
    filters?: StatsRunFilters & { limit?: number },
  ): Promise<RunsBreakdown> {
    if (!orgId || projectIds.length === 0) return { range: EMPTY_RANGE, by, rows: [] };
    const { data } = await api.get<RunsBreakdown>(`/organizations/${orgId}/stats/runs/breakdown`, {
      params: withScope(projectIds, { ...filters, by }),
    });
    return data;
  },
};
