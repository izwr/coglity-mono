import { type Router as RouterType, Router } from "express";
import { eq, and } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { testCases, insertTestCaseSchema, testSuites, tags, entityTags, users, type EntityTagEntityType } from "@coglity/shared/schema";
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

const caseColumns = {
  id: testCases.id,
  testSuiteId: testCases.testSuiteId,
  title: testCases.title,
  testSteps: testCases.testSteps,
  data: testCases.data,
  expectedResults: testCases.expectedResults,
  createdBy: testCases.createdBy,
  updatedBy: testCases.updatedBy,
  createdAt: testCases.createdAt,
  updatedAt: testCases.updatedAt,
  createdByName: createdByUser.displayName,
  updatedByName: updatedByUser.displayName,
  testSuiteName: testSuites.name,
} as const;

// Base query with user + test suite joins
function casesBaseQuery() {
  return db
    .select(caseColumns)
    .from(testCases)
    .innerJoin(testSuites, eq(testCases.testSuiteId, testSuites.id))
    .leftJoin(createdByUser, eq(testCases.createdBy, createdByUser.id))
    .leftJoin(updatedByUser, eq(testCases.updatedBy, updatedByUser.id));
}

// List all (with tags + user names), optionally filtered by testSuiteId
router.get("/", async (req, res) => {
  const suiteId = typeof req.query.testSuiteId === "string" ? req.query.testSuiteId : null;
  const cases = suiteId
    ? await casesBaseQuery().where(eq(testCases.testSuiteId, suiteId)).orderBy(testCases.createdAt)
    : await casesBaseQuery().orderBy(testCases.createdAt);
  const result = await Promise.all(
    cases.map(async (tc) => ({
      ...tc,
      tags: await getTagsForEntity(tc.id, "test_case"),
    })),
  );
  res.json(result);
});

// Get by ID (with tags + user names)
router.get("/:id", async (req, res) => {
  const [tc] = await casesBaseQuery().where(eq(testCases.id, req.params.id));
  if (!tc) {
    res.status(404).json({ error: "Test case not found" });
    return;
  }
  res.json({ ...tc, tags: await getTagsForEntity(tc.id, "test_case") });
});

// Create (with tags)
router.post("/", async (req, res) => {
  const { tagIds, ...body } = req.body;
  const parsed = insertTestCaseSchema.safeParse(body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    return;
  }
  const userId = req.session.userId;
  const [inserted] = await db
    .insert(testCases)
    .values({ ...parsed.data, createdBy: userId, updatedBy: userId })
    .returning();
  if (Array.isArray(tagIds) && tagIds.length > 0) {
    await syncEntityTags(inserted.id, "test_case", tagIds, userId);
  }
  const [tc] = await casesBaseQuery().where(eq(testCases.id, inserted.id));
  res.status(201).json({ ...tc, tags: await getTagsForEntity(tc.id, "test_case") });
});

// Update (with tags) — testSuiteId is immutable after creation
router.put("/:id", async (req, res) => {
  const { tagIds, testSuiteId: _ignored, ...body } = req.body;
  const parsed = insertTestCaseSchema.omit({ testSuiteId: true }).safeParse(body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    return;
  }
  const userId = req.session.userId;
  const [updated] = await db
    .update(testCases)
    .set({ ...parsed.data, updatedBy: userId, updatedAt: new Date() })
    .where(eq(testCases.id, req.params.id))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Test case not found" });
    return;
  }
  if (Array.isArray(tagIds)) {
    await syncEntityTags(updated.id, "test_case", tagIds, userId);
  }
  const [tc] = await casesBaseQuery().where(eq(testCases.id, updated.id));
  res.json({ ...tc, tags: await getTagsForEntity(tc.id, "test_case") });
});

// Delete (cascade entity_tags)
router.delete("/:id", async (req, res) => {
  await db
    .delete(entityTags)
    .where(and(eq(entityTags.entityId, req.params.id), eq(entityTags.entityType, "test_case")));
  const [deleted] = await db
    .delete(testCases)
    .where(eq(testCases.id, req.params.id))
    .returning({ id: testCases.id });
  if (!deleted) {
    res.status(404).json({ error: "Test case not found" });
    return;
  }
  res.status(204).send();
});

export default router;
