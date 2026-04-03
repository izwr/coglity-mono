import { api } from "./api";

export interface ScheduledTestSuiteListItem {
  id: string;
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

// Flat merged DTO: scheduled test case fields + test case fields at top level
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
  // Merged from test case
  title: string | null;
  preCondition: string | null;
  testSteps: string | null;
  data: string | null;
  expectedResults: string | null;
  testCaseStatus: string | null;
}

// Single case GET also includes suite context
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
  async getAll(params?: { page?: number; limit?: number; sortBy?: string; sortDir?: string }): Promise<PaginatedResponse<ScheduledTestSuiteListItem>> {
    const { data } = await api.get<PaginatedResponse<ScheduledTestSuiteListItem>>("/scheduled-test-suites", { params });
    return data;
  },

  async getById(id: string): Promise<ScheduledTestSuiteDetail> {
    const { data } = await api.get<ScheduledTestSuiteDetail>(`/scheduled-test-suites/${id}`);
    return data;
  },

  async create(payload: CreateScheduledTestSuitePayload): Promise<ScheduledTestSuiteListItem> {
    const { data } = await api.post<ScheduledTestSuiteListItem>("/scheduled-test-suites", payload);
    return data;
  },

  async update(id: string, payload: Partial<CreateScheduledTestSuitePayload>): Promise<ScheduledTestSuiteListItem> {
    const { data } = await api.put<ScheduledTestSuiteListItem>(`/scheduled-test-suites/${id}`, payload);
    return data;
  },

  async getCase(suiteId: string, caseId: string): Promise<ScheduledTestCaseDetailDTO> {
    const { data } = await api.get<ScheduledTestCaseDetailDTO>(`/scheduled-test-suites/${suiteId}/cases/${caseId}`);
    return data;
  },

  async updateCase(suiteId: string, caseId: string, payload: UpdateScheduledTestCasePayload): Promise<ScheduledTestCaseDTO> {
    const { data } = await api.put<ScheduledTestCaseDTO>(`/scheduled-test-suites/${suiteId}/cases/${caseId}`, payload);
    return data;
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/scheduled-test-suites/${id}`);
  },
};