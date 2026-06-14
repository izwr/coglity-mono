import { useQuery } from '@tanstack/react-query';
import type { TimeseriesBucket, BreakdownDimension } from '@coglity/shared';
import { statsService, type StatsRunFilters } from '../services/statsService';
import { queryKeys } from '../lib/queryKeys';

const STATS_STALE_MS = 60_000;

export function useRunsOverview(orgId: string, projectIds: string[], filters: StatsRunFilters) {
  return useQuery({
    queryKey: queryKeys.stats.overview(orgId, { projectIds, ...filters }),
    queryFn: () => statsService.overview(orgId, projectIds, filters),
    staleTime: STATS_STALE_MS,
    enabled: Boolean(orgId) && projectIds.length > 0,
  });
}

export function useRunsTimeseries(
  orgId: string,
  projectIds: string[],
  bucket: TimeseriesBucket,
  filters: StatsRunFilters,
) {
  return useQuery({
    queryKey: queryKeys.stats.timeseries(orgId, { projectIds, bucket, ...filters }),
    queryFn: () => statsService.timeseries(orgId, projectIds, bucket, filters),
    staleTime: STATS_STALE_MS,
    enabled: Boolean(orgId) && projectIds.length > 0,
  });
}

export function useRunsHeatmap(
  orgId: string,
  projectIds: string[],
  params: { days?: number; limit?: number },
) {
  return useQuery({
    queryKey: queryKeys.stats.breakdown(orgId, { projectIds, kind: 'heatmap', ...params }),
    queryFn: () => statsService.heatmap(orgId, projectIds, params),
    staleTime: STATS_STALE_MS,
    enabled: Boolean(orgId) && projectIds.length > 0,
  });
}

export function useRunsBreakdown(
  orgId: string,
  projectIds: string[],
  by: BreakdownDimension,
  filters: StatsRunFilters & { limit?: number },
) {
  return useQuery({
    queryKey: queryKeys.stats.breakdown(orgId, { projectIds, by, ...filters }),
    queryFn: () => statsService.breakdown(orgId, projectIds, by, filters),
    staleTime: STATS_STALE_MS,
    enabled: Boolean(orgId) && projectIds.length > 0,
  });
}
