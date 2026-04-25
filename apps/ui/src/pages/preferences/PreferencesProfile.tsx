import { useAuth } from "../../context/AuthContext";
import { PageHead } from "../../components/ui/PageHead";
import { useSetBreadcrumbs } from "../../context/BreadcrumbsContext";

export function PreferencesProfile() {
  useSetBreadcrumbs([{ label: "Preferences" }, { label: "Profile" }]);
  const { user } = useAuth();

  if (!user) return null;

  const initials = user.displayName
    ? user.displayName.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()
    : "?";

  return (
    <div className="page">
      <PageHead
        title={<><em className="italic-teal">Profile</em></>}
        subtitle="Your account details used across Coglity."
      />

      <div className="card" style={{ padding: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
          <div className="avatar" style={{ width: 56, height: 56, fontSize: 20 }}>{initials}</div>
          <div>
            <div style={{ fontSize: 16, color: "var(--ink)", fontWeight: 500 }}>{user.displayName}</div>
            <div style={{ fontSize: 13, color: "var(--muted)" }}>{user.email}</div>
          </div>
        </div>

        <div className="ts-form">
          <div className="ts-form-field">
            <label>Display name</label>
            <input type="text" value={user.displayName} readOnly />
          </div>
          <div className="ts-form-field">
            <label>Email</label>
            <input type="email" value={user.email} readOnly />
          </div>
        </div>
      </div>
    </div>
  );
}