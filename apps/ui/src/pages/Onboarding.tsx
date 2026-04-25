import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { organizationService } from "../services/organizationService";
import { inviteService } from "../services/inviteService";
import { Button } from "../components/ui/Button";

type Mode = "pick" | "create" | "invite";

export function Onboarding() {
  const { user, refresh } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState<Mode>(searchParams.get("invite") ? "invite" : "pick");
  const [orgName, setOrgName] = useState("");
  const [projectName, setProjectName] = useState("");
  const [projectDesc, setProjectDesc] = useState("");
  const [token, setToken] = useState(searchParams.get("invite") ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user && user.organizations.length > 0 && !searchParams.get("invite")) {
      const org = user.organizations[0];
      const project = org.projects[0];
      if (project) navigate(`/orgs/${org.organizationId}/projects/${project.projectId}`, { replace: true });
      else navigate(`/orgs/${org.organizationId}`, { replace: true });
    }
  }, [user, navigate, searchParams]);

  async function submitCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!orgName.trim() || !projectName.trim()) {
      setError("Organization name and first project name are required.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await organizationService.create({
        name: orgName.trim(),
        firstProject: { name: projectName.trim(), description: projectDesc.trim() },
      });
      await refresh();
      navigate(`/orgs/${res.organization.id}/projects/${res.project.id}`, { replace: true });
    } catch (err: any) {
      setError(err.response?.data?.error ? JSON.stringify(err.response.data.error) : "Failed to create organization");
    } finally {
      setSubmitting(false);
    }
  }

  async function submitInvite(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!token.trim()) {
      setError("Invite token required");
      return;
    }
    setSubmitting(true);
    try {
      const res = await inviteService.accept(token.trim());
      await refresh();
      navigate(`/orgs/${res.organizationId}/projects/${res.projectId}`, { replace: true });
    } catch (err: any) {
      const code = err.response?.data?.error;
      if (code === "INVITE_INVALID") setError("This invite is invalid, expired, or not for your email.");
      else setError(err.response?.data?.message ?? "Failed to accept invite");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="onboarding-page">
      <div className="onboarding-card">
        <h1>Welcome to Coglity</h1>
        <p className="onboarding-sub">Let's get you set up.</p>
        {mode === "pick" && (
          <div className="onboarding-picker">
            <Button onClick={() => setMode("create")}>Create a new organization</Button>
            <Button variant="ghost" onClick={() => setMode("invite")}>I have an invite code</Button>
          </div>
        )}
        {mode === "create" && (
          <form className="ts-form" onSubmit={submitCreate}>
            <div className="ts-form-title">Create organization</div>
            <div className="ts-form-field">
              <label htmlFor="org-name">Organization name</label>
              <input
                id="org-name"
                type="text"
                placeholder="Acme Inc."
                autoFocus
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
              />
            </div>
            <div className="ts-form-field">
              <label htmlFor="proj-name">First project name</label>
              <input
                id="proj-name"
                type="text"
                placeholder="Website"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
              />
            </div>
            <div className="ts-form-field">
              <label htmlFor="proj-desc">Project description (optional)</label>
              <textarea
                id="proj-desc"
                rows={3}
                value={projectDesc}
                onChange={(e) => setProjectDesc(e.target.value)}
              />
            </div>
            {error && <p className="ts-form-error">{error}</p>}
            <div className="ts-form-actions">
              <Button type="button" variant="ghost" onClick={() => setMode("pick")}>Back</Button>
              <Button type="submit" disabled={submitting}>{submitting ? "Creating…" : "Create"}</Button>
            </div>
          </form>
        )}
        {mode === "invite" && (
          <form className="ts-form" onSubmit={submitInvite}>
            <div className="ts-form-title">Accept invite</div>
            <div className="ts-form-field">
              <label htmlFor="invite-token">Invite token</label>
              <input
                id="invite-token"
                type="text"
                placeholder="Paste your invite token"
                autoFocus
                value={token}
                onChange={(e) => setToken(e.target.value)}
              />
            </div>
            {error && <p className="ts-form-error">{error}</p>}
            <div className="ts-form-actions">
              <Button type="button" variant="ghost" onClick={() => setMode("pick")}>Back</Button>
              <Button type="submit" disabled={submitting}>{submitting ? "Accepting…" : "Accept"}</Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
