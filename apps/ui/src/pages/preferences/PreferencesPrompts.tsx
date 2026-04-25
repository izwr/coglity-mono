import { PageHead } from "../../components/ui/PageHead";
import { useSetBreadcrumbs } from "../../context/BreadcrumbsContext";

export function PreferencesPrompts() {
  useSetBreadcrumbs([{ label: "Preferences" }, { label: "Prompts" }]);

  return (
    <div className="page">
      <PageHead
        title={<><em className="italic-teal">Prompts</em></>}
        subtitle="Customize the prompts used when generating test cases and triaging bugs."
      />

      <div className="card" style={{ padding: 20 }}>
        <p className="ts-empty" style={{ margin: 0 }}>
          Prompt customization is coming soon.
        </p>
      </div>
    </div>
  );
}