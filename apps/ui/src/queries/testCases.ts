import { useInfiniteQuery, keepPreviousData } from '@tanstack/react-query';
import type { CountResult } from '@coglity/shared';
import {
  testCaseService,
  type TestCaseCursorParams,
  type TestCaseListRow,
} from '../services/testCaseService';
import { queryKeys } from '../lib/queryKeys';

export type TestCaseFilters = Omit<TestCaseCursorParams, 'cursor'>;

export function useTestCasesInfinite(
  orgId: string,
  projectIds: string[],
  filters: TestCaseFilters,
) {
  const query = useInfiniteQuery({
    queryKey: queryKeys.testCases.list(orgId, { projectIds, ...filters }),
    queryFn: ({ pageParam }) =>
      testCaseService.listCursor(orgId, projectIds, { ...filters, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    placeholderData: keepPreviousData,
    enabled: Boolean(orgId) && projectIds.length > 0,
  });

  const rows: TestCaseListRow[] = query.data?.pages.flatMap((page) => page.data) ?? [];
  const totalCount: CountResult | null = query.data?.pages[0]?.totalCount ?? null;

  return { ...query, rows, totalCount };
}
