import { api } from "./api";

export interface ProjectRow {
  id: string;
  organizationId: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  role?: "admin" | "writer" | "read";
}

export interface ProjectMemberRow {
  userId: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  role: "admin" | "writer" | "read";
  createdAt: string;
}

export const projectService = {
  async listInOrg(orgId: string): Promise<ProjectRow[]> {
    const { data } = await api.get(`/organizations/${orgId}/projects`);
    return data.data;
  },
  async create(orgId: string, body: { name: string; description?: string }): Promise<ProjectRow> {
    const { data } = await api.post(`/organizations/${orgId}/projects`, body);
    return data;
  },
  async get(orgId: string, projectId: string): Promise<Omit<ProjectRow, "role"> & { role: "super_admin" | "admin" | "writer" | "read" }> {
    const { data } = await api.get(`/organizations/${orgId}/projects/${projectId}`);
    return data;
  },
  async update(orgId: string, projectId: string, body: { name?: string; description?: string }) {
    const { data } = await api.put(`/organizations/${orgId}/projects/${projectId}`, body);
    return data;
  },
  async remove(orgId: string, projectId: string) {
    await api.delete(`/organizations/${orgId}/projects/${projectId}`);
  },
  async listMembers(orgId: string, projectId: string): Promise<ProjectMemberRow[]> {
    const { data } = await api.get(`/organizations/${orgId}/projects/${projectId}/members`);
    return data.data;
  },
  async updateMemberRole(orgId: string, projectId: string, userId: string, role: "admin" | "writer" | "read") {
    await api.patch(`/organizations/${orgId}/projects/${projectId}/members/${userId}`, { role });
  },
  async removeMember(orgId: string, projectId: string, userId: string) {
    await api.delete(`/organizations/${orgId}/projects/${projectId}/members/${userId}`);
  },
};
