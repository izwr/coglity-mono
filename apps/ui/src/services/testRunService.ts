import type { TestRun } from "@coglity/shared";
import { api } from "./api";

export interface TestRunWithUser extends TestRun {
  createdByName: string | null;
  testCaseTitle?: string | null;
}

export const testRunService = {
  async listByTestCase(orgId: string, projectId: string, testCaseId: string): Promise<TestRunWithUser[]> {
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
    const { data } = await api.post<TestRunWithUser>(
      `/organizations/${orgId}/projects/${projectId}/test-runs`,
      { testCaseId },
    );
    return data;
  },

  async listAll(
    orgId: string,
    projectIds: string[],
    params?: { state?: string; limit?: number; page?: number },
  ): Promise<{ data: TestRunWithUser[]; total: number }> {
    if (!orgId || projectIds.length === 0) return { data: [], total: 0 };
    const { data } = await api.get<{ data: TestRunWithUser[]; total: number }>(
      `/organizations/${orgId}/test-runs`,
      { params: { ...params, projectIds: projectIds.join(",") } },
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
