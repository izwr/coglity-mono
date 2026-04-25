import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useCurrentOrg } from "../../context/OrgContext";
import { useCan } from "../../context/permissions";
import { projectService, type ProjectRow } from "../../services/projectService";
import { Button } from "../../components/ui/Button";
import { PageHead } from "../../components/ui/PageHead";
import { useSetBreadcrumbs } from "../../context/BreadcrumbsContext";

export function ProjectsList() {
  useSetBreadcrumbs([{ label: "Projects" }]);
  const { org } = useCurrentOrg();
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const canCreate = useCan("project.create");

  const load = useCallback(async () => {
    if (!org) return;
    setLoading(true);
    try {
      const rows = await projectService.listInOrg(org.organizationId);
      setProjects(rows);
    } finally {
      setLoading(false);
    }
  }, [org]);

  useEffect(() => {
    load();
  }, [load]);

  if (!org) return null;

  return (
    <div className="page">
      <PageHead
        title={<><em className="italic-teal">Projects</em></>}
        subtitle="Projects group your test suites, runs, bugs and knowledge."
        actions={canCreate && (
          <Link to={`/orgs/${org.organizationId}/projects/new`}>
            <Button>
              <svg className="ico" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg>
              New project
            </Button>
          </Link>
        )}
      />
      {loading ? (
        <p className="ts-empty">Loading…</p>
      ) : projects.length === 0 ? (
        <p className="ts-empty">No projects yet.</p>
      ) : (
        <div className="ts-list">
          {projects.map((p) => (
            <div key={p.id} className="ts-card">
              <div className="ts-card-body">
                <Link to={`/orgs/${org.organizationId}/projects/${p.id}`}>
                  <div className="ts-card-name">{p.name}</div>
                </Link>
                {p.description && <div className="ts-card-desc">{p.description}</div>}
                <div className="ts-card-meta">Created {new Date(p.createdAt).toLocaleDateString()}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
