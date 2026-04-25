import { Router, type Router as RouterType } from "express";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { organizationMembers, projectMembers, projects, users, ORG_ROLES } from "@coglity/shared/schema";
import { db } from "../db.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { resolveOrg } from "../middleware/resolveOrg.js";
import { requireOrgRole } from "../middleware/requireOrgRole.js";
import { auditRbac, ensureNotLastSuperAdmin, invalidateOrgCache, RbacError } from "../services/rbac.js";

const router: RouterType = Router({ mergeParams: true });

const roleSchema = z.object({ orgRole: z.enum(["super_admin", "member"] as const) });

// List members
router.get("/", requireAuth, resolveOrg, async (req, res) => {
  const rows = await db
    .select({
      userId: organizationMembers.userId,
      email: users.email,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
      orgRole: organizationMembers.orgRole,
      joinedVia: organizationMembers.joinedVia,
      createdAt: organizationMembers.createdAt,
    })
    .from(organizationMembers)
    .innerJoin(users, eq(organizationMembers.userId, users.id))
    .where(eq(organizationMembers.organizationId, req.organizationId!));
  res.json({ data: rows });
});

// Change org role
router.patch("/:userId", requireAuth, resolveOrg, requireOrgRole("super_admin"), async (req, res) => {
  const parsed = roleSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    return;
  }
  const targetUserId = typeof req.params.userId === "string" ? req.params.userId : null;
  if (!targetUserId) {
    res.status(400).json({ error: "Invalid userId" });
    return;
  }
  const [existing] = await db
    .select({ orgRole: organizationMembers.orgRole })
    .from(organizationMembers)
    .where(and(eq(organizationMembers.organizationId, req.organizationId!), eq(organizationMembers.userId, targetUserId)))
    .limit(1);
  if (!existing) {
    res.status(404).json({ error: "Member not found" });
    return;
  }

  try {
    if (parsed.data.orgRole !== "super_admin" && existing.orgRole === "super_admin") {
      await ensureNotLastSuperAdmin(req.organizationId!, targetUserId);
    }
  } catch (err) {
    if (err instanceof RbacError) {
      res.status(err.status).json({ error: err.code, message: err.message });
      return;
    }
    throw err;
  }

  await db
    .update(organizationMembers)
    .set({ orgRole: parsed.data.orgRole, updatedAt: new Date() })
    .where(and(eq(organizationMembers.organizationId, req.organizationId!), eq(organizationMembers.userId, targetUserId)));

  await auditRbac({
    actorUserId: req.session.userId!,
    targetUserId,
    organizationId: req.organizationId!,
    action: "change_org_role",
    fromRole: existing.orgRole,
    toRole: parsed.data.orgRole,
  });
  invalidateOrgCache(targetUserId, req.organizationId!);

  res.json({ orgRole: parsed.data.orgRole });
});

// Remove member
router.delete("/:userId", requireAuth, resolveOrg, requireOrgRole("super_admin"), async (req, res) => {
  const targetUserId = typeof req.params.userId === "string" ? req.params.userId : null;
  if (!targetUserId) {
    res.status(400).json({ error: "Invalid userId" });
    return;
  }
  const [existing] = await db
    .select({ orgRole: organizationMembers.orgRole })
    .from(organizationMembers)
    .where(and(eq(organizationMembers.organizationId, req.organizationId!), eq(organizationMembers.userId, targetUserId)))
    .limit(1);
  if (!existing) {
    res.status(404).json({ error: "Member not found" });
    return;
  }
  try {
    await ensureNotLastSuperAdmin(req.organizationId!, targetUserId);
  } catch (err) {
    if (err instanceof RbacError) {
      res.status(err.status).json({ error: err.code, message: err.message });
      return;
    }
    throw err;
  }

  // Cascade-delete their project memberships within this org
  const orgProjects = await db
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.organizationId, req.organizationId!));
  if (orgProjects.length > 0) {
    const ids = orgProjects.map((p) => p.id);
    for (const pid of ids) {
      await db
        .delete(projectMembers)
        .where(and(eq(projectMembers.projectId, pid), eq(projectMembers.userId, targetUserId)));
    }
  }

  await db
    .delete(organizationMembers)
    .where(and(eq(organizationMembers.organizationId, req.organizationId!), eq(organizationMembers.userId, targetUserId)));

  await auditRbac({
    actorUserId: req.session.userId!,
    targetUserId,
    organizationId: req.organizationId!,
    action: "remove_org_member",
    fromRole: existing.orgRole,
  });
  invalidateOrgCache(targetUserId, req.organizationId!);

  res.status(204).send();
});

export default router;
