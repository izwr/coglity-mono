import { Router, type Router as RouterType } from "express";
import { and, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { invites, projects, users, PROJECT_ROLES } from "@coglity/shared/schema";
import { db } from "../db.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { resolveOrg } from "../middleware/resolveOrg.js";
import { requireOrgRole } from "../middleware/requireOrgRole.js";
import { auditRbac, createInvite } from "../services/rbac.js";

const router: RouterType = Router({ mergeParams: true });

const createInviteSchema = z.object({
  email: z.string().email().max(255),
  projectId: z.string().uuid(),
  projectRole: z.enum(["admin", "writer", "read"] as const),
});

// List pending invites
router.get("/", requireAuth, resolveOrg, requireOrgRole("super_admin"), async (req, res) => {
  const rows = await db
    .select({
      id: invites.id,
      email: invites.email,
      projectId: invites.projectId,
      projectName: projects.name,
      projectRole: invites.projectRole,
      expiresAt: invites.expiresAt,
      createdAt: invites.createdAt,
      createdByName: users.displayName,
    })
    .from(invites)
    .leftJoin(projects, eq(invites.projectId, projects.id))
    .leftJoin(users, eq(invites.createdBy, users.id))
    .where(and(eq(invites.organizationId, req.organizationId!), isNull(invites.consumedAt)));
  res.json({ data: rows });
});

// Create invite
router.post("/", requireAuth, resolveOrg, requireOrgRole("super_admin"), async (req, res) => {
  const parsed = createInviteSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    return;
  }
  // Confirm project belongs to this org
  const [proj] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, parsed.data.projectId), eq(projects.organizationId, req.organizationId!)))
    .limit(1);
  if (!proj) {
    res.status(400).json({ error: "projectId does not belong to this organization" });
    return;
  }

  const { token, expiresAt, id } = await createInvite({
    organizationId: req.organizationId!,
    projectId: parsed.data.projectId,
    email: parsed.data.email,
    projectRole: parsed.data.projectRole,
    createdBy: req.session.userId!,
  });

  res.status(201).json({ id, token, expiresAt });
});

// Revoke invite
router.delete("/:inviteId", requireAuth, resolveOrg, requireOrgRole("super_admin"), async (req, res) => {
  const inviteId = typeof req.params.inviteId === "string" ? req.params.inviteId : null;
  if (!inviteId) {
    res.status(400).json({ error: "Invalid inviteId" });
    return;
  }
  const [updated] = await db
    .update(invites)
    .set({ consumedAt: new Date(), consumedByUserId: null })
    .where(and(eq(invites.id, inviteId), eq(invites.organizationId, req.organizationId!), isNull(invites.consumedAt)))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Invite not found" });
    return;
  }
  await auditRbac({
    actorUserId: req.session.userId!,
    organizationId: req.organizationId!,
    projectId: updated.projectId,
    action: "revoke_invite",
    metadata: { inviteId: updated.id, email: updated.email },
  });
  res.status(204).send();
});

export default router;
