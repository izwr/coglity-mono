import { type Router as RouterType, Router } from "express";
import { eq, and, or, ilike, desc, asc, sql, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { testSuites, insertTestSuiteSchema, tags, entityTags, users, type EntityTagEntityType } from "@coglity/shared/schema";
import { db as rootDb } from "../db.js";

const router: RouterType = Router({ mergeParams: true });

const createdByUser = alias(users, "createdByUser");
const updatedByUser = alias(users, "updatedByUser");

type DbHandle = typeof rootDb;

async function getTagsForEntity(db: DbHandle, entityId: string, entityType: EntityTagEntityType) {
  const rows = await db
    .select({ tag: tags })
    .from(entityTags)
    .innerJoin(tags, eq(entityTags.tagId, tags.id))
    .where(and(eq(entityTags.entityId, entityId), eq(entityTags.entityType, entityType)));
  return rows.map((r) => r.tag);
}

async function syncEntityTags(
  db: DbHandle,
  entityId: string,
  entityType: EntityTagEntityType,
  tagIds: string[],
  userId?: string,
) {
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
  projectId: testSuites.projectId,
  name: testSuites.name,
  description: testSuites.description,
  createdBy: testSuites.createdBy,
  updatedBy: testSuites.updatedBy,
  createdAt: testSuites.createdAt,
  updatedAt: testSuites.updatedAt,
  createdByName: createdByUser.displayName,
  updatedByName: updatedByUser.displayName,
} as const;

function suitesBaseQuery(db: DbHandle) {
  return db
    .select(suiteColumns)
    .from(testSuites)
    .leftJoin(createdByUser, eq(testSuites.createdBy, createdByUser.id))
    .leftJoin(updatedByUser, eq(testSuites.updatedBy, updatedByUser.id));
}

// List
router.get("/", async (req, res) => {
  const db = (req.db ?? rootDb) as DbHandle;
  const projectId = req.projectId!;
  const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
  const tagId = typeof req.query.tagId === "string" ? req.query.tagId : "";
  const sortBy = typeof req.query.sortBy === "string" ? req.query.sortBy : "createdAt";
  const sortDir = req.query.sortDir === "asc" ? "asc" : "desc";
  const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? "10"), 10) || 10));

  let tagFilterIds: string[] | null = null;
  if (tagId) {
    const tagRows = await db
      .select({ entityId: entityTags.entityId })
      .from(entityTags)
      .innerJoin(testSuites, eq(entityTags.entityId, testSuites.id))
      .where(
        and(
          eq(entityTags.tagId, tagId),
          eq(entityTags.entityType, "test_suite"),
          eq(testSuites.projectId, projectId),
        ),
      );
    tagFilterIds = tagRows.map((r) => r.entityId);
    if (tagFilterIds.length === 0) {
      res.json({ data: [], total: 0, page, limit });
      return;
    }
  }

  const conditions = [eq(testSuites.projectId, projectId)];
  if (search) {
    conditions.push(or(ilike(testSuites.name, `%${search}%`), ilike(testSuites.description, `%${search}%`))!);
  }
  if (tagFilterIds) conditions.push(inArray(testSuites.id, tagFilterIds));
  const where = and(...conditions);

  const sortColumn = sortBy === "name" ? testSuites.name : sortBy === "updatedAt" ? testSuites.updatedAt : testSuites.createdAt;
  const orderFn = sortDir === "asc" ? asc : desc;

  const [{ count: total }] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(testSuites)
    .where(where);

  const offset = (page - 1) * limit;
  const suites = await suitesBaseQuery(db)
    .where(where)
    .orderBy(orderFn(sortColumn))
    .limit(limit)
    .offset(offset);

  const result = await Promise.all(
    suites.map(async (suite) => ({
      ...suite,
      tags: await getTagsForEntity(db, suite.id, "test_suite"),
    })),
  );

  res.json({ data: result, total, page, limit });
});

// Get by ID
router.get("/:id", async (req, res) => {
  const db = (req.db ?? rootDb) as DbHandle;
  const projectId = req.projectId!;
  const [suite] = await suitesBaseQuery(db).where(
    and(eq(testSuites.id, req.params.id as string), eq(testSuites.projectId, projectId)),
  );
  if (!suite) {
    res.status(404).json({ error: "Test suite not found" });
    return;
  }
  res.json({ ...suite, tags: await getTagsForEntity(db, suite.id, "test_suite") });
});

// Create
router.post("/", async (req, res) => {
  const db = (req.db ?? rootDb) as DbHandle;
  const projectId = req.projectId!;
  const { tagIds, ...body } = req.body;
  const parsed = insertTestSuiteSchema.safeParse(body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    return;
  }
  const userId = req.session.userId;
  const [inserted] = await db
    .insert(testSuites)
    .values({ ...parsed.data, projectId, createdBy: userId, updatedBy: userId })
    .returning();
  if (Array.isArray(tagIds) && tagIds.length > 0) {
    await syncEntityTags(db, inserted.id, "test_suite", tagIds, userId);
  }
  const [suite] = await suitesBaseQuery(db).where(eq(testSuites.id, inserted.id));
  res.status(201).json({ ...suite, tags: await getTagsForEntity(db, suite.id, "test_suite") });
});

// Update
router.put("/:id", async (req, res) => {
  const db = (req.db ?? rootDb) as DbHandle;
  const projectId = req.projectId!;
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
    .where(and(eq(testSuites.id, req.params.id as string), eq(testSuites.projectId, projectId)))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Test suite not found" });
    return;
  }
  if (Array.isArray(tagIds)) {
    await syncEntityTags(db, updated.id, "test_suite", tagIds, userId);
  }
  const [suite] = await suitesBaseQuery(db).where(eq(testSuites.id, updated.id));
  res.json({ ...suite, tags: await getTagsForEntity(db, suite.id, "test_suite") });
});

// Delete
router.delete("/:id", async (req, res) => {
  const db = (req.db ?? rootDb) as DbHandle;
  const projectId = req.projectId!;
  await db
    .delete(entityTags)
    .where(and(eq(entityTags.entityId, req.params.id as string), eq(entityTags.entityType, "test_suite")));
  const [deleted] = await db
    .delete(testSuites)
    .where(and(eq(testSuites.id, req.params.id as string), eq(testSuites.projectId, projectId)))
    .returning({ id: testSuites.id });
  if (!deleted) {
    res.status(404).json({ error: "Test suite not found" });
    return;
  }
  res.status(204).send();
});

export default router;
