import type { TestSuite, Tag } from "@coglity/shared";
import { api } from "./api";

export interface TestSuiteWithTags extends TestSuite {
  tags: Tag[];
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
  tagId?: string;
  sortBy?: string;
  sortDir?: string;
  page?: number;
  limit?: number;
}

export const testSuiteService = {
  async getAll(params?: ListQueryParams): Promise<PaginatedResponse<TestSuiteWithTags>> {
    const { data } = await api.get<PaginatedResponse<TestSuiteWithTags>>("/test-suites", { params });
    return data;
  },

  async getById(id: string): Promise<TestSuiteWithTags> {
    const { data } = await api.get<TestSuiteWithTags>(`/test-suites/${id}`);
    return data;
  },

  async create(payload: CreateTestSuitePayload): Promise<TestSuiteWithTags> {
    const { data } = await api.post<TestSuiteWithTags>("/test-suites", payload);
    return data;
  },

  async update(id: string, payload: UpdateTestSuitePayload): Promise<TestSuiteWithTags> {
    const { data } = await api.put<TestSuiteWithTags>(`/test-suites/${id}`, payload);
    return data;
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/test-suites/${id}`);
  },
};