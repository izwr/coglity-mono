import type { Request, Response, NextFunction } from "express";
import { and, eq, inArray } from "drizzle-orm";
import { projects, projectMembers } from "@coglity/shared/schema";
import { db } from "../db.js";
import { resolveOrgRole } from "../services/rbac.js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Parses ?projectIds=a,b,c from the query and filters to projects the caller
 * has read access to in the current org. Sets req.projectIdsScope.
 * Must run after resolveOrg.
 */
export async function resolveProjectsScope(req: Request, res: Response, next: NextFunction): Promise<void> {
  const userId = req.session?.userId;
  const orgId = req.organizationId;
  if (!userId || !orgId) {
    res.status(401).json({ error: "Organization context not resolved" });
    return;
  }

  const raw = typeof req.query.projectIds === "string" ? req.query.projectIds : "";
  const requested = raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => UUID_RE.test(s));

  if (requested.length === 0) {
    req.projectIdsScope = [];
    next();
    return;
  }

  const orgRole = await resolveOrgRole(userId, orgId);
  if (!orgRole) {
    res.status(404).json({ error: "Organization not found" });
    return;
  }

  let accessible: string[];
  if (orgRole === "super_admin") {
    const rows = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(inArray(projects.id, requested), eq(projects.organizationId, orgId)));
    accessible = rows.map((r) => r.id);
  } else {
    const rows = await db
      .select({ id: projectMembers.projectId })
      .from(projectMembers)
      .innerJoin(projects, eq(projectMembers.projectId, projects.id))
      .where(
        and(
          eq(projectMembers.userId, userId),
          eq(projects.organizationId, orgId),
          inArray(projectMembers.projectId, requested),
        ),
      );
    accessible = rows.map((r) => r.id);
  }

  req.projectIdsScope = accessible;
  next();
}
