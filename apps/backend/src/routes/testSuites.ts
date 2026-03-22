import { type Router as RouterType, Router } from "express";
import { eq, and, or, ilike, desc, asc, sql, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { testSuites, insertTestSuiteSchema, tags, entityTags, users, type EntityTagEntityType } from "@coglity/shared/schema";
import { db } from "../db.js";

const router: RouterType = Router();

const createdByUser = alias(users, "createdByUser");
const updatedByUser = alias(users, "updatedByUser");

// Helper: get tags for an entity
async function getTagsForEntity(entityId: string, entityType: EntityTagEntityType) {
  const rows = await db
    .select({ tag: tags })
    .from(entityTags)
    .innerJoin(tags, eq(entityTags.tagId, tags.id))
    .where(and(eq(entityTags.entityId, entityId), eq(entityTags.entityType, entityType)));
  return rows.map((r) => r.tag);
}

// Helper: sync tags for an entity
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

const suiteColumns = {
  id: testSuites.id,
  name: testSuites.name,
  description: testSuites.description,
  createdBy: testSuites.createdBy,
  updatedBy: testSuites.updatedBy,
  createdAt: testSuites.createdAt,
  updatedAt: testSuites.updatedAt,
  createdByName: createdByUser.displayName,
  updatedByName: updatedByUser.displayName,
} as const;

// Base query with user joins
function suitesBaseQuery() {
  return db
    .select(suiteColumns)
    .from(testSuites)
    .leftJoin(createdByUser, eq(testSuites.createdBy, createdByUser.id))
    .leftJoin(updatedByUser, eq(testSuites.updatedBy, updatedByUser.id));
}

// List all (with tags + user names) — supports search, filter, sort, pagination
router.get("/", async (req, res) => {
  const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
  const tagId = typeof req.query.tagId === "string" ? req.query.tagId : "";
  const sortBy = typeof req.query.sortBy === "string" ? req.query.sortBy : "createdAt";
  const sortDir = req.query.sortDir === "asc" ? "asc" : "desc";
  const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? "10"), 10) || 10));

  // If filtering by tag, get matching entity IDs first
  let tagFilterIds: string[] | null = null;
  if (tagId) {
    const tagRows = await db
      .select({ entityId: entityTags.entityId })
      .from(entityTags)
      .where(and(eq(entityTags.tagId, tagId), eq(entityTags.entityType, "test_suite")));
    tagFilterIds = tagRows.map((r) => r.entityId);
    if (tagFilterIds.length === 0) {
      res.json({ data: [], total: 0, page, limit });
      return;
    }
  }

  // Build conditions
  const conditions = [];
  if (search) {
    conditions.push(or(ilike(testSuites.name, `%${search}%`), ilike(testSuites.description, `%${search}%`)));
  }
  if (tagFilterIds) {
    conditions.push(inArray(testSuites.id, tagFilterIds));
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  // Sort
  const sortColumn = sortBy === "name" ? testSuites.name : sortBy === "updatedAt" ? testSuites.updatedAt : testSuites.createdAt;
  const orderFn = sortDir === "asc" ? asc : desc;

  // Count
  const [{ count: total }] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(testSuites)
    .where(where);

  // Query
  const offset = (page - 1) * limit;
  const suites = await suitesBaseQuery()
    .where(where)
    .orderBy(orderFn(sortColumn))
    .limit(limit)
    .offset(offset);

  const result = await Promise.all(
    suites.map(async (suite) => ({
      ...suite,
      tags: await getTagsForEntity(suite.id, "test_suite"),
    })),
  );

  res.json({ data: result, total, page, limit });
});

// Get by ID (with tags + user names)
router.get("/:id", async (req, res) => {
  const [suite] = await suitesBaseQuery().where(eq(testSuites.id, req.params.id));
  if (!suite) {
    res.status(404).json({ error: "Test suite not found" });
    return;
  }
  res.json({ ...suite, tags: await getTagsForEntity(suite.id, "test_suite") });
});

// Create (with tags)
router.post("/", async (req, res) => {
  const { tagIds, ...body } = req.body;
  const parsed = insertTestSuiteSchema.safeParse(body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    return;
  }
  const userId = req.session.userId;
  const [inserted] = await db
    .insert(testSuites)
    .values({ ...parsed.data, createdBy: userId, updatedBy: userId })
    .returning();
  if (Array.isArray(tagIds) && tagIds.length > 0) {
    await syncEntityTags(inserted.id, "test_suite", tagIds, userId);
  }
  const [suite] = await suitesBaseQuery().where(eq(testSuites.id, inserted.id));
  res.status(201).json({ ...suite, tags: await getTagsForEntity(suite.id, "test_suite") });
});

// Update (with tags)
router.put("/:id", async (req, res) => {
  const { tagIds, ...body } = req.body;
  const parsed = insertTestSuiteSchema.safeParse(body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    return;
  }
  const userId = req.session.userId;
  const [updated] = await db
    .update(testSuites)
    .set({ ...parsed.data, updatedBy: userId, updatedAt: new Date() })
    .where(eq(testSuites.id, req.params.id))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Test suite not found" });
    return;
  }
  if (Array.isArray(tagIds)) {
    await syncEntityTags(updated.id, "test_suite", tagIds, userId);
  }
  const [suite] = await suitesBaseQuery().where(eq(testSuites.id, updated.id));
  res.json({ ...suite, tags: await getTagsForEntity(suite.id, "test_suite") });
});

// Delete (cascade entity_tags via FK)
router.delete("/:id", async (req, res) => {
  await db
    .delete(entityTags)
    .where(and(eq(entityTags.entityId, req.params.id), eq(entityTags.entityType, "test_suite")));
  const [deleted] = await db
    .delete(testSuites)
    .where(eq(testSuites.id, req.params.id))
    .returning({ id: testSuites.id });
  if (!deleted) {
    res.status(404).json({ error: "Test suite not found" });
    return;
  }
  res.status(204).send();
});

export default router;