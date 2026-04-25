import type { TestSuite, Tag } from "@coglity/shared";
import { api } from "./api";

export interface TestSuiteWithTags extends TestSuite {
  projectName: string | null;
  tags?: Tag[];
  createdByName: string | null;
  updatedByName: string | null;
}

export interface CreateTestSuitePayload {
  name: string;
  description: string;
  tagIds?: string[];
}

export type UpdateTestSuitePayload = CreateTestSuitePayload;

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface ListQueryParams {
  search?: string;
  sortBy?: string;
  sortDir?: string;
  page?: number;
  limit?: number;
}

export const testSuiteService = {
  async getAll(orgId: string, projectIds: string[], params?: ListQueryParams): Promise<PaginatedResponse<TestSuiteWithTags>> {
    if (!orgId || projectIds.length === 0) return { data: [], total: 0, page: 1, limit: params?.limit ?? 10 };
    const { data } = await api.get<PaginatedResponse<TestSuiteWithTags>>(
      `/organizations/${orgId}/test-suites`,
      { params: { ...params, projectIds: projectIds.join(",") } },
    );
    return data;
  },

  async getById(orgId: string, projectId: string, id: string): Promise<TestSuiteWithTags> {
    const { data } = await api.get<TestSuiteWithTags>(`/organizations/${orgId}/projects/${projectId}/test-suites/${id}`);
    return data;
  },

  async create(orgId: string, projectId: string, payload: CreateTestSuitePayload): Promise<TestSuiteWithTags> {
    const { data } = await api.post<TestSuiteWithTags>(`/organizations/${orgId}/projects/${projectId}/test-suites`, payload);
    return data;
  },

  async update(orgId: string, projectId: string, id: string, payload: UpdateTestSuitePayload): Promise<TestSuiteWithTags> {
    const { data } = await api.put<TestSuiteWithTags>(`/organizations/${orgId}/projects/${projectId}/test-suites/${id}`, payload);
    return data;
  },

  async remove(orgId: string, projectId: string, id: string): Promise<void> {
    await api.delete(`/organizations/${orgId}/projects/${projectId}/test-suites/${id}`);
  },
};
