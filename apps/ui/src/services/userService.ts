import { api } from "./api";

export interface UserOption {
  id: string;
  displayName: string;
  email: string;
}

export const userService = {
  async getAll(): Promise<UserOption[]> {
    const { data } = await api.get<UserOption[]>("/users");
    return data;
  },
};