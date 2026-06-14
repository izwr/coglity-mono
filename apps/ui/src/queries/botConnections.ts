import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { botConnectionService, type BotConnectionListParams } from '../services/botConnectionService';
import { queryKeys } from '../lib/queryKeys';

export function useBotConnectionsPaginated(
  orgId: string,
  projectIds: string[],
  filters: BotConnectionListParams,
) {
  const query = useQuery({
    queryKey: queryKeys.botConnections.list(orgId, { projectIds, ...filters }),
    queryFn: () => botConnectionService.getAll(orgId, projectIds, filters),
    placeholderData: keepPreviousData,
    enabled: Boolean(orgId) && projectIds.length > 0,
  });

  const rows = query.data?.data ?? [];
  const total = query.data?.total ?? 0;

  return { ...query, rows, total };
}
