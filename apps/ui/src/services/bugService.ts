import type { Bug, Tag, BugComment, BugAttachment } from "@coglity/shared";
import { api } from "./api";

export interface BugWithDetails extends Omit<Bug, "comments" | "attachments"> {
  projectName?: string | null;
  tags?: Tag[];
  comments: BugComment[];
  attachments: BugAttachment[];
  createdByName: string | null;
  assignedToName: string | null;
}

export interface CreateBugPayload {
  title: string;
  description?: string;
  assignedTo?: string;
  bugType?: string;
  priority?: string;
  severity?: string;
  resolution?: string;
  state?: string;
  reproducibility?: string;
  tagIds?: string[];
}

export interface UpdateBugPayload {
  title?: string;
  description?: string;
  assignedTo?: string | null;
  bugType?: string;
  priority?: string;
  severity?: string;
  resolution?: string;
  state?: string;
  reproducibility?: string;
  tagIds?: string[];
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface BugListParams {
  search?: string;
  state?: string;
  priority?: string;
  severity?: string;
  bugType?: string;
  assignedTo?: string;
  sortBy?: string;
  sortDir?: string;
  page?: number;
  limit?: number;
}

export const bugService = {
  async getAll(orgId: string, projectIds: string[], params?: BugListParams): Promise<PaginatedResponse<BugWithDetails>> {
    if (!orgId || projectIds.length === 0) return { data: [], total: 0, page: 1, limit: params?.limit ?? 10 };
    const { data } = await api.get<PaginatedResponse<BugWithDetails>>(
      `/organizations/${orgId}/bugs`,
      { params: { ...params, projectIds: projectIds.join(",") } },
    );
    return data;
  },

  async getById(orgId: string, projectId: string, id: string): Promise<BugWithDetails> {
    const { data } = await api.get<BugWithDetails>(`/organizations/${orgId}/projects/${projectId}/bugs/${id}`);
    return data;
  },

  async create(orgId: string, projectId: string, payload: CreateBugPayload): Promise<BugWithDetails> {
    const { data } = await api.post<BugWithDetails>(`/organizations/${orgId}/projects/${projectId}/bugs`, payload);
    return data;
  },

  async update(orgId: string, projectId: string, id: string, payload: UpdateBugPayload): Promise<BugWithDetails> {
    const { data } = await api.put<BugWithDetails>(`/organizations/${orgId}/projects/${projectId}/bugs/${id}`, payload);
    return data;
  },

  async addComment(orgId: string, projectId: string, id: string, text: string): Promise<BugWithDetails> {
    const { data } = await api.post<BugWithDetails>(`/organizations/${orgId}/projects/${projectId}/bugs/${id}/comments`, { text });
    return data;
  },

  async remove(orgId: string, projectId: string, id: string): Promise<void> {
    await api.delete(`/organizations/${orgId}/projects/${projectId}/bugs/${id}`);
  },
};
