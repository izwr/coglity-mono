import { type Router as RouterType, Router } from "express";
import { eq, and, desc, asc, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import {
  scheduledTestSuites, insertScheduledTestSuiteSchema,
  scheduledTestCases, updateScheduledTestCaseSchema,
  testSuites, testCases, users, bugs,
} from "@coglity/shared/schema";
import { db as rootDb } from "../db.js";

const router: RouterType = Router({ mergeParams: true });

type DbHandle = typeof rootDb;

const createdByUser = alias(users, "createdByUser");
const assignedToUser = alias(users, "assignedToUser");

async function buildSuiteDTO(
  db: DbHandle,
  row: { id: string; testSuiteId: string; startDate: Date; endDate: Date; createdBy: string | null; createdAt: Date; updatedAt: Date; projectId: string; testSuiteName: string | null; createdByName: string | null },
) {
  const [stats] = await db
    .select({
      total: sql<number>`cast(count(*) as int)`,
      passed: sql<number>`cast(count(*) filter (where ${scheduledTestCases.state} = 'passed') as int)`,
      failed: sql<number>`cast(count(*) filter (where ${scheduledTestCases.state} = 'failed') as int)`,
    })
    .from(scheduledTestCases)
    .where(eq(scheduledTestCases.scheduledTestSuiteId, row.id));
  return { ...row, caseCount: stats?.total ?? 0, passedCount: stats?.passed ?? 0, failedCount: stats?.failed ?? 0 };
}

async function buildCaseDTO(
  db: DbHandle,
  projectId: string,
  sc: { id: string; scheduledTestSuiteId: string; testCaseId: string; assignedTo: string | null; actualResults: string; state: string; linkedBugIds: string[]; createdAt: Date; updatedAt: Date; projectId: string; assignedToName: string | null },
) {
  const [tc] = await db
    .select({
      title: testCases.title,
      preCondition: testCases.preCondition,
      testSteps: testCases.testSteps,
      data: testCases.data,
      expectedResults: testCases.expectedResults,
      status: testCases.status,
    })
    .from(testCases)
    .where(and(eq(testCases.id, sc.testCaseId), eq(testCases.projectId, projectId)));

  let linkedBugs: { id: string; title: string }[] = [];
  if (sc.linkedBugIds && sc.linkedBugIds.length > 0) {
    const rows = await db
      .select({ id: bugs.id, title: bugs.title })
      .from(bugs)
      .where(eq(bugs.projectId, projectId));
    const bugMap = new Map(rows.map((b) => [b.id, b.title]));
    linkedBugs = sc.linkedBugIds
      .filter((id) => bugMap.has(id))
      .map((id) => ({ id, title: bugMap.get(id)! }));
  }

  return {
    ...sc,
    title: tc?.title ?? null,
    preCondition: tc?.preCondition ?? null,
    testSteps: tc?.testSteps ?? null,
    data: tc?.data ?? null,
    expectedResults: tc?.expectedResults ?? null,
    testCaseStatus: tc?.status ?? null,
    linkedBugs,
  };
}

const suiteColumns = {
  id: scheduledTestSuites.id,
  projectId: scheduledTestSuites.projectId,
  testSuiteId: scheduledTestSuites.testSuiteId,
  startDate: scheduledTestSuites.startDate,
  endDate: scheduledTestSuites.endDate,
  createdBy: scheduledTestSuites.createdBy,
  createdAt: scheduledTestSuites.createdAt,
  updatedAt: scheduledTestSuites.updatedAt,
  testSuiteName: testSuites.name,
  createdByName: createdByUser.displayName,
} as const;

function suitesBaseQuery(db: DbHandle) {
  return db
    .select(suiteColumns)
    .from(scheduledTestSuites)
    .innerJoin(testSuites, eq(scheduledTestSuites.testSuiteId, testSuites.id))
    .leftJoin(createdByUser, eq(scheduledTestSuites.createdBy, createdByUser.id));
}

router.get("/", async (req, res) => {
  const db = (req.db ?? rootDb) as DbHandle;
  const projectId = req.projectId!;
  const sortBy = typeof req.query.sortBy === "string" ? req.query.sortBy : "createdAt";
  const sortDir = req.query.sortDir === "asc" ? "asc" : "desc";
  const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? "10"), 10) || 10));

  const sortColumn = sortBy === "startDate" ? scheduledTestSuites.startDate : sortBy === "endDate" ? scheduledTestSuites.endDate : scheduledTestSuites.createdAt;
  const orderFn = sortDir === "asc" ? asc : desc;

  const [{ count: total }] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(scheduledTestSuites)
    .where(eq(scheduledTestSuites.projectId, projectId));

  const offset = (page - 1) * limit;
  const rows = await suitesBaseQuery(db)
    .where(eq(scheduledTestSuites.projectId, projectId))
    .orderBy(orderFn(sortColumn))
    .limit(limit)
    .offset(offset);

  const data = await Promise.all(rows.map((r) => buildSuiteDTO(db, r)));
  res.json({ data, total, page, limit });
});

router.get("/:id", async (req, res) => {
  const db = (req.db ?? rootDb) as DbHandle;
  const projectId = req.projectId!;
  const [row] = await suitesBaseQuery(db).where(
    and(eq(scheduledTestSuites.id, req.params.id as string), eq(scheduledTestSuites.projectId, projectId)),
  );
  if (!row) {
    res.status(404).json({ error: "Scheduled test suite not found" });
    return;
  }
  const suite = await buildSuiteDTO(db, row);

  const caseRows = await db
    .select({
      id: scheduledTestCases.id,
      projectId: scheduledTestCases.projectId,
      scheduledTestSuiteId: scheduledTestCases.scheduledTestSuiteId,
      testCaseId: scheduledTestCases.testCaseId,
      assignedTo: scheduledTestCases.assignedTo,
      actualResults: scheduledTestCases.actualResults,
      state: scheduledTestCases.state,
      linkedBugIds: scheduledTestCases.linkedBugIds,
      createdAt: scheduledTestCases.createdAt,
      updatedAt: scheduledTestCases.updatedAt,
      assignedToName: assignedToUser.displayName,
    })
    .from(scheduledTestCases)
    .leftJoin(assignedToUser, eq(scheduledTestCases.assignedTo, assignedToUser.id))
    .where(
      and(
        eq(scheduledTestCases.scheduledTestSuiteId, req.params.id as string),
        eq(scheduledTestCases.projectId, projectId),
      ),
    )
    .orderBy(asc(scheduledTestCases.createdAt));

  const cases = await Promise.all(caseRows.map((r) => buildCaseDTO(db, projectId, r)));
  res.json({ ...suite, scheduledCases: cases });
});

router.post("/", async (req, res) => {
  const db = (req.db ?? rootDb) as DbHandle;
  const projectId = req.projectId!;
  const parsed = insertScheduledTestSuiteSchema.safeParse({
    ...req.body,
    startDate: req.body.startDate ? new Date(req.body.startDate) : undefined,
    endDate: req.body.endDate ? new Date(req.body.endDate) : undefined,
  });
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    return;
  }
  const userId = req.session.userId;
  const [inserted] = await db
    .insert(scheduledTestSuites)
    .values({ ...parsed.data, projectId, createdBy: userId })
    .returning();

  const activeCases = await db
    .select({ id: testCases.id })
    .from(testCases)
    .where(and(eq(testCases.testSuiteId, parsed.data.testSuiteId), eq(testCases.projectId, projectId)));

  if (activeCases.length > 0) {
    await db.insert(scheduledTestCases).values(
      activeCases.map((tc) => ({
        scheduledTestSuiteId: inserted.id,
        testCaseId: tc.id,
        projectId,
      })),
    );
  }

  const [row] = await suitesBaseQuery(db).where(eq(scheduledTestSuites.id, inserted.id));
  const suite = await buildSuiteDTO(db, row);
  res.status(201).json(suite);
});

router.put("/:id", async (req, res) => {
  const db = (req.db ?? rootDb) as DbHandle;
  const projectId = req.projectId!;
  const parsed = insertScheduledTestSuiteSchema.partial().safeParse({
    ...req.body,
    startDate: req.body.startDate ? new Date(req.body.startDate) : undefined,
    endDate: req.body.endDate ? new Date(req.body.endDate) : undefined,
  });
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    return;
  }
  const [updated] = await db
    .update(scheduledTestSuites)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(and(eq(scheduledTestSuites.id, req.params.id as string), eq(scheduledTestSuites.projectId, projectId)))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Scheduled test suite not found" });
    return;
  }
  const [row] = await suitesBaseQuery(db).where(eq(scheduledTestSuites.id, updated.id));
  res.json(await buildSuiteDTO(db, row));
});

router.delete("/:id", async (req, res) => {
  const db = (req.db ?? rootDb) as DbHandle;
  const projectId = req.projectId!;
  const [deleted] = await db
    .delete(scheduledTestSuites)
    .where(and(eq(scheduledTestSuites.id, req.params.id as string), eq(scheduledTestSuites.projectId, projectId)))
    .returning({ id: scheduledTestSuites.id });
  if (!deleted) {
    res.status(404).json({ error: "Scheduled test suite not found" });
    return;
  }
  res.status(204).send();
});

router.get("/:suiteId/cases/:caseId", async (req, res) => {
  const db = (req.db ?? rootDb) as DbHandle;
  const projectId = req.projectId!;
  const [row] = await db
    .select({
      id: scheduledTestCases.id,
      projectId: scheduledTestCases.projectId,
      scheduledTestSuiteId: scheduledTestCases.scheduledTestSuiteId,
      testCaseId: scheduledTestCases.testCaseId,
      assignedTo: scheduledTestCases.assignedTo,
      actualResults: scheduledTestCases.actualResults,
      state: scheduledTestCases.state,
      linkedBugIds: scheduledTestCases.linkedBugIds,
      createdAt: scheduledTestCases.createdAt,
      updatedAt: scheduledTestCases.updatedAt,
      assignedToName: assignedToUser.displayName,
    })
    .from(scheduledTestCases)
    .leftJoin(assignedToUser, eq(scheduledTestCases.assignedTo, assignedToUser.id))
    .where(and(eq(scheduledTestCases.id, req.params.caseId as string), eq(scheduledTestCases.projectId, projectId)));

  if (!row) {
    res.status(404).json({ error: "Scheduled test case not found" });
    return;
  }

  const [suite] = await suitesBaseQuery(db).where(
    and(eq(scheduledTestSuites.id, req.params.suiteId as string), eq(scheduledTestSuites.projectId, projectId)),
  );
  const caseDTO = await buildCaseDTO(db, projectId, row);
  res.json({
    ...caseDTO,
    testSuiteName: suite?.testSuiteName ?? null,
    startDate: suite?.startDate ?? null,
    endDate: suite?.endDate ?? null,
  });
});

router.put("/:suiteId/cases/:caseId", async (req, res) => {
  const db = (req.db ?? rootDb) as DbHandle;
  const projectId = req.projectId!;
  const parsed = updateScheduledTestCaseSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    return;
  }
  const [updated] = await db
    .update(scheduledTestCases)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(and(eq(scheduledTestCases.id, req.params.caseId as string), eq(scheduledTestCases.projectId, projectId)))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Scheduled test case not found" });
    return;
  }

  const [row] = await db
    .select({
      id: scheduledTestCases.id,
      projectId: scheduledTestCases.projectId,
      scheduledTestSuiteId: scheduledTestCases.scheduledTestSuiteId,
      testCaseId: scheduledTestCases.testCaseId,
      assignedTo: scheduledTestCases.assignedTo,
      actualResults: scheduledTestCases.actualResults,
      state: scheduledTestCases.state,
      linkedBugIds: scheduledTestCases.linkedBugIds,
      createdAt: scheduledTestCases.createdAt,
      updatedAt: scheduledTestCases.updatedAt,
      assignedToName: assignedToUser.displayName,
    })
    .from(scheduledTestCases)
    .leftJoin(assignedToUser, eq(scheduledTestCases.assignedTo, assignedToUser.id))
    .where(eq(scheduledTestCases.id, updated.id));

  res.json(await buildCaseDTO(db, projectId, row));
});

export default router;
