import { Router, type Router as RouterType } from "express";
import { and, eq, or, sql } from "drizzle-orm";
import { users, organizationMembers, organizations, projects, projectMembers } from "@coglity/shared/schema";
import { db } from "../db.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router: RouterType = Router();

/**
 * Returns the current user with their full org + project memberships.
 * The frontend uses this as its single bootstrap call after login.
 */
router.get("/", requireAuth, async (req, res) => {
  const userId = req.session.userId!;
  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
    })
    .from(users)
    .where(eq(users.id, userId));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  // Orgs I belong to
  const memberships = await db
    .select({
      organizationId: organizations.id,
      organizationName: organizations.name,
      orgRole: organizationMembers.orgRole,
    })
    .from(organizationMembers)
    .innerJoin(organizations, eq(organizationMembers.organizationId, organizations.id))
    .where(eq(organizationMembers.userId, userId));

  const orgIds = memberships.map((m) => m.organizationId);

  // For each org, list projects: super_admin gets all projects in org;
  // member gets only projects they have an explicit project_members row for.
  const orgIdToProjects = new Map<string, { projectId: string; projectName: string; role: "admin" | "writer" | "read" | null }[]>();
  memberships.forEach((m) => orgIdToProjects.set(m.organizationId, []));

  if (orgIds.length > 0) {
    const superAdminOrgIds = memberships.filter((m) => m.orgRole === "super_admin").map((m) => m.organizationId);
    const memberOrgIds = memberships.filter((m) => m.orgRole !== "super_admin").map((m) => m.organizationId);

    if (superAdminOrgIds.length > 0) {
      const allProjects = await db
        .select({
          projectId: projects.id,
          projectName: projects.name,
          organizationId: projects.organizationId,
        })
        .from(projects)
        .where(
          or(
            ...superAdminOrgIds.map((oid) => eq(projects.organizationId, oid)),
          ),
        );
      for (const p of allProjects) {
        orgIdToProjects.get(p.organizationId)?.push({
          projectId: p.projectId,
          projectName: p.projectName,
          role: null, // super_admin treated as admin-equivalent in UI
        });
      }
    }

    if (memberOrgIds.length > 0) {
      const rows = await db
        .select({
          projectId: projects.id,
          projectName: projects.name,
          organizationId: projects.organizationId,
          role: projectMembers.role,
        })
        .from(projectMembers)
        .innerJoin(projects, eq(projectMembers.projectId, projects.id))
        .where(
          and(
            eq(projectMembers.userId, userId),
            or(...memberOrgIds.map((oid) => eq(projects.organizationId, oid))),
          ),
        );
      for (const p of rows) {
        orgIdToProjects.get(p.organizationId)?.push({
          projectId: p.projectId,
          projectName: p.projectName,
          role: p.role,
        });
      }
    }
  }

  res.json({
    ...user,
    organizations: memberships.map((m) => ({
      ...m,
      projects: orgIdToProjects.get(m.organizationId) ?? [],
    })),
  });
});

export default router;
