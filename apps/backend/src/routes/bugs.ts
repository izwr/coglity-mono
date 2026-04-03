import { type Router as RouterType, Router } from "express";
import { eq, and, or, ilike, desc, asc, sql, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { bugs, insertBugSchema, tags, entityTags, users, type EntityTagEntityType, type BugComment } from "@coglity/shared/schema";
import { db } from "../db.js";
import { randomUUID } from "crypto";

const router: RouterType = Router();

const createdByUser = alias(users, "createdByUser");
const assignedToUser = alias(users, "assignedToUser");

async function getTagsForEntity(entityId: string, entityType: EntityTagEntityType) {
  const rows = await db
    .select({ tag: tags })
    .from(entityTags)
    .innerJoin(tags, eq(entityTags.tagId, tags.id))
    .where(and(eq(entityTags.entityId, entityId), eq(entityTags.entityType, entityType)));
  return rows.map((r) => r.tag);
}

async function syncEntityTags(entityId: string, entityType: EntityTagEntityType, tagIds: string[], userId?: string) {
  await db
    .delete(entityTags)
    .where(and(eq(entityTags.entityId, entityId), eq(entityTags.entityType, entityType)));

  if (tagIds.length > 0) {
    await db.insert(entityTags).values(
      tagIds.map((tagId) => ({ entityId, tagId, entityType, createdBy: userId })),
    );
  }
}

const bugColumns = {
  id: bugs.id,
  title: bugs.title,
  description: bugs.description,
  comments: bugs.comments,
  attachments: bugs.attachments,
  assignedTo: bugs.assignedTo,
  bugType: bugs.bugType,
  createdBy: bugs.createdBy,
  priority: bugs.priority,
  severity: bugs.severity,
  resolution: bugs.resolution,
  state: bugs.state,
  reproducibility: bugs.reproducibility,
  createdAt: bugs.createdAt,
  updatedAt: bugs.updatedAt,
  createdByName: createdByUser.displayName,
  assignedToName: assignedToUser.displayName,
} as const;

function bugsBaseQuery() {
  return db
    .select(bugColumns)
    .from(bugs)
    .leftJoin(createdByUser, eq(bugs.createdBy, createdByUser.id))
    .leftJoin(assignedToUser, eq(bugs.assignedTo, assignedToUser.id));
}

// List all — supports search, filter, sort, pagination
router.get("/", async (req, res) => {
  const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
  const state = typeof req.query.state === "string" ? req.query.state : "";
  const priority = typeof req.query.priority === "string" ? req.query.priority : "";
  const severity = typeof req.query.severity === "string" ? req.query.severity : "";
  const bugType = typeof req.query.bugType === "string" ? req.query.bugType : "";
  const assignedToId = typeof req.query.assignedTo === "string" ? req.query.assignedTo : "";
  const tagId = typeof req.query.tagId === "string" ? req.query.tagId : "";
  const sortBy = typeof req.query.sortBy === "string" ? req.query.sortBy : "createdAt";
  const sortDir = req.query.sortDir === "asc" ? "asc" : "desc";
  const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? "10"), 10) || 10));

  // Tag filter
  let tagFilterIds: string[] | null = null;
  if (tagId) {
    const tagRows = await db
      .select({ entityId: entityTags.entityId })
      .from(entityTags)
      .where(and(eq(entityTags.tagId, tagId), eq(entityTags.entityType, "bug" as EntityTagEntityType)));
    tagFilterIds = tagRows.map((r) => r.entityId);
    if (tagFilterIds.length === 0) {
      res.json({ data: [], total: 0, page, limit });
      return;
    }
  }

  const conditions = [];
  if (search) {
    conditions.push(or(ilike(bugs.title, `%${search}%`), ilike(bugs.description, `%${search}%`)));
  }
  if (state) conditions.push(eq(bugs.state, state as any));
  if (priority) conditions.push(eq(bugs.priority, priority as any));
  if (severity) conditions.push(eq(bugs.severity, severity as any));
  if (bugType) conditions.push(eq(bugs.bugType, bugType as any));
  if (assignedToId) conditions.push(eq(bugs.assignedTo, assignedToId));
  if (tagFilterIds) conditions.push(inArray(bugs.id, tagFilterIds));
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const sortColumn =
    sortBy === "title" ? bugs.title :
    sortBy === "priority" ? bugs.priority :
    sortBy === "severity" ? bugs.severity :
    sortBy === "updatedAt" ? bugs.updatedAt :
    bugs.createdAt;
  const orderFn = sortDir === "asc" ? asc : desc;

  const [{ count: total }] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(bugs)
    .where(where);

  const offset = (page - 1) * limit;
  const rows = await bugsBaseQuery()
    .where(where)
    .orderBy(orderFn(sortColumn))
    .limit(limit)
    .offset(offset);

  const result = await Promise.all(
    rows.map(async (bug) => ({
      ...bug,
      tags: await getTagsForEntity(bug.id, "bug" as EntityTagEntityType),
    })),
  );

  res.json({ data: result, total, page, limit });
});

// Get by ID
router.get("/:id", async (req, res) => {
  const [bug] = await bugsBaseQuery().where(eq(bugs.id, req.params.id));
  if (!bug) {
    res.status(404).json({ error: "Bug not found" });
    return;
  }
  res.json({ ...bug, tags: await getTagsForEntity(bug.id, "bug" as EntityTagEntityType) });
});

// Create
router.post("/", async (req, res) => {
  const { tagIds, ...body } = req.body;
  const parsed = insertBugSchema.safeParse(body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    return;
  }
  const userId = req.session.userId;
  const [inserted] = await db
    .insert(bugs)
    .values({ ...parsed.data, createdBy: userId })
    .returning();
  if (Array.isArray(tagIds) && tagIds.length > 0) {
    await syncEntityTags(inserted.id, "bug" as EntityTagEntityType, tagIds, userId);
  }
  const [bug] = await bugsBaseQuery().where(eq(bugs.id, inserted.id));
  res.status(201).json({ ...bug, tags: await getTagsForEntity(bug.id, "bug" as EntityTagEntityType) });
});

// Update
router.put("/:id", async (req, res) => {
  const { tagIds, ...body } = req.body;
  const parsed = insertBugSchema.partial().safeParse(body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    return;
  }
  const [updated] = await db
    .update(bugs)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(bugs.id, req.params.id))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Bug not found" });
    return;
  }
  if (Array.isArray(tagIds)) {
    await syncEntityTags(updated.id, "bug" as EntityTagEntityType, tagIds, req.session.userId);
  }
  const [bug] = await bugsBaseQuery().where(eq(bugs.id, updated.id));
  res.json({ ...bug, tags: await getTagsForEntity(bug.id, "bug" as EntityTagEntityType) });
});

// Add comment
router.post("/:id/comments", async (req, res) => {
  const { text } = req.body;
  if (!text || typeof text !== "string" || text.trim().length === 0) {
    res.status(400).json({ error: "Comment text is required" });
    return;
  }
  const [existing] = await db.select().from(bugs).where(eq(bugs.id, req.params.id));
  if (!existing) {
    res.status(404).json({ error: "Bug not found" });
    return;
  }

  const userId = req.session.userId;
  let createdByName: string | undefined;
  if (userId) {
    const [user] = await db.select({ displayName: users.displayName }).from(users).where(eq(users.id, userId));
    createdByName = user?.displayName;
  }

  const newComment: BugComment = {
    id: randomUUID(),
    text: text.trim(),
    createdBy: userId ?? "unknown",
    createdByName,
    createdAt: new Date().toISOString(),
  };

  const updatedComments = [...(existing.comments as BugComment[] ?? []), newComment];
  await db.update(bugs).set({ comments: updatedComments, updatedAt: new Date() }).where(eq(bugs.id, req.params.id));

  const [bug] = await bugsBaseQuery().where(eq(bugs.id, req.params.id));
  res.status(201).json({ ...bug, tags: await getTagsForEntity(bug.id, "bug" as EntityTagEntityType) });
});

// Delete
router.delete("/:id", async (req, res) => {
  await db
    .delete(entityTags)
    .where(and(eq(entityTags.entityId, req.params.id), eq(entityTags.entityType, "bug" as EntityTagEntityType)));
  const [deleted] = await db
    .delete(bugs)
    .where(eq(bugs.id, req.params.id))
    .returning({ id: bugs.id });
  if (!deleted) {
    res.status(404).json({ error: "Bug not found" });
    return;
  }
  res.status(204).send();
});

export default router;