import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { bugService, type BugListParams } from '../services/bugService';
import { queryKeys } from '../lib/queryKeys';

export function useBugsPaginated(
  orgId: string,
  projectIds: string[],
  filters: BugListParams,
) {
  const query = useQuery({
    queryKey: queryKeys.bugs.list(orgId, { projectIds, ...filters }),
    queryFn: () => bugService.getAll(orgId, projectIds, filters),
    placeholderData: keepPreviousData,
    enabled: Boolean(orgId) && projectIds.length > 0,
  });

  const rows = query.data?.data ?? [];
  const total = query.data?.total ?? 0;

  return { ...query, rows, total };
}
