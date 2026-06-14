import type { TestRun, TestRunProperties, CursorPage } from '@coglity/shared';
import { api } from './api';

export interface TestRunWithUser extends TestRun {
  createdByName: string | null;
  testCaseTitle?: string | null;
}

/**
 * Row shape of cursor lists: no transcript/recordingBlobName (lists never
 * ship them at scale) and dates arrive as ISO strings over the wire.
 */
export interface TestRunListRow {
  id: string;
  projectId: string;
  testCaseId: string;
  botConnectionId: string | null;
  state: 'queued' | 'running' | 'passed' | 'failed' | 'errored' | 'cancelled';
  verdict: string;
  error: string;
  recordingUrl: string;
  recordingDurationMs: number;
  properties: TestRunProperties;
  language: string;
  environment: string;
  batchId: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdBy: string | null;
  createdAt: string;
  createdByName: string | null;
  testCaseTitle: string | null;
}

export interface TestRunCursorParams {
  state?: string;
  testCaseId?: string;
  testSuiteId?: string;
  batchId?: string;
  environment?: string;
  language?: string;
  from?: string;
  to?: string;
  sortDir?: 'asc' | 'desc';
  cursor?: string;
  limit?: number;
}

export const testRunService = {
  async listByTestCase(
    orgId: string,
    projectId: string,
    testCaseId: string,
  ): Promise<TestRunWithUser[]> {
    const { data } = await api.get<{ data: TestRunWithUser[] }>(
      `/organizations/${orgId}/projects/${projectId}/test-runs`,
      { params: { testCaseId } },
    );
    return data.data;
  },

  async getById(orgId: string, projectId: string, runId: string): Promise<TestRunWithUser> {
    const { data } = await api.get<TestRunWithUser>(
      `/organizations/${orgId}/projects/${projectId}/test-runs/${runId}`,
    );
    return data;
  },

  async create(orgId: string, projectId: string, testCaseId: string): Promise<TestRunWithUser> {
    const { data } = await api.post<{ data: TestRunWithUser[]; batchId: string | null }>(
      `/organizations/${orgId}/projects/${projectId}/test-runs`,
      { testCaseId },
    );
    return data.data[0];
  },

  async createBatch(
    orgId: string,
    projectId: string,
    testCaseId: string,
    config: {
      languages?: string[];
      environments?: string[];
      crossProduct?: boolean;
      combinations?: Array<{ language: string; environment: string }>;
    },
  ): Promise<{ data: TestRunWithUser[]; batchId: string | null }> {
    const { data } = await api.post<{ data: TestRunWithUser[]; batchId: string | null }>(
      `/organizations/${orgId}/projects/${projectId}/test-runs`,
      { testCaseId, ...config },
    );
    return data;
  },

  async listByBatch(orgId: string, projectId: string, batchId: string): Promise<TestRunWithUser[]> {
    const { data } = await api.get<{ data: TestRunWithUser[] }>(
      `/organizations/${orgId}/projects/${projectId}/test-runs`,
      { params: { batchId } },
    );
    return data.data;
  },

  async listAll(
    orgId: string,
    projectIds: string[],
    params?: { state?: string; limit?: number; page?: number },
  ): Promise<{ data: TestRunWithUser[]; total: number }> {
    if (!orgId || projectIds.length === 0) return { data: [], total: 0 };
    const { data } = await api.get<{ data: TestRunWithUser[]; total: number }>(
      `/organizations/${orgId}/test-runs`,
      { params: { ...params, projectIds: projectIds.join(',') } },
    );
    return data;
  },

  async listCursor(
    orgId: string,
    projectIds: string[],
    params?: TestRunCursorParams,
  ): Promise<CursorPage<TestRunListRow>> {
    if (!orgId || projectIds.length === 0)
      return { data: [], nextCursor: null, totalCount: { value: 0, isEstimate: false } };
    const { data } = await api.get<CursorPage<TestRunListRow>>(
      `/organizations/${orgId}/test-runs`,
      { params: { ...params, projectIds: projectIds.join(',') } },
    );
    return data;
  },

  downloadRecordingUrl(orgId: string, projectId: string, runId: string): string {
    return `/api/organizations/${orgId}/projects/${projectId}/test-runs/${runId}/download`;
  },

  downloadTranscriptUrl(orgId: string, projectId: string, runId: string): string {
    return `/api/organizations/${orgId}/projects/${projectId}/test-runs/${runId}/transcript`;
  },
};
