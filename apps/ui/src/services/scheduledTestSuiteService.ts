import { api } from "./api";

export interface ScheduledTestSuiteListItem {
  id: string;
  projectId: string;
  projectName: string | null;
  testSuiteId: string;
  testSuiteName: string | null;
  startDate: string;
  endDate: string;
  createdBy: string | null;
  createdByName: string | null;
  createdAt: string;
  updatedAt: string;
  caseCount: number;
  passedCount: number;
  failedCount: number;
}

export interface ScheduledTestCaseDTO {
  id: string;
  scheduledTestSuiteId: string;
  testCaseId: string;
  assignedTo: string | null;
  assignedToName: string | null;
  actualResults: string;
  state: "not_started" | "in_progress" | "passed" | "failed" | "blocked" | "skipped";
  linkedBugIds: string[];
  linkedBugs: { id: string; title: string }[];
  createdAt: string;
  updatedAt: string;
  title: string | null;
  preCondition: string | null;
  testSteps: string | null;
  data: string | null;
  expectedResults: string | null;
  testCaseStatus: string | null;
}

export interface ScheduledTestCaseDetailDTO extends ScheduledTestCaseDTO {
  testSuiteName: string | null;
  startDate: string | null;
  endDate: string | null;
}

export interface ScheduledTestSuiteDetail extends ScheduledTestSuiteListItem {
  scheduledCases: ScheduledTestCaseDTO[];
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface CreateScheduledTestSuitePayload {
  testSuiteId: string;
  startDate: string;
  endDate: string;
}

export interface UpdateScheduledTestCasePayload {
  assignedTo?: string | null;
  actualResults?: string;
  state?: string;
  linkedBugIds?: string[];
}

export const scheduledTestSuiteService = {
  async getAll(
    orgId: string,
    projectIds: string[],
    params?: { page?: number; limit?: number; sortBy?: string; sortDir?: string },
  ): Promise<PaginatedResponse<ScheduledTestSuiteListItem>> {
    if (!orgId || projectIds.length === 0) return { data: [], total: 0, page: 1, limit: params?.limit ?? 10 };
    const { data } = await api.get<PaginatedResponse<ScheduledTestSuiteListItem>>(
      `/organizations/${orgId}/scheduled-test-suites`,
      { params: { ...params, projectIds: projectIds.join(",") } },
    );
    return data;
  },

  async getById(orgId: string, projectId: string, id: string): Promise<ScheduledTestSuiteDetail> {
    const { data } = await api.get<ScheduledTestSuiteDetail>(
      `/organizations/${orgId}/projects/${projectId}/scheduled-test-suites/${id}`,
    );
    return data;
  },

  async create(orgId: string, projectId: string, payload: CreateScheduledTestSuitePayload): Promise<ScheduledTestSuiteListItem> {
    const { data } = await api.post<ScheduledTestSuiteListItem>(
      `/organizations/${orgId}/projects/${projectId}/scheduled-test-suites`,
      payload,
    );
    return data;
  },

  async update(
    orgId: string,
    projectId: string,
    id: string,
    payload: Partial<CreateScheduledTestSuitePayload>,
  ): Promise<ScheduledTestSuiteListItem> {
    const { data } = await api.put<ScheduledTestSuiteListItem>(
      `/organizations/${orgId}/projects/${projectId}/scheduled-test-suites/${id}`,
      payload,
    );
    return data;
  },

  async getCase(
    orgId: string,
    projectId: string,
    suiteId: string,
    caseId: string,
  ): Promise<ScheduledTestCaseDetailDTO> {
    const { data } = await api.get<ScheduledTestCaseDetailDTO>(
      `/organizations/${orgId}/projects/${projectId}/scheduled-test-suites/${suiteId}/cases/${caseId}`,
    );
    return data;
  },

  async updateCase(
    orgId: string,
    projectId: string,
    suiteId: string,
    caseId: string,
    payload: UpdateScheduledTestCasePayload,
  ): Promise<ScheduledTestCaseDTO> {
    const { data } = await api.put<ScheduledTestCaseDTO>(
      `/organizations/${orgId}/projects/${projectId}/scheduled-test-suites/${suiteId}/cases/${caseId}`,
      payload,
    );
    return data;
  },

  async remove(orgId: string, projectId: string, id: string): Promise<void> {
    await api.delete(`/organizations/${orgId}/projects/${projectId}/scheduled-test-suites/${id}`);
  },
};
