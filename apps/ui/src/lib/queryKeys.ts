/**
 * Query key factory. Keys are org-scoped with a params object last so
 * invalidation can target any prefix: ['orgs', orgId, 'test-runs'] wipes all
 * run lists and details for the org. `projectIds` are sorted so equivalent
 * selections share a cache entry regardless of selection order.
 */

type Params = Record<string, unknown> | undefined;

function normalize(params: Params): Record<string, unknown> {
  if (!params) return {};
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(params).sort()) {
    const value = params[key];
    if (value === undefined || value === '' || value === null) continue;
    out[key] = key === 'projectIds' && Array.isArray(value) ? [...value].sort() : value;
  }
  return out;
}

export const queryKeys = {
  testRuns: {
    all: (orgId: string) => ['orgs', orgId, 'test-runs'] as const,
    list: (orgId: string, params: Params) =>
      ['orgs', orgId, 'test-runs', 'list', normalize(params)] as const,
    detail: (orgId: string, projectId: string, id: string) =>
      ['orgs', orgId, 'test-runs', 'detail', projectId, id] as const,
  },
  testCases: {
    all: (orgId: string) => ['orgs', orgId, 'test-cases'] as const,
    list: (orgId: string, params: Params) =>
      ['orgs', orgId, 'test-cases', 'list', normalize(params)] as const,
  },
  bugs: {
    all: (orgId: string) => ['orgs', orgId, 'bugs'] as const,
    list: (orgId: string, params: Params) =>
      ['orgs', orgId, 'bugs', 'list', normalize(params)] as const,
  },
  testSuites: {
    all: (orgId: string) => ['orgs', orgId, 'test-suites'] as const,
    list: (orgId: string, params: Params) =>
      ['orgs', orgId, 'test-suites', 'list', normalize(params)] as const,
  },
  scheduledTestSuites: {
    all: (orgId: string) => ['orgs', orgId, 'scheduled-test-suites'] as const,
    list: (orgId: string, params: Params) =>
      ['orgs', orgId, 'scheduled-test-suites', 'list', normalize(params)] as const,
  },
  botConnections: {
    all: (orgId: string) => ['orgs', orgId, 'bot-connections'] as const,
    list: (orgId: string, params: Params) =>
      ['orgs', orgId, 'bot-connections', 'list', normalize(params)] as const,
  },
  knowledgeSources: {
    all: (orgId: string) => ['orgs', orgId, 'knowledge-sources'] as const,
    list: (orgId: string, params: Params) =>
      ['orgs', orgId, 'knowledge-sources', 'list', normalize(params)] as const,
  },
  stats: {
    all: (orgId: string) => ['orgs', orgId, 'stats'] as const,
    overview: (orgId: string, params: Params) =>
      ['orgs', orgId, 'stats', 'runs-overview', normalize(params)] as const,
    timeseries: (orgId: string, params: Params) =>
      ['orgs', orgId, 'stats', 'runs-timeseries', normalize(params)] as const,
    breakdown: (orgId: string, params: Params) =>
      ['orgs', orgId, 'stats', 'runs-breakdown', normalize(params)] as const,
  },
  tags: {
    list: (orgId: string, params: Params) => ['orgs', orgId, 'tags', normalize(params)] as const,
  },
};
