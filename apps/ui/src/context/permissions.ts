import { useCurrentOrg } from "./OrgContext";
import { useSingleProjectId } from "../components/ProjectFilter";

export type OrgRole = "super_admin" | "member";
export type ProjectRole = "admin" | "writer" | "read";
export type EffectiveProjectRole = "super_admin" | ProjectRole | null;

export type Action =
  | "org.create"
  | "org.edit"
  | "org.delete"
  | "org.members.manage"
  | "org.invites.manage"
  | "project.create"
  | "project.edit"
  | "project.delete"
  | "project.members.manage"
  | "content.write"
  | "content.delete";

export const ROLE_ORDER: Record<ProjectRole, number> = { read: 1, writer: 2, admin: 3 };

export function hasProjectRole(actual: EffectiveProjectRole, min: ProjectRole): boolean {
  if (!actual) return false;
  if (actual === "super_admin") return true;
  return ROLE_ORDER[actual] >= ROLE_ORDER[min];
}

/**
 * Effective role on the currently-selected project (the one in the filter, or null
 * if zero or multiple are selected). Returns 'super_admin' if the caller is a
 * super_admin of the current org, falling through to the per-project membership
 * role otherwise.
 */
export function useEffectiveProjectRole(): EffectiveProjectRole {
  const { org } = useCurrentOrg();
  const projectId = useSingleProjectId();
  if (!org) return null;
  if (org.orgRole === "super_admin") return "super_admin";
  if (!projectId) return null;
  const membership = org.projects.find((p) => p.projectId === projectId);
  return membership?.role ?? null;
}

/**
 * Returns true if the caller can admin at least one project in the current org.
 * Super_admins always qualify (implicit admin on every project); otherwise we
 * look for an explicit 'admin' membership in the org's project list.
 */
export function useCanAdminAnyProject(): boolean {
  const { org } = useCurrentOrg();
  if (!org) return false;
  if (org.orgRole === "super_admin") return true;
  return org.projects.some((p) => p.role === "admin");
}

export function useCan(action: Action): boolean {
  const { org } = useCurrentOrg();
  const role = useEffectiveProjectRole();

  switch (action) {
    case "org.create":
      return true;
    case "org.edit":
    case "org.delete":
    case "org.members.manage":
    case "org.invites.manage":
      return org?.orgRole === "super_admin";
    case "project.create":
      return org?.orgRole === "super_admin";
    case "project.edit":
    case "project.members.manage":
    case "project.delete":
      return hasProjectRole(role, "admin");
    case "content.write":
      return hasProjectRole(role, "writer");
    case "content.delete":
      return hasProjectRole(role, "writer");
    default:
      return false;
  }
}
