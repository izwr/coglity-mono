import type { TestCase, Tag, CursorPage } from '@coglity/shared';
import { api } from './api';

export interface TestCaseWithTags extends TestCase {
  projectName?: string | null;
  tags?: Tag[];
  createdByName: string | null;
  updatedByName: string | null;
  testSuiteName: string;
  status: 'draft' | 'active';
  testCaseType: 'web' | 'mobile' | 'chat' | 'voice' | 'agent';
  botConnectionId: string | null;
  botConnectionName?: string | null;
}

export interface CreateTestCasePayload {
  testSuiteId: string;
  title: string;
  preCondition: string;
  testSteps: string;
  data: string;
  expectedResults: string;
  tagIds?: string[];
  testCaseType?: 'web' | 'mobile' | 'chat' | 'voice' | 'agent';
  botConnectionId?: string | null;
}

export interface UpdateTestCasePayload {
  title: string;
  preCondition: string;
  testSteps: string;
  data: string;
  expectedResults: string;
  tagIds?: string[];
  status?: 'draft' | 'active';
  testCaseType?: 'web' | 'mobile' | 'chat' | 'voice' | 'agent';
  botConnectionId?: string | null;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface TestCaseListParams {
  search?: string;
  testSuiteId?: string;
  tagId?: string;
  status?: string;
  sortBy?: string;
  sortDir?: string;
  page?: number;
  limit?: number;
}

/** Row shape of the org-level cursor list (dates arrive as ISO strings). */
export interface TestCaseListRow {
  id: string;
  projectId: string;
  projectName: string;
  testSuiteId: string;
  testSuiteName: string;
  title: string;
  status: 'draft' | 'active';
  testCaseType: 'web' | 'mobile' | 'chat' | 'voice' | 'agent';
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
  createdByName: string | null;
  updatedByName: string | null;
}

export interface TestCaseCursorParams {
  search?: string;
  testSuiteId?: string;
  tagId?: string;
  status?: string;
  testCaseType?: string;
  sortBy?: 'createdAt' | 'updatedAt' | 'title';
  sortDir?: 'asc' | 'desc';
  cursor?: string;
  limit?: number;
}

export const testCaseService = {
  async getAll(
    orgId: string,
    projectIds: string[],
    params?: TestCaseListParams,
  ): Promise<PaginatedResponse<TestCaseWithTags>> {
    if (!orgId || projectIds.length === 0)
      return { data: [], total: 0, page: 1, limit: params?.limit ?? 10 };
    const { data } = await api.get<PaginatedResponse<TestCaseWithTags>>(
      `/organizations/${orgId}/test-cases`,
      { params: { ...params, projectIds: projectIds.join(',') } },
    );
    return data;
  },

  async listCursor(
    orgId: string,
    projectIds: string[],
    params?: TestCaseCursorParams,
  ): Promise<CursorPage<TestCaseListRow>> {
    if (!orgId || projectIds.length === 0)
      return { data: [], nextCursor: null, totalCount: { value: 0, isEstimate: false } };
    const { data } = await api.get<CursorPage<TestCaseListRow>>(
      `/organizations/${orgId}/test-cases`,
      { params: { ...params, projectIds: projectIds.join(',') } },
    );
    return data;
  },

  async getById(orgId: string, projectId: string, id: string): Promise<TestCaseWithTags> {
    const { data } = await api.get<TestCaseWithTags>(
      `/organizations/${orgId}/projects/${projectId}/test-cases/${id}`,
    );
    return data;
  },

  async create(
    orgId: string,
    projectId: string,
    payload: CreateTestCasePayload,
  ): Promise<TestCaseWithTags> {
    const { data } = await api.post<TestCaseWithTags>(
      `/organizations/${orgId}/projects/${projectId}/test-cases`,
      payload,
    );
    return data;
  },

  async update(
    orgId: string,
    projectId: string,
    id: string,
    payload: UpdateTestCasePayload,
  ): Promise<TestCaseWithTags> {
    const { data } = await api.put<TestCaseWithTags>(
      `/organizations/${orgId}/projects/${projectId}/test-cases/${id}`,
      payload,
    );
    return data;
  },

  async remove(orgId: string, projectId: string, id: string): Promise<void> {
    await api.delete(`/organizations/${orgId}/projects/${projectId}/test-cases/${id}`);
  },
};
