import { Router, type Router as RouterType } from "express";
import { and, eq, inArray } from "drizzle-orm";
import { projects, projectMembers, insertProjectSchema } from "@coglity/shared/schema";
import { db } from "../db.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { resolveOrg } from "../middleware/resolveOrg.js";
import { requireOrgRole } from "../middleware/requireOrgRole.js";
import { resolveProject } from "../middleware/resolveProject.js";
import { requireProjectRole } from "../middleware/requireProjectRole.js";
import { auditRbac } from "../services/rbac.js";

const router: RouterType = Router({ mergeParams: true });

// List projects in this org
router.get("/", requireAuth, resolveOrg, async (req, res) => {
  const userId = req.session.userId!;
  let rows;
  if (req.orgRole === "super_admin") {
    rows = await db
      .select({
        id: projects.id,
        organizationId: projects.organizationId,
        name: projects.name,
        description: projects.description,
        createdAt: projects.createdAt,
        updatedAt: projects.updatedAt,
      })
      .from(projects)
      .where(eq(projects.organizationId, req.organizationId!));
  } else {
    rows = await db
      .select({
        id: projects.id,
        organizationId: projects.organizationId,
        name: projects.name,
        description: projects.description,
        createdAt: projects.createdAt,
        updatedAt: projects.updatedAt,
        role: projectMembers.role,
      })
      .from(projectMembers)
      .innerJoin(projects, eq(projectMembers.projectId, projects.id))
      .where(and(eq(projects.organizationId, req.organizationId!), eq(projectMembers.userId, userId)));
  }
  res.json({ data: rows });
});

// Create project (super_admin only)
router.post("/", requireAuth, resolveOrg, requireOrgRole("super_admin"), async (req, res) => {
  const parsed = insertProjectSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    return;
  }
  const userId = req.session.userId!;
  const [project] = await db
    .insert(projects)
    .values({
      organizationId: req.organizationId!,
      name: parsed.data.name,
      description: parsed.data.description ?? "",
      createdBy: userId,
      updatedBy: userId,
    })
    .returning();
  await auditRbac({
    actorUserId: userId,
    organizationId: req.organizationId!,
    projectId: project.id,
    action: "create_project",
    metadata: { name: project.name },
  });
  res.status(201).json(project);
});

// Get project
router.get("/:projectId", requireAuth, resolveOrg, resolveProject, requireProjectRole("read"), async (req, res) => {
  const [proj] = await db.select().from(projects).where(eq(projects.id, req.projectId!));
  if (!proj) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  res.json({ ...proj, role: req.projectRole });
});

// Update project
router.put("/:projectId", requireAuth, resolveOrg, resolveProject, requireProjectRole("admin"), async (req, res) => {
  const parsed = insertProjectSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    return;
  }
  const [updated] = await db
    .update(projects)
    .set({ ...parsed.data, updatedBy: req.session.userId!, updatedAt: new Date() })
    .where(eq(projects.id, req.projectId!))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  res.json(updated);
});

// Delete project
router.delete("/:projectId", requireAuth, resolveOrg, resolveProject, requireProjectRole("admin"), async (req, res) => {
  await db.delete(projects).where(eq(projects.id, req.projectId!));
  await auditRbac({
    actorUserId: req.session.userId!,
    organizationId: req.organizationId!,
    projectId: req.projectId!,
    action: "delete_project",
  });
  res.status(204).send();
});

export default router;
