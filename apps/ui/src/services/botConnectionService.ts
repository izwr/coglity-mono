import type { BotConnection } from "@coglity/shared";
import { api } from "./api";

export interface BotConnectionWithUser extends BotConnection {
  projectName?: string | null;
  createdByName: string | null;
  updatedByName: string | null;
}

export interface CreateBotConnectionPayload {
  name: string;
  botType: "voice" | "chat";
  provider: "dialin" | "websocket" | "http";
  config: Record<string, unknown>;
  description: string;
}

export type UpdateBotConnectionPayload = CreateBotConnectionPayload;

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface BotConnectionListParams {
  search?: string;
  botType?: string;
  sortBy?: string;
  sortDir?: string;
  page?: number;
  limit?: number;
}

export const botConnectionService = {
  async getAll(orgId: string, projectIds: string[], params?: BotConnectionListParams): Promise<PaginatedResponse<BotConnectionWithUser>> {
    if (!orgId || projectIds.length === 0) return { data: [], total: 0, page: 1, limit: params?.limit ?? 10 };
    const { data } = await api.get<PaginatedResponse<BotConnectionWithUser>>(
      `/organizations/${orgId}/bot-connections`,
      { params: { ...params, projectIds: projectIds.join(",") } },
    );
    return data;
  },

  async getById(orgId: string, projectId: string, id: string): Promise<BotConnectionWithUser> {
    const { data } = await api.get<BotConnectionWithUser>(`/organizations/${orgId}/projects/${projectId}/bot-connections/${id}`);
    return data;
  },

  async create(orgId: string, projectId: string, payload: CreateBotConnectionPayload): Promise<BotConnectionWithUser> {
    const { data } = await api.post<BotConnectionWithUser>(`/organizations/${orgId}/projects/${projectId}/bot-connections`, payload);
    return data;
  },

  async update(orgId: string, projectId: string, id: string, payload: UpdateBotConnectionPayload): Promise<BotConnectionWithUser> {
    const { data } = await api.put<BotConnectionWithUser>(`/organizations/${orgId}/projects/${projectId}/bot-connections/${id}`, payload);
    return data;
  },

  async remove(orgId: string, projectId: string, id: string): Promise<void> {
    await api.delete(`/organizations/${orgId}/projects/${projectId}/bot-connections/${id}`);
  },
};
