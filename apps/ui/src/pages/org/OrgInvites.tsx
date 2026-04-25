import { useCallback, useEffect, useState } from "react";
import { useCurrentOrg } from "../../context/OrgContext";
import { inviteService, type PendingInvite } from "../../services/inviteService";
import { projectService, type ProjectRow } from "../../services/projectService";
import { Button } from "../../components/ui/Button";
import { Select } from "../../components/ui/Select";
import { PageHead } from "../../components/ui/PageHead";
import { useSetBreadcrumbs } from "../../context/BreadcrumbsContext";

export function OrgInvites() {
  useSetBreadcrumbs([{ label: "Organization" }, { label: "Invites" }]);
  const { org } = useCurrentOrg();
  const [invites, setInvites] = useState<PendingInvite[]>([]);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [email, setEmail] = useState("");
  const [projectId, setProjectId] = useState("");
  const [role, setRole] = useState<"admin" | "writer" | "read">("writer");
  const [lastLink, setLastLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!org) return;
    setLoading(true);
    try {
      const [inv, proj] = await Promise.all([
        inviteService.listPending(org.organizationId),
        projectService.listInOrg(org.organizationId),
      ]);
      setInvites(inv);
      setProjects(proj);
      if (!projectId && proj[0]) setProjectId(proj[0].id);
    } finally {
      setLoading(false);
    }
  }, [org, projectId]);

  useEffect(() => {
    load();
  }, [load]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!org || !projectId) return;
    setError(null);
    try {
      const res = await inviteService.create(org.organizationId, { email, projectId, projectRole: role });
      const link = `${window.location.origin}/onboarding?invite=${encodeURIComponent(res.token)}`;
      setLastLink(link);
      setEmail("");
      await load();
    } catch (err: any) {
      setError(err.response?.data?.message ?? "Failed to create invite");
    }
  }

  async function revoke(id: string) {
    if (!org) return;
    try {
      await inviteService.revoke(org.organizationId, id);
      load();
    } catch {}
  }

  if (!org) return null;

  return (
    <div className="page">
      <PageHead
        title={<><em className="italic-teal">Invites</em></>}
        subtitle="Invite users to a specific project and role in this organization."
        actions={!showForm && (
          <Button onClick={() => { setShowForm(true); setLastLink(null); }}>
            <svg className="ico" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg>
            New invite
          </Button>
        )}
      />

      {showForm && (
        <form className="ts-form" onSubmit={submit}>
          <div className="ts-form-title">Invite user</div>
          <div className="ts-form-field">
            <label htmlFor="inv-email">Email</label>
            <input
              id="inv-email"
              type="email"
              placeholder="user@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="ts-form-field">
            <label htmlFor="inv-project">Project</label>
            <Select
              inputId="inv-project"
              value={projectId ? { value: projectId, label: projects.find((p) => p.id === projectId)?.name ?? "" } : null}
              onChange={(opt) => setProjectId(opt?.value ?? "")}
              options={projects.map((p) => ({ value: p.id, label: p.name }))}
              placeholder="Select a project"
            />
          </div>
          <div className="ts-form-field">
            <label htmlFor="inv-role">Role</label>
            <Select
              inputId="inv-role"
              value={{ value: role, label: role }}
              onChange={(opt) => opt && setRole(opt.value as "admin" | "writer" | "read")}
              options={[
                { value: "admin", label: "admin" },
                { value: "writer", label: "writer" },
                { value: "read", label: "read" },
              ]}
            />
          </div>
          {error && <p className="ts-form-error">{error}</p>}
          <div className="ts-form-actions">
            <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button type="submit">Create invite</Button>
          </div>
        </form>
      )}

      {lastLink && (
        <div className="ts-card">
          <div className="ts-card-body">
            <div className="ts-card-name">Invite link (share with the invitee):</div>
            <pre style={{ overflow: "auto", userSelect: "all" }}>{lastLink}</pre>
          </div>
          <div className="ts-card-actions">
            <Button variant="ghost" onClick={() => navigator.clipboard.writeText(lastLink)}>Copy</Button>
            <Button variant="ghost" onClick={() => setLastLink(null)}>Dismiss</Button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="ts-empty">Loading…</p>
      ) : invites.length === 0 ? (
        <p className="ts-empty">No pending invites.</p>
      ) : (
        <div className="card" style={{ overflow: "hidden" }}>
          <div className="table-scroll">
            <table className="t">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Project</th>
                  <th>Role</th>
                  <th>Expires</th>
                  <th style={{ textAlign: "right" }}></th>
                </tr>
              </thead>
              <tbody>
                {invites.map((i) => (
                  <tr key={i.id}>
                    <td className="mono">{i.email}</td>
                    <td style={{ color: "var(--ink)" }}>{i.projectName ?? "—"}</td>
                    <td className="mono">{i.projectRole}</td>
                    <td className="mono muted">{new Date(i.expiresAt).toLocaleDateString()}</td>
                    <td style={{ textAlign: "right" }}>
                      <Button variant="danger" size="sm" onClick={() => revoke(i.id)}>Revoke</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
