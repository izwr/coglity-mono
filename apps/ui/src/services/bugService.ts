import type { Bug, Tag, BugComment, BugAttachment } from "@coglity/shared";
import { api } from "./api";

export interface BugWithDetails extends Omit<Bug, "comments" | "attachments"> {
  tags: Tag[];
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
  tagId?: string;
  sortBy?: string;
  sortDir?: string;
  page?: number;
  limit?: number;
}

export const bugService = {
  async getAll(params?: BugListParams): Promise<PaginatedResponse<BugWithDetails>> {
    const { data } = await api.get<PaginatedResponse<BugWithDetails>>("/bugs", { params });
    return data;
  },

  async getById(id: string): Promise<BugWithDetails> {
    const { data } = await api.get<BugWithDetails>(`/bugs/${id}`);
    return data;
  },

  async create(payload: CreateBugPayload): Promise<BugWithDetails> {
    const { data } = await api.post<BugWithDetails>("/bugs", payload);
    return data;
  },

  async update(id: string, payload: UpdateBugPayload): Promise<BugWithDetails> {
    const { data } = await api.put<BugWithDetails>(`/bugs/${id}`, payload);
    return data;
  },

  async addComment(id: string, text: string): Promise<BugWithDetails> {
    const { data } = await api.post<BugWithDetails>(`/bugs/${id}/comments`, { text });
    return data;
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/bugs/${id}`);
  },
};