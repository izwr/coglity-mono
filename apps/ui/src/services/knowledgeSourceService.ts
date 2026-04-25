import type { KnowledgeSource } from "@coglity/shared";
import { api } from "./api";

export interface KnowledgeSourceWithUser extends KnowledgeSource {
  projectName?: string | null;
  createdByName: string | null;
  updatedByName: string | null;
}

export interface CreateKnowledgeSourcePayload {
  name: string;
  sourceType: "pdf" | "screen" | "figma" | "url";
  url: string;
  description: string;
  file?: File;
}

export type UpdateKnowledgeSourcePayload = CreateKnowledgeSourcePayload;

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface KnowledgeSourceListParams {
  search?: string;
  sourceType?: string;
  sortBy?: string;
  sortDir?: string;
  page?: number;
  limit?: number;
}

function buildFormData(payload: { name: string; sourceType: string; url: string; description: string; file?: File }): FormData {
  const formData = new FormData();
  if (payload.file) formData.append("file", payload.file);
  formData.append("name", payload.name);
  formData.append("sourceType", payload.sourceType);
  formData.append("url", payload.url);
  formData.append("description", payload.description);
  return formData;
}

export const knowledgeSourceService = {
  async getAll(orgId: string, projectIds: string[], params?: KnowledgeSourceListParams): Promise<PaginatedResponse<KnowledgeSourceWithUser>> {
    if (!orgId || projectIds.length === 0) return { data: [], total: 0, page: 1, limit: params?.limit ?? 10 };
    const { data } = await api.get<PaginatedResponse<KnowledgeSourceWithUser>>(
      `/organizations/${orgId}/knowledge-sources`,
      { params: { ...params, projectIds: projectIds.join(",") } },
    );
    return data;
  },

  async getById(orgId: string, projectId: string, id: string): Promise<KnowledgeSourceWithUser> {
    const { data } = await api.get<KnowledgeSourceWithUser>(`/organizations/${orgId}/projects/${projectId}/knowledge-sources/${id}`);
    return data;
  },

  async create(orgId: string, projectId: string, payload: CreateKnowledgeSourcePayload): Promise<KnowledgeSourceWithUser> {
    if (payload.file) {
      const { data } = await api.post<KnowledgeSourceWithUser>(
        `/organizations/${orgId}/projects/${projectId}/knowledge-sources`,
        buildFormData(payload),
        { headers: { "Content-Type": "multipart/form-data" } },
      );
      return data;
    }
    const { data } = await api.post<KnowledgeSourceWithUser>(
      `/organizations/${orgId}/projects/${projectId}/knowledge-sources`,
      payload,
    );
    return data;
  },

  async update(orgId: string, projectId: string, id: string, payload: UpdateKnowledgeSourcePayload): Promise<KnowledgeSourceWithUser> {
    if (payload.file) {
      const { data } = await api.put<KnowledgeSourceWithUser>(
        `/organizations/${orgId}/projects/${projectId}/knowledge-sources/${id}`,
        buildFormData(payload),
        { headers: { "Content-Type": "multipart/form-data" } },
      );
      return data;
    }
    const { data } = await api.put<KnowledgeSourceWithUser>(
      `/organizations/${orgId}/projects/${projectId}/knowledge-sources/${id}`,
      payload,
    );
    return data;
  },

  async remove(orgId: string, projectId: string, id: string): Promise<void> {
    await api.delete(`/organizations/${orgId}/projects/${projectId}/knowledge-sources/${id}`);
  },
};
