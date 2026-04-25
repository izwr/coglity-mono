import { type Router as RouterType, Router } from "express";
import { eq, and, or, ilike, desc, asc, sql, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { testCases, insertTestCaseSchema, testSuites, tags, entityTags, users, type EntityTagEntityType } from "@coglity/shared/schema";
import { db as rootDb } from "../db.js";

const router: RouterType = Router({ mergeParams: true });

type DbHandle = typeof rootDb;

const createdByUser = alias(users, "createdByUser");
const updatedByUser = alias(users, "updatedByUser");

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

const caseColumns = {
  id: testCases.id,
  projectId: testCases.projectId,
  testSuiteId: testCases.testSuiteId,
  title: testCases.title,
  preCondition: testCases.preCondition,
  testSteps: testCases.testSteps,
  data: testCases.data,
  expectedResults: testCases.expectedResults,
  status: testCases.status,
  testCaseType: testCases.testCaseType,
  botConnectionId: testCases.botConnectionId,
  createdBy: testCases.createdBy,
  updatedBy: testCases.updatedBy,
  createdAt: testCases.createdAt,
  updatedAt: testCases.updatedAt,
  createdByName: createdByUser.displayName,
  updatedByName: updatedByUser.displayName,
  testSuiteName: testSuites.name,
} as const;

function casesBaseQuery(db: DbHandle) {
  return db
    .select(caseColumns)
    .from(testCases)
    .innerJoin(testSuites, eq(testCases.testSuiteId, testSuites.id))
    .leftJoin(createdByUser, eq(testCases.createdBy, createdByUser.id))
    .leftJoin(updatedByUser, eq(testCases.updatedBy, updatedByUser.id));
}

router.get("/", async (req, res) => {
  const db = (req.db ?? rootDb) as DbHandle;
  const projectId = req.projectId!;
  const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
  const suiteId = typeof req.query.testSuiteId === "string" ? req.query.testSuiteId : "";
  const status = typeof req.query.status === "string" ? req.query.status : "";
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
      .innerJoin(testCases, eq(entityTags.entityId, testCases.id))
      .where(
        and(
          eq(entityTags.tagId, tagId),
          eq(entityTags.entityType, "test_case"),
          eq(testCases.projectId, projectId),
        ),
      );
    tagFilterIds = tagRows.map((r) => r.entityId);
    if (tagFilterIds.length === 0) {
      res.json({ data: [], total: 0, page, limit });
      return;
    }
  }

  const conditions = [eq(testCases.projectId, projectId)];
  if (search) conditions.push(or(ilike(testCases.title, `%${search}%`), ilike(testSuites.name, `%${search}%`))!);
  if (suiteId) conditions.push(eq(testCases.testSuiteId, suiteId));
  if (status === "draft" || status === "active") conditions.push(eq(testCases.status, status));
  if (tagFilterIds) conditions.push(inArray(testCases.id, tagFilterIds));
  const where = and(...conditions);

  const sortColumn = sortBy === "title" ? testCases.title : sortBy === "updatedAt" ? testCases.updatedAt : testCases.createdAt;
  const orderFn = sortDir === "asc" ? asc : desc;

  const [{ count: total }] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(testCases)
    .innerJoin(testSuites, eq(testCases.testSuiteId, testSuites.id))
    .where(where);

  const offset = (page - 1) * limit;
  const cases = await casesBaseQuery(db)
    .where(where)
    .orderBy(orderFn(sortColumn))
    .limit(limit)
    .offset(offset);

  const result = await Promise.all(
    cases.map(async (tc) => ({
      ...tc,
      tags: await getTagsForEntity(db, tc.id, "test_case"),
    })),
  );

  res.json({ data: result, total, page, limit });
});

router.get("/:id", async (req, res) => {
  const db = (req.db ?? rootDb) as DbHandle;
  const projectId = req.projectId!;
  const [tc] = await casesBaseQuery(db).where(
    and(eq(testCases.id, req.params.id as string), eq(testCases.projectId, projectId)),
  );
  if (!tc) {
    res.status(404).json({ error: "Test case not found" });
    return;
  }
  res.json({ ...tc, tags: await getTagsForEntity(db, tc.id, "test_case") });
});

router.post("/", async (req, res) => {
  const db = (req.db ?? rootDb) as DbHandle;
  const projectId = req.projectId!;
  const { tagIds, ...body } = req.body;
  const parsed = insertTestCaseSchema.safeParse(body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    return;
  }
  const userId = req.session.userId;
  const [inserted] = await db
    .insert(testCases)
    .values({ ...parsed.data, projectId, createdBy: userId, updatedBy: userId })
    .returning();
  if (Array.isArray(tagIds) && tagIds.length > 0) {
    await syncEntityTags(db, inserted.id, "test_case", tagIds, userId);
  }
  const [tc] = await casesBaseQuery(db).where(eq(testCases.id, inserted.id));
  res.status(201).json({ ...tc, tags: await getTagsForEntity(db, tc.id, "test_case") });
});

router.put("/:id", async (req, res) => {
  const db = (req.db ?? rootDb) as DbHandle;
  const projectId = req.projectId!;
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
    .where(and(eq(testCases.id, req.params.id as string), eq(testCases.projectId, projectId)))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Test case not found" });
    return;
  }
  if (Array.isArray(tagIds)) {
    await syncEntityTags(db, updated.id, "test_case", tagIds, userId);
  }
  const [tc] = await casesBaseQuery(db).where(eq(testCases.id, updated.id));
  res.json({ ...tc, tags: await getTagsForEntity(db, tc.id, "test_case") });
});

router.delete("/:id", async (req, res) => {
  const db = (req.db ?? rootDb) as DbHandle;
  const projectId = req.projectId!;
  await db
    .delete(entityTags)
    .where(and(eq(entityTags.entityId, req.params.id as string), eq(entityTags.entityType, "test_case")));
  const [deleted] = await db
    .delete(testCases)
    .where(and(eq(testCases.id, req.params.id as string), eq(testCases.projectId, projectId)))
    .returning({ id: testCases.id });
  if (!deleted) {
    res.status(404).json({ error: "Test case not found" });
    return;
  }
  res.status(204).send();
});

export default router;
