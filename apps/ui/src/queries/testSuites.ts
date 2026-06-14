import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { testSuiteService, type TestSuiteListParams } from '../services/testSuiteService';
import { queryKeys } from '../lib/queryKeys';

export function useTestSuitesPaginated(
  orgId: string,
  projectIds: string[],
  filters: TestSuiteListParams,
) {
  const query = useQuery({
    queryKey: queryKeys.testSuites.list(orgId, { projectIds, ...filters }),
    queryFn: () => testSuiteService.getAll(orgId, projectIds, filters),
    placeholderData: keepPreviousData,
    enabled: Boolean(orgId) && projectIds.length > 0,
  });

  const rows = query.data?.data ?? [];
  const total = query.data?.total ?? 0;

  return { ...query, rows, total };
}
