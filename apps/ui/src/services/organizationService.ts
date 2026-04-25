import { api } from "./api";

export interface OrgListItem {
  id: string;
  name: string;
  orgRole: "super_admin" | "member";
  joinedVia: "creation" | "invite";
}

export interface OrgMemberRow {
  userId: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  orgRole: "super_admin" | "member";
  joinedVia: "creation" | "invite";
  createdAt: string;
}

export interface OrgDetail {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  orgRole: "super_admin" | "member";
}

export const organizationService = {
  async listMine(): Promise<OrgListItem[]> {
    const { data } = await api.get("/organizations");
    return data.data;
  },
  async create(body: {
    name: string;
    firstProject: { name: string; description?: string };
  }): Promise<{ organization: { id: string; name: string }; project: { id: string; name: string } }> {
    const { data } = await api.post("/organizations", body);
    return data;
  },
  async get(orgId: string): Promise<OrgDetail> {
    const { data } = await api.get(`/organizations/${orgId}`);
    return data;
  },
  async update(orgId: string, body: { name?: string }) {
    const { data } = await api.put(`/organizations/${orgId}`, body);
    return data;
  },
  async remove(orgId: string): Promise<void> {
    await api.delete(`/organizations/${orgId}`);
  },
  async listMembers(orgId: string): Promise<OrgMemberRow[]> {
    const { data } = await api.get(`/organizations/${orgId}/members`);
    return data.data;
  },
  async updateMemberRole(orgId: string, userId: string, orgRole: "super_admin" | "member") {
    await api.patch(`/organizations/${orgId}/members/${userId}`, { orgRole });
  },
  async removeMember(orgId: string, userId: string) {
    await api.delete(`/organizations/${orgId}/members/${userId}`);
  },
};
