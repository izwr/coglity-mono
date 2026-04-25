import type { Request, Response, NextFunction } from "express";
import { projectBelongsToOrg, resolveProjectRole } from "../services/rbac.js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function resolveProject(req: Request, res: Response, next: NextFunction): Promise<void> {
  const userId = req.session?.userId;
  const orgId = req.organizationId;
  if (!userId || !orgId) {
    res.status(401).json({ error: "Organization context not resolved" });
    return;
  }
  const rawProjectId = req.params.projectId;
  const projectId = typeof rawProjectId === "string" ? rawProjectId : null;
  if (!projectId || !UUID_RE.test(projectId)) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  const belongs = await projectBelongsToOrg(projectId, orgId);
  if (!belongs) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  const role = await resolveProjectRole(userId, orgId, projectId);
  if (!role) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  req.projectId = projectId;
  req.projectRole = role;
  next();
}
