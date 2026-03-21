import type { Tag } from "@coglity/shared";
import { api } from "./api";

export interface TagWithUsers extends Tag {
  createdByName: string | null;
  updatedByName: string | null;
}

export interface CreateTagPayload {
  name: string;
  description: string;
}

export type UpdateTagPayload = CreateTagPayload;

export const tagService = {
  async getAll(): Promise<TagWithUsers[]> {
    const { data } = await api.get<TagWithUsers[]>("/tags");
    return data;
  },

  async getById(id: string): Promise<TagWithUsers> {
    const { data } = await api.get<TagWithUsers>(`/tags/${id}`);
    return data;
  },

  async create(payload: CreateTagPayload): Promise<TagWithUsers> {
    const { data } = await api.post<TagWithUsers>("/tags", payload);
    return data;
  },

  async update(id: string, payload: UpdateTagPayload): Promise<TagWithUsers> {
    const { data } = await api.put<TagWithUsers>(`/tags/${id}`, payload);
    return data;
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/tags/${id}`);
  },
};