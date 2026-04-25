import { Router, type Router as RouterType } from "express";
import { and, eq } from "drizzle-orm";
import { z } from "zod/v4";
import {
  organizations,
  organizationMembers,
  projects,
  projectMembers,
  insertOrganizationSchema,
  insertProjectSchema,
  selectOrganizationSchema,
} from "@coglity/shared/schema";
import { db } from "../db.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { resolveOrg } from "../middleware/resolveOrg.js";
import { requireOrgRole } from "../middleware/requireOrgRole.js";
import { auditRbac, invalidateOrgCache } from "../services/rbac.js";

const router: RouterType = Router();

const createOrgWithProjectSchema = z.object({
  name: z.string().min(1).max(255),
  firstProject: insertProjectSchema.pick({ name: true, description: true }),
});

// List orgs I'm a member of
router.get("/", requireAuth, async (req, res) => {
  const userId = req.session.userId!;
  const rows = await db
    .select({
      id: organizations.id,
      name: organizations.name,
      orgRole: organizationMembers.orgRole,
      joinedVia: organizationMembers.joinedVia,
    })
    .from(organizationMembers)
    .innerJoin(organizations, eq(organizationMembers.organizationId, organizations.id))
    .where(eq(organizationMembers.userId, userId));
  res.json({ data: rows });
});

// Create org (+ first project, + make me super_admin)
router.post("/", requireAuth, async (req, res) => {
  const parsed = createOrgWithProjectSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    return;
  }
  const userId = req.session.userId!;
  const orgInsert = insertOrganizationSchema.safeParse({ name: parsed.data.name });
  if (!orgInsert.success) {
    res.status(400).json({ error: orgInsert.error.flatten().fieldErrors });
    return;
  }

  const [org] = await db
    .insert(organizations)
    .values({ name: orgInsert.data.name, createdBy: userId })
    .returning();

  await db.insert(organizationMembers).values({
    organizationId: org.id,
    userId,
    orgRole: "super_admin",
    joinedVia: "creation",
  });

  const [project] = await db
    .insert(projects)
    .values({
      organizationId: org.id,
      name: parsed.data.firstProject.name,
      description: parsed.data.firstProject.description ?? "",
      createdBy: userId,
      updatedBy: userId,
    })
    .returning();

  await db.insert(projectMembers).values({
    projectId: project.id,
    userId,
    role: "admin",
    createdBy: userId,
  });

  await auditRbac({
    actorUserId: userId,
    organizationId: org.id,
    action: "create_org",
    metadata: { name: org.name },
  });
  await auditRbac({
    actorUserId: userId,
    organizationId: org.id,
    projectId: project.id,
    action: "create_project",
    metadata: { name: project.name },
  });

  invalidateOrgCache(userId);
  res.status(201).json({ organization: org, project });
});

// Get org
router.get("/:orgId", requireAuth, resolveOrg, async (req, res) => {
  const [org] = await db.select().from(organizations).where(eq(organizations.id, req.organizationId!));
  if (!org) {
    res.status(404).json({ error: "Organization not found" });
    return;
  }
  res.json({ ...selectOrganizationSchema.parse(org), orgRole: req.orgRole });
});

// Update org
router.put("/:orgId", requireAuth, resolveOrg, requireOrgRole("super_admin"), async (req, res) => {
  const parsed = insertOrganizationSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    return;
  }
  const [updated] = await db
    .update(organizations)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(organizations.id, req.organizationId!))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Organization not found" });
    return;
  }
  res.json(updated);
});

// Delete org
router.delete("/:orgId", requireAuth, resolveOrg, requireOrgRole("super_admin"), async (req, res) => {
  const orgId = req.organizationId!;
  const [projCount] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.organizationId, orgId))
    .limit(1);
  if (projCount) {
    res.status(409).json({ error: "Organization has projects; delete them first" });
    return;
  }
  await db.delete(organizations).where(eq(organizations.id, orgId));
  await auditRbac({
    actorUserId: req.session.userId!,
    organizationId: orgId,
    action: "delete_org",
  });
  invalidateOrgCache(req.session.userId!, orgId);
  res.status(204).send();
});

export default router;
