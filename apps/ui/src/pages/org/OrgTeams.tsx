import { useCurrentOrg } from "../../context/OrgContext";
import { PageHead } from "../../components/ui/PageHead";
import { useSetBreadcrumbs } from "../../context/BreadcrumbsContext";

export function OrgTeams() {
  useSetBreadcrumbs([{ label: "Organization" }, { label: "Teams" }]);
  const { org } = useCurrentOrg();

  if (!org) return null;

  return (
    <div className="page">
      <PageHead
        title={<><em className="italic-teal">Teams</em></>}
        subtitle="Group members into teams for easier access control and assignment."
      />

      <div className="card" style={{ padding: 20 }}>
        <p className="ts-empty" style={{ margin: 0 }}>
          Teams are coming soon.
        </p>
      </div>
    </div>
  );
}