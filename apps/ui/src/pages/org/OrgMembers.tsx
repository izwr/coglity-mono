import { useCallback, useEffect, useState } from "react";
import { useCurrentOrg } from "../../context/OrgContext";
import { organizationService, type OrgMemberRow } from "../../services/organizationService";
import { useAuth } from "../../context/AuthContext";
import { Button } from "../../components/ui/Button";
import { Select } from "../../components/ui/Select";
import { PageHead } from "../../components/ui/PageHead";
import { useSetBreadcrumbs } from "../../context/BreadcrumbsContext";

export function OrgMembers() {
  useSetBreadcrumbs([{ label: "Organization" }, { label: "Members" }]);
  const { org } = useCurrentOrg();
  const { user } = useAuth();
  const [members, setMembers] = useState<OrgMemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!org) return;
    setLoading(true);
    try {
      const rows = await organizationService.listMembers(org.organizationId);
      setMembers(rows);
    } finally {
      setLoading(false);
    }
  }, [org]);

  useEffect(() => {
    load();
  }, [load]);

  if (!org) return null;

  const superAdminCount = members.filter((m) => m.orgRole === "super_admin").length;

  async function changeRole(userId: string, role: "super_admin" | "member") {
    if (!org) return;
    setError(null);
    try {
      await organizationService.updateMemberRole(org.organizationId, userId, role);
      load();
    } catch (err: any) {
      setError(err.response?.data?.message ?? err.response?.data?.error ?? "Failed to change role");
    }
  }

  async function remove(userId: string) {
    if (!org) return;
    setError(null);
    try {
      await organizationService.removeMember(org.organizationId, userId);
      load();
    } catch (err: any) {
      setError(err.response?.data?.message ?? err.response?.data?.error ?? "Failed to remove member");
    }
  }

  return (
    <div className="page">
      <PageHead
        title={<><em className="italic-teal">Organization</em> members</>}
        subtitle="Manage who can access this organization and their permissions."
      />
      {error && <p className="ts-form-error">{error}</p>}
      {loading ? (
        <p className="ts-empty">Loading…</p>
      ) : (
        <div className="card" style={{ overflow: "hidden" }}>
          <div className="table-scroll">
            <table className="t">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Joined via</th>
                  <th style={{ textAlign: "right" }}></th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => {
                  const isOnlySuperAdmin = m.orgRole === "super_admin" && superAdminCount <= 1;
                  const isMe = user?.id === m.userId;
                  return (
                    <tr key={m.userId}>
                      <td style={{ color: "var(--ink)" }}>{m.displayName}</td>
                      <td className="mono">{m.email}</td>
                      <td style={{ minWidth: 160 }}>
                        <Select
                          compact
                          value={{ value: m.orgRole, label: m.orgRole }}
                          isDisabled={isOnlySuperAdmin}
                          onChange={(opt) => opt && changeRole(m.userId, opt.value as "super_admin" | "member")}
                          options={[
                            { value: "super_admin", label: "super_admin" },
                            { value: "member", label: "member" },
                          ]}
                        />
                      </td>
                      <td className="mono">{m.joinedVia}</td>
                      <td style={{ textAlign: "right" }}>
                        <Button
                          variant="danger"
                          size="sm"
                          disabled={isOnlySuperAdmin || isMe}
                          title={
                            isOnlySuperAdmin
                              ? "Cannot remove the last super admin"
                              : isMe
                              ? "Cannot remove yourself"
                              : undefined
                          }
                          onClick={() => remove(m.userId)}
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
  );
}
