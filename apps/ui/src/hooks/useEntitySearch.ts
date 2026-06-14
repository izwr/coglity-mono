import { useEffect, useState } from 'react';
import { testCaseService, type TestCaseWithTags } from '../services/testCaseService';
import { testSuiteService, type TestSuiteWithTags } from '../services/testSuiteService';
import { bugService, type BugWithDetails } from '../services/bugService';
import { useSelectedProjectIds } from '../components/ProjectFilter';
import { useCurrentOrg } from '../context/OrgContext';

export interface EntitySearchResults {
  cases: TestCaseWithTags[];
  suites: TestSuiteWithTags[];
  bugs: BugWithDetails[];
  loading: boolean;
}

const EMPTY: Omit<EntitySearchResults, 'loading'> = { cases: [], suites: [], bugs: [] };

/**
 * Debounced cross-entity search (cases, suites, bugs) scoped to the current
 * project selection — shared by the Search page and the command palette.
 */
export function useEntitySearch(
  q: string,
  opts?: { limit?: number; debounceMs?: number },
): EntitySearchResults {
  const limit = opts?.limit ?? 8;
  const debounceMs = opts?.debounceMs ?? 250;
  const { org } = useCurrentOrg();
  const projectIds = useSelectedProjectIds();
  const effectiveProjectIds =
    projectIds.length > 0 ? projectIds : (org?.projects ?? []).map((p) => p.projectId);
  // Stable primitive key: the array identity changes every render, and using
  // it directly re-runs the effect forever (see Search page history).
  const effectiveProjectIdsKey = effectiveProjectIds.join(',');
  const orgId = org?.organizationId;

  const [results, setResults] = useState(EMPTY);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (q.length < 2 || !orgId || effectiveProjectIdsKey.length === 0) {
      setResults(EMPTY);
      setLoading(false);
      return;
    }
    const ids = effectiveProjectIdsKey.split(',');
    let active = true;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const [cases, suites, bugs] = await Promise.all([
          testCaseService
            .getAll(orgId, ids, { search: q, limit, page: 1 })
            .then((r) => r.data)
            .catch(() => []),
          testSuiteService
            .getAll(orgId, ids, { search: q, limit, page: 1 })
            .then((r) => r.data)
            .catch(() => []),
          bugService
            .getAll(orgId, ids, { search: q, limit, page: 1 })
            .then((r) => r.data)
            .catch(() => []),
        ]);
        if (!active) return;
        setResults({ cases, suites, bugs });
      } finally {
        if (active) setLoading(false);
      }
    }, debounceMs);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [q, orgId, effectiveProjectIdsKey, limit, debounceMs]);

  return { ...results, loading };
}
