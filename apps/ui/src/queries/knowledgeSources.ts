import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { knowledgeSourceService, type KnowledgeSourceListParams } from '../services/knowledgeSourceService';
import { queryKeys } from '../lib/queryKeys';

export function useKnowledgeSourcesPaginated(
  orgId: string,
  projectIds: string[],
  filters: KnowledgeSourceListParams,
) {
  const query = useQuery({
    queryKey: queryKeys.knowledgeSources.list(orgId, { projectIds, ...filters }),
    queryFn: () => knowledgeSourceService.getAll(orgId, projectIds, filters),
    placeholderData: keepPreviousData,
    enabled: Boolean(orgId) && projectIds.length > 0,
  });

  const rows = query.data?.data ?? [];
  const total = query.data?.total ?? 0;

  return { ...query, rows, total };
}
