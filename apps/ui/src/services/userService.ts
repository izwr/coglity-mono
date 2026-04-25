import { api } from "./api";

export interface UserOption {
  id: string;
  displayName: string;
  email: string;
}

export const userService = {
  /**
   * Returns the members of a specific project (used to populate assignee dropdowns).
   * Requires a projectId because user lookups are always project-scoped now.
   */
  async getAll(orgId: string, projectId: string): Promise<UserOption[]> {
    if (!orgId || !projectId) return [];
    const { data } = await api.get<UserOption[]>(`/organizations/${orgId}/projects/${projectId}/users`);
    return data;
  },
};
