import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { scheduledTestSuiteService } from '../services/scheduledTestSuiteService';
import { queryKeys } from '../lib/queryKeys';

export function useScheduledTestSuitesPaginated(
  orgId: string,
  projectIds: string[],
  filters: any,
) {
  const query = useQuery({
    queryKey: queryKeys.scheduledTestSuites.list(orgId, { projectIds, ...filters }),
    queryFn: () => scheduledTestSuiteService.getAll(orgId, projectIds, filters),
    placeholderData: keepPreviousData,
    enabled: Boolean(orgId) && projectIds.length > 0,
  });

  const rows = query.data?.data ?? [];
  const total = query.data?.total ?? 0;

  return { ...query, rows, total };
}
