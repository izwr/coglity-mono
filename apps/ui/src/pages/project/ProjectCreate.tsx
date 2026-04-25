import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCurrentOrg } from "../../context/OrgContext";
import { useAuth } from "../../context/AuthContext";
import { projectService } from "../../services/projectService";
import { Button } from "../../components/ui/Button";
import { PageHead } from "../../components/ui/PageHead";
import { useSetBreadcrumbs } from "../../context/BreadcrumbsContext";

export function ProjectCreate() {
  useSetBreadcrumbs([{ label: "Projects" }, { label: "New" }]);
  const { org } = useCurrentOrg();
  const { refresh } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!org) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!org) return;
    setError(null);
    setSubmitting(true);
    try {
      const p = await projectService.create(org.organizationId, { name, description });
      await refresh();
      navigate(`/orgs/${org.organizationId}/projects/${p.id}`);
    } catch (err: any) {
      setError(err.response?.data?.message ?? "Failed to create project");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page">
      <PageHead
        title={<>New <em className="italic-teal">project</em></>}
        subtitle="Projects hold test suites, runs, bugs and knowledge for a single product or workstream."
      />
      <form className="ts-form" onSubmit={submit}>
        <div className="ts-form-field">
          <label htmlFor="p-name">Name</label>
          <input id="p-name" autoFocus type="text" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="ts-form-field">
          <label htmlFor="p-desc">Description</label>
          <textarea id="p-desc" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        {error && <p className="ts-form-error">{error}</p>}
        <div className="ts-form-actions">
          <Button type="button" variant="ghost" onClick={() => navigate(-1)}>Cancel</Button>
          <Button type="submit" disabled={submitting || !name.trim()}>Create</Button>
        </div>
      </form>
    </div>
  );
}
