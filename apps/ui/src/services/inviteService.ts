import { api } from "./api";

export interface PendingInvite {
  id: string;
  email: string;
  projectId: string;
  projectName: string | null;
  projectRole: "admin" | "writer" | "read";
  expiresAt: string;
  createdAt: string;
  createdByName: string | null;
}

export const inviteService = {
  async listPending(orgId: string): Promise<PendingInvite[]> {
    const { data } = await api.get(`/organizations/${orgId}/invites`);
    return data.data;
  },
  async create(
    orgId: string,
    body: { email: string; projectId: string; projectRole: "admin" | "writer" | "read" },
  ): Promise<{ id: string; token: string; expiresAt: string }> {
    const { data } = await api.post(`/organizations/${orgId}/invites`, body);
    return data;
  },
  async revoke(orgId: string, inviteId: string) {
    await api.delete(`/organizations/${orgId}/invites/${inviteId}`);
  },
  async accept(token: string): Promise<{ organizationId: string; projectId: string; projectRole: string }> {
    const { data } = await api.post("/invites/accept", { token });
    return data;
  },
};
