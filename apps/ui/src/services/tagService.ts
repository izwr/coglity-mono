import type { Tag } from "@coglity/shared";
import { api } from "./api";

export interface TagWithUsers extends Tag {
  projectName: string | null;
  createdByName: string | null;
  updatedByName: string | null;
}

export interface CreateTagPayload {
  name: string;
  description: string;
}

export type UpdateTagPayload = CreateTagPayload;

export const tagService = {
  async getAll(orgId: string, projectIds: string[]): Promise<TagWithUsers[]> {
    if (!orgId || projectIds.length === 0) return [];
    const { data } = await api.get<TagWithUsers[]>(`/organizations/${orgId}/tags`, {
      params: { projectIds: projectIds.join(",") },
    });
    return data;
  },

  async getById(orgId: string, projectId: string, id: string): Promise<TagWithUsers> {
    const { data } = await api.get<TagWithUsers>(`/organizations/${orgId}/projects/${projectId}/tags/${id}`);
    return data;
  },

  async create(orgId: string, projectId: string, payload: CreateTagPayload): Promise<TagWithUsers> {
    const { data } = await api.post<TagWithUsers>(`/organizations/${orgId}/projects/${projectId}/tags`, payload);
    return data;
  },

  async update(orgId: string, projectId: string, id: string, payload: UpdateTagPayload): Promise<TagWithUsers> {
    const { data } = await api.put<TagWithUsers>(`/organizations/${orgId}/projects/${projectId}/tags/${id}`, payload);
    return data;
  },

  async remove(orgId: string, projectId: string, id: string): Promise<void> {
    await api.delete(`/organizations/${orgId}/projects/${projectId}/tags/${id}`);
  },
};
