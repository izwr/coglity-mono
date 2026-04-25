import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useCurrentOrg } from "../../context/OrgContext";
import { useAuth } from "../../context/AuthContext";
import { projectService, type ProjectMemberRow } from "../../services/projectService";
import { Button } from "../../components/ui/Button";
import { Select } from "../../components/ui/Select";
import { PageHead } from "../../components/ui/PageHead";
import { useSetBreadcrumbs } from "../../context/BreadcrumbsContext";

export function ProjectDetails() {
  const { org } = useCurrentOrg();
  const { user, refresh } = useAuth();
  const navigate = useNavigate();
  const { projectId } = useParams<{ projectId: string }>();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [effectiveRole, setEffectiveRole] = useState<"super_admin" | "admin" | "writer" | "read" | null>(null);
  const [members, setMembers] = useState<ProjectMemberRow[]>([]);
  const [membersError, setMembersError] = useState<string | null>(null);

  useSetBreadcrumbs([
    { label: "Projects", to: org ? `/orgs/${org.organizationId}/projects` : undefined },
    { label: name || "Project" },
  ]);

  const loadMembers = useCallback(async () => {
    if (!org || !projectId) return;
    const rows = await projectService.listMembers(org.organizationId, projectId);
    setMembers(rows);
  }, [org, projectId]);

  useEffect(() => {
    if (!org || !projectId) return;
    let cancelled = false;
    setLoaded(false);
    setNotFound(false);
    projectService
      .get(org.organizationId, projectId)
      .then((data) => {
        if (cancelled) return;
        setName(data.name);
        setDescription(data.description);
        setEffectiveRole(data.role);
        setLoaded(true);
        if (data.role === "super_admin" || data.role === "admin") {
          projectService
            .listMembers(org.organizationId, projectId)
            .then((rows) => { if (!cancelled) setMembers(rows); })
            .catch(() => { /* non-fatal: members list just won't populate */ });
        }
      })
      .catch(() => {
        if (cancelled) return;
        setNotFound(true);
      });
    return () => {
      cancelled = true;
    };
  }, [org, projectId]);

  if (!org) return null;

  const canEdit = effectiveRole === "super_admin" || effectiveRole === "admin";
  const adminCount = members.filter((m) => m.role === "admin").length;

  async function changeMemberRole(userId: string, role: "admin" | "writer" | "read") {
    if (!org || !projectId) return;
    setMembersError(null);
    try {
      await projectService.updateMemberRole(org.organizationId, projectId, userId, role);
      await loadMembers();
    } catch (err: any) {
      setMembersError(err.response?.data?.message ?? err.response?.data?.error ?? "Failed to change role");
    }
  }

  async function removeMember(userId: string) {
    if (!org || !projectId) return;
    setMembersError(null);
    try {
      await projectService.removeMember(org.organizationId, projectId, userId);
      await loadMembers();
    } catch (err: any) {
      setMembersError(err.response?.data?.message ?? err.response?.data?.error ?? "Failed to remove member");
    }
  }

  async function save() {
    if (!org || !projectId) return;
    setError(null);
    setSaving(true);
    try {
      await projectService.update(org.organizationId, projectId, { name, description });
      await refresh();
    } catch (err: any) {
      setError(err.response?.data?.message ?? err.response?.data?.error ?? "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!org || !projectId) return;
    try {
      await projectService.remove(org.organizationId, projectId);
      await refresh();
      navigate(`/orgs/${org.organizationId}/projects`);
    } catch (err: any) {
      setError(err.response?.data?.message ?? err.response?.data?.error ?? "Failed to delete");
    }
  }

  if (notFound) {
    return (
      <div className="page">
        <PageHead title="Project not found" />
        <Link to={`/orgs/${org.organizationId}/projects`}><Button variant="ghost">Back to projects</Button></Link>
      </div>
    );
  }

  return (
    <div className="page">
      <PageHead
        title={<>Edit <em className="italic-teal">project</em></>}
        subtitle="Update the project name or description, or delete it."
      />

      {!loaded ? (
        <p className="ts-empty">Loading…</p>
      ) : (
        <>
          <div className="ts-form">
            <div className="ts-form-field">
              <label>Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={!canEdit}
              />
            </div>
            <div className="ts-form-field">
              <label>Description</label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={!canEdit}
              />
            </div>
            {error && <p className="ts-form-error">{error}</p>}
            <div className="ts-form-actions">
              <Link to={`/orgs/${org.organizationId}/projects`}>
                <Button variant="ghost" type="button">Back</Button>
              </Link>
              <Button onClick={save} disabled={saving || !canEdit || !name.trim()}>
                Save
              </Button>
            </div>
          </div>

          {canEdit && (
            <div
              className="ts-form"
              style={{ borderTop: "1px solid var(--line)", marginTop: "2rem", paddingTop: "1rem" }}
            >
              <div className="ts-form-title">Members</div>
              {membersError && <p className="ts-form-error">{membersError}</p>}
              {members.length === 0 ? (
                <p className="ts-empty">No members yet.</p>
              ) : (
                <div className="card" style={{ overflow: "hidden" }}>
                  <div className="table-scroll">
                    <table className="t">
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Email</th>
                          <th>Role</th>
                          <th style={{ textAlign: "right" }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {members.map((m) => {
                          const isOnlyAdmin = m.role === "admin" && adminCount <= 1;
                          const isMe = user?.id === m.userId;
                          return (
                            <tr key={m.userId}>
                              <td style={{ color: "var(--ink)" }}>{m.displayName}</td>
                              <td className="mono">{m.email}</td>
                              <td style={{ minWidth: 140 }}>
                                <Select
                                  compact
                                  value={{ value: m.role, label: m.role }}
                                  isDisabled={isOnlyAdmin}
                                  onChange={(opt) => opt && changeMemberRole(m.userId, opt.value as "admin" | "writer" | "read")}
                                  options={[
                                    { value: "admin", label: "admin" },
                                    { value: "writer", label: "writer" },
                                    { value: "read", label: "read" },
                                  ]}
                                />
                              </td>
                              <td style={{ textAlign: "right" }}>
                                <Button
                                  variant="danger"
                                  size="sm"
                                  disabled={isOnlyAdmin || isMe}
                                  title={isOnlyAdmin ? "Cannot remove the last admin" : isMe ? "Cannot remove yourself" : undefined}
                                  onClick={() => removeMember(m.userId)}
                                >
                                  Remove
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {canEdit && (
            <div
              className="ts-form"
              style={{ borderTop: "1px solid var(--line)", marginTop: "2rem", paddingTop: "1rem" }}
            >
              <div className="ts-form-title">Danger zone</div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
                <p style={{ margin: 0 }}>Delete this project and all its content.</p>
                {confirmDelete ? (
                  <div className="ts-delete-confirm">
                    <Button variant="ghost" onClick={() => setConfirmDelete(false)}>Cancel</Button>
                    <Button variant="danger" onClick={remove}>Confirm delete</Button>
                  </div>
                ) : (
                  <Button variant="danger" onClick={() => setConfirmDelete(true)}>
                    Delete project
                  </Button>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}