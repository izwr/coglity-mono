import type { TestCase, Tag } from "@coglity/shared";
import { api } from "./api";

export interface TestCaseWithTags extends TestCase {
  tags: Tag[];
  createdByName: string | null;
  updatedByName: string | null;
  testSuiteName: string;
  status: "draft" | "active";
}

export interface CreateTestCasePayload {
  testSuiteId: string;
  title: string;
  testSteps: string;
  data: string;
  expectedResults: string;
  tagIds?: string[];
}

export interface UpdateTestCasePayload {
  title: string;
  testSteps: string;
  data: string;
  expectedResults: string;
  tagIds?: string[];
  status?: "draft" | "active";
}

export const testCaseService = {
  async getAll(testSuiteId?: string): Promise<TestCaseWithTags[]> {
    const params = testSuiteId ? { testSuiteId } : {};
    const { data } = await api.get<TestCaseWithTags[]>("/test-cases", { params });
    return data;
  },

  async getById(id: string): Promise<TestCaseWithTags> {
    const { data } = await api.get<TestCaseWithTags>(`/test-cases/${id}`);
    return data;
  },

  async create(payload: CreateTestCasePayload): Promise<TestCaseWithTags> {
    const { data } = await api.post<TestCaseWithTags>("/test-cases", payload);
    return data;
  },

  async update(id: string, payload: UpdateTestCasePayload): Promise<TestCaseWithTags> {
    const { data } = await api.put<TestCaseWithTags>(`/test-cases/${id}`, payload);
    return data;
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/test-cases/${id}`);
  },
};