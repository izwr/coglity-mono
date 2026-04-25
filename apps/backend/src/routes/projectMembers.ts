import { Router, type Router as RouterType } from "express";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { projectMembers, users, PROJECT_ROLES } from "@coglity/shared/schema";
import { db } from "../db.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { resolveOrg } from "../middleware/resolveOrg.js";
import { resolveProject } from "../middleware/resolveProject.js";
import { requireProjectRole } from "../middleware/requireProjectRole.js";
import { auditRbac, ensureNotLastProjectAdmin, invalidateProjectCache, RbacError } from "../services/rbac.js";

const router: RouterType = Router({ mergeParams: true });

const roleSchema = z.object({ role: z.enum(["admin", "writer", "read"] as const) });

// List project members
router.get("/", requireAuth, resolveOrg, resolveProject, requireProjectRole("read"), async (req, res) => {
  const rows = await db
    .select({
      userId: projectMembers.userId,
      email: users.email,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
      role: projectMembers.role,
      createdAt: projectMembers.createdAt,
    })
    .from(projectMembers)
    .innerJoin(users, eq(projectMembers.userId, users.id))
    .where(eq(projectMembers.projectId, req.projectId!));
  res.json({ data: rows });
});

// Change role
router.patch(
  "/:userId",
  requireAuth,
  resolveOrg,
  resolveProject,
  requireProjectRole("admin"),
  async (req, res) => {
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
      .select({ role: projectMembers.role })
      .from(projectMembers)
      .where(and(eq(projectMembers.projectId, req.projectId!), eq(projectMembers.userId, targetUserId)))
      .limit(1);
    if (!existing) {
      res.status(404).json({ error: "Member not found" });
      return;
    }
    try {
      if (existing.role === "admin" && parsed.data.role !== "admin") {
        await ensureNotLastProjectAdmin(req.projectId!, targetUserId);
      }
    } catch (err) {
      if (err instanceof RbacError) {
        res.status(err.status).json({ error: err.code, message: err.message });
        return;
      }
      throw err;
    }
    await db
      .update(projectMembers)
      .set({ role: parsed.data.role, updatedAt: new Date() })
      .where(and(eq(projectMembers.projectId, req.projectId!), eq(projectMembers.userId, targetUserId)));
    await auditRbac({
      actorUserId: req.session.userId!,
      targetUserId,
      organizationId: req.organizationId!,
      projectId: req.projectId!,
      action: "change_project_role",
      fromRole: existing.role,
      toRole: parsed.data.role,
    });
    invalidateProjectCache(targetUserId, req.projectId!);
    res.json({ role: parsed.data.role });
  },
);

// Remove member
router.delete(
  "/:userId",
  requireAuth,
  resolveOrg,
  resolveProject,
  requireProjectRole("admin"),
  async (req, res) => {
    const targetUserId = typeof req.params.userId === "string" ? req.params.userId : null;
    if (!targetUserId) {
      res.status(400).json({ error: "Invalid userId" });
      return;
    }
    const [existing] = await db
      .select({ role: projectMembers.role })
      .from(projectMembers)
      .where(and(eq(projectMembers.projectId, req.projectId!), eq(projectMembers.userId, targetUserId)))
      .limit(1);
    if (!existing) {
      res.status(404).json({ error: "Member not found" });
      return;
    }
    try {
      await ensureNotLastProjectAdmin(req.projectId!, targetUserId);
    } catch (err) {
      if (err instanceof RbacError) {
        res.status(err.status).json({ error: err.code, message: err.message });
        return;
      }
      throw err;
    }
    await db
      .delete(projectMembers)
      .where(and(eq(projectMembers.projectId, req.projectId!), eq(projectMembers.userId, targetUserId)));
    await auditRbac({
      actorUserId: req.session.userId!,
      targetUserId,
      organizationId: req.organizationId!,
      projectId: req.projectId!,
      action: "remove_project_member",
      fromRole: existing.role,
    });
    invalidateProjectCache(targetUserId, req.projectId!);
    res.status(204).send();
  },
);

export default router;
