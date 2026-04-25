import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCurrentOrg } from "../../context/OrgContext";
import { useAuth } from "../../context/AuthContext";
import { projectService } from "../../services/projectService";
import { Button } from "../../components/ui/Button";
import { PageHead } from "../../components/ui/PageHead";
import { useSetBreadcrumbs } from "../../context/BreadcrumbsContext";
import { ProjectFilter, useSelectedProjectIds, useSingleProjectId } from "../../components/ProjectFilter";

export function ProjectSettings() {
  useSetBreadcrumbs([{ label: "Project" }, { label: "Settings" }]);
  const { org } = useCurrentOrg();
  const selectedIds = useSelectedProjectIds();
  const projectId = useSingleProjectId();
  const { refresh } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!org || !projectId) {
      setLoaded(false);
      return;
    }
    let cancelled = false;
    projectService.get(org.organizationId, projectId).then((data) => {
      if (cancelled) return;
      setName(data.name);
      setDescription(data.description);
      setLoaded(true);
    }).catch(() => {
      if (cancelled) return;
      setLoaded(false);
    });
    return () => { cancelled = true; };
  }, [org, projectId]);

  if (!org) return null;

  async function save() {
    if (!org || !projectId) return;
    setError(null);
    setSaving(true);
    try {
      await projectService.update(org.organizationId, projectId, { name, description });
      await refresh();
    } catch (err: any) {
      setError(err.response?.data?.message ?? "Failed to save");
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
      setError(err.response?.data?.message ?? "Failed to delete");
    }
  }

  return (
    <div className="page">
      <PageHead
        title={<><em className="italic-teal">Project</em> settings</>}
        subtitle="Rename the project or delete it (removes all its content)."
      />

      <div style={{ marginBottom: 16 }}>
        <ProjectFilter placeholder="Pick a project to edit…" />
      </div>

      {selectedIds.length === 0 ? (
        <div className="empty">
          <div className="title">Pick a <em className="italic-teal">project</em> to edit.</div>
          <div className="sub">Use the filter above to select a single project.</div>
        </div>
      ) : selectedIds.length > 1 ? (
        <div className="empty">
          <div className="title">Pick <em className="italic-teal">exactly one</em> project.</div>
          <div className="sub">Project settings apply to a single project narrow the filter.</div>
        </div>
      ) : !loaded ? (
        <p className="ts-empty">Loading…</p>
      ) : (
        <>
          <div className="ts-form">
            <div className="ts-form-field">
              <label>Name</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="ts-form-field">
              <label>Description</label>
              <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            {error && <p className="ts-form-error">{error}</p>}
            <div className="ts-form-actions">
              <Button onClick={save} disabled={saving}>Save</Button>
            </div>
          </div>
          <div className="ts-form" style={{ borderTop: "1px solid var(--border)", marginTop: "2rem", paddingTop: "1rem" }}>
            <div className="ts-form-title">Danger zone</div>
            <p>Delete this project and all its content.</p>
            {confirmDelete ? (
              <div className="ts-delete-confirm">
                <Button variant="danger" onClick={remove}>Confirm delete</Button>
                <Button variant="ghost" onClick={() => setConfirmDelete(false)}>Cancel</Button>
              </div>
            ) : (
              <Button variant="danger" onClick={() => setConfirmDelete(true)}>Delete project</Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
