import type { Request, Response, NextFunction } from "express";
import { resolveOrgRole } from "../services/rbac.js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function resolveOrg(req: Request, res: Response, next: NextFunction): Promise<void> {
  const userId = req.session?.userId;
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const rawOrgId = req.params.orgId;
  const orgId = typeof rawOrgId === "string" ? rawOrgId : null;
  if (!orgId || !UUID_RE.test(orgId)) {
    res.status(404).json({ error: "Organization not found" });
    return;
  }
  const role = await resolveOrgRole(userId, orgId);
  if (!role) {
    res.status(404).json({ error: "Organization not found" });
    return;
  }
  req.organizationId = orgId;
  req.orgRole = role;
  next();
}
