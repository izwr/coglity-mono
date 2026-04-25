import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCurrentOrg } from "../../context/OrgContext";
import { useAuth } from "../../context/AuthContext";
import { organizationService } from "../../services/organizationService";
import { Button } from "../../components/ui/Button";
import { PageHead } from "../../components/ui/PageHead";
import { useSetBreadcrumbs } from "../../context/BreadcrumbsContext";

export function OrgSettings() {
  useSetBreadcrumbs([{ label: "Organization" }, { label: "Settings" }]);
  const { org } = useCurrentOrg();
  const { refresh } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState(org?.organizationName ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (org) setName(org.organizationName);
  }, [org]);

  if (!org) return null;

  async function save() {
    if (!org) return;
    setError(null);
    setSaving(true);
    try {
      await organizationService.update(org.organizationId, { name });
      await refresh();
    } catch (err: any) {
      setError(err.response?.data?.message ?? "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!org) return;
    try {
      await organizationService.remove(org.organizationId);
      await refresh();
      navigate("/");
    } catch (err: any) {
      setError(err.response?.data?.message ?? err.response?.data?.error ?? "Failed to delete");
    }
  }

  return (
    <div className="page">
      <PageHead
        title={<><em className="italic-teal">Organization</em> settings</>}
        subtitle="Rename the organization or delete it (must have no projects)."
      />
      <div className="ts-form">
        <div className="ts-form-field">
          <label>Name</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        {error && <p className="ts-form-error">{error}</p>}
        <div className="ts-form-actions">
          <Button onClick={save} disabled={saving || name === org.organizationName}>Save</Button>
        </div>
      </div>
      <div className="ts-form" style={{ borderTop: "1px solid var(--border)", marginTop: "2rem", paddingTop: "1rem" }}>
        <div className="ts-form-title">Danger zone</div>
        <p>Delete this organization. The organization must have no projects.</p>
        {confirmDelete ? (
          <div className="ts-delete-confirm">
            <Button variant="danger" onClick={remove}>Confirm delete</Button>
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>Cancel</Button>
          </div>
        ) : (
          <Button variant="danger" onClick={() => setConfirmDelete(true)}>Delete organization</Button>
        )}
      </div>
    </div>
  );
}
