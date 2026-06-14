import { useInfiniteQuery, keepPreviousData } from '@tanstack/react-query';
import type { CountResult } from '@coglity/shared';
import {
  testRunService,
  type TestRunCursorParams,
  type TestRunListRow,
} from '../services/testRunService';
import { queryKeys } from '../lib/queryKeys';

export type TestRunFilters = Omit<TestRunCursorParams, 'cursor'>;

/**
 * Infinite cursor list of runs. `rows` flattens the loaded pages; the total
 * arrives with the first page only (estimated when large).
 */
export function useTestRunsInfinite(orgId: string, projectIds: string[], filters: TestRunFilters) {
  const query = useInfiniteQuery({
    queryKey: queryKeys.testRuns.list(orgId, { projectIds, ...filters }),
    queryFn: ({ pageParam }) =>
      testRunService.listCursor(orgId, projectIds, { ...filters, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    placeholderData: keepPreviousData,
    enabled: Boolean(orgId) && projectIds.length > 0,
  });

  const rows: TestRunListRow[] = query.data?.pages.flatMap((page) => page.data) ?? [];
  const totalCount: CountResult | null = query.data?.pages[0]?.totalCount ?? null;

  return { ...query, rows, totalCount };
}
