import { type Router as RouterType, Router } from "express";
import { eq, desc, asc, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import {
  scheduledTestSuites, insertScheduledTestSuiteSchema,
  scheduledTestCases, updateScheduledTestCaseSchema,
  testSuites, testCases, users, bugs,
} from "@coglity/shared/schema";
import { db } from "../db.js";

const router: RouterType = Router();

const createdByUser = alias(users, "createdByUser");
const assignedToUser = alias(users, "assignedToUser");

// ── DTO builders ────────────────────────────────────────────────

async function buildSuiteDTO(row: typeof scheduledTestSuites.$inferSelect & { testSuiteName: string | null; createdByName: string | null }) {
  // Count scheduled cases + aggregate states
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

async function buildCaseDTO(sc: typeof scheduledTestCases.$inferSelect & { assignedToName: string | null }) {
  // Join test case details
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
    .where(eq(testCases.id, sc.testCaseId));

  // Resolve linked bug titles
  let linkedBugs: { id: string; title: string }[] = [];
  if (sc.linkedBugIds && (sc.linkedBugIds as string[]).length > 0) {
    const rows = await db
      .select({ id: bugs.id, title: bugs.title })
      .from(bugs);
    const bugMap = new Map(rows.map((b) => [b.id, b.title]));
    linkedBugs = (sc.linkedBugIds as string[])
      .filter((id) => bugMap.has(id))
      .map((id) => ({ id, title: bugMap.get(id)! }));
  }

  return {
    ...sc,
    // Flat-merge test case fields
    title: tc?.title ?? null,
    preCondition: tc?.preCondition ?? null,
    testSteps: tc?.testSteps ?? null,
    data: tc?.data ?? null,
    expectedResults: tc?.expectedResults ?? null,
    testCaseStatus: tc?.status ?? null,
    linkedBugs,
  };
}

// ── Scheduled Test Suite CRUD ───────────────────────────────────

const suiteColumns = {
  id: scheduledTestSuites.id,
  testSuiteId: scheduledTestSuites.testSuiteId,
  startDate: scheduledTestSuites.startDate,
  endDate: scheduledTestSuites.endDate,
  createdBy: scheduledTestSuites.createdBy,
  createdAt: scheduledTestSuites.createdAt,
  updatedAt: scheduledTestSuites.updatedAt,
  testSuiteName: testSuites.name,
  createdByName: createdByUser.displayName,
} as const;

function suitesBaseQuery() {
  return db
    .select(suiteColumns)
    .from(scheduledTestSuites)
    .innerJoin(testSuites, eq(scheduledTestSuites.testSuiteId, testSuites.id))
    .leftJoin(createdByUser, eq(scheduledTestSuites.createdBy, createdByUser.id));
}

// List
router.get("/", async (req, res) => {
  const sortBy = typeof req.query.sortBy === "string" ? req.query.sortBy : "createdAt";
  const sortDir = req.query.sortDir === "asc" ? "asc" : "desc";
  const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? "10"), 10) || 10));

  const sortColumn = sortBy === "startDate" ? scheduledTestSuites.startDate : sortBy === "endDate" ? scheduledTestSuites.endDate : scheduledTestSuites.createdAt;
  const orderFn = sortDir === "asc" ? asc : desc;

  const [{ count: total }] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(scheduledTestSuites);

  const offset = (page - 1) * limit;
  const rows = await suitesBaseQuery()
    .orderBy(orderFn(sortColumn))
    .limit(limit)
    .offset(offset);

  const data = await Promise.all(rows.map(buildSuiteDTO));
  res.json({ data, total, page, limit });
});

// Get by ID (with scheduled cases)
router.get("/:id", async (req, res) => {
  const [row] = await suitesBaseQuery().where(eq(scheduledTestSuites.id, req.params.id));
  if (!row) {
    res.status(404).json({ error: "Scheduled test suite not found" });
    return;
  }
  const suite = await buildSuiteDTO(row);

  // Get all scheduled cases for this suite
  const caseRows = await db
    .select({
      id: scheduledTestCases.id,
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
    .where(eq(scheduledTestCases.scheduledTestSuiteId, req.params.id))
    .orderBy(asc(scheduledTestCases.createdAt));

  const cases = await Promise.all(caseRows.map(buildCaseDTO));
  res.json({ ...suite, scheduledCases: cases });
});

// Create
router.post("/", async (req, res) => {
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
    .values({ ...parsed.data, createdBy: userId })
    .returning();

  // Auto-populate scheduled cases from all active test cases in the suite
  const activeCases = await db
    .select({ id: testCases.id })
    .from(testCases)
    .where(eq(testCases.testSuiteId, parsed.data.testSuiteId));

  if (activeCases.length > 0) {
    await db.insert(scheduledTestCases).values(
      activeCases.map((tc) => ({
        scheduledTestSuiteId: inserted.id,
        testCaseId: tc.id,
      })),
    );
  }

  const [row] = await suitesBaseQuery().where(eq(scheduledTestSuites.id, inserted.id));
  const suite = await buildSuiteDTO(row);
  res.status(201).json(suite);
});

// Update suite dates
router.put("/:id", async (req, res) => {
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
    .where(eq(scheduledTestSuites.id, req.params.id))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Scheduled test suite not found" });
    return;
  }
  const [row] = await suitesBaseQuery().where(eq(scheduledTestSuites.id, updated.id));
  res.json(await buildSuiteDTO(row));
});

// Delete
router.delete("/:id", async (req, res) => {
  const [deleted] = await db
    .delete(scheduledTestSuites)
    .where(eq(scheduledTestSuites.id, req.params.id))
    .returning({ id: scheduledTestSuites.id });
  if (!deleted) {
    res.status(404).json({ error: "Scheduled test suite not found" });
    return;
  }
  res.status(204).send();
});

// ── Scheduled Test Case endpoints ──────────────────────────────

// Get a single scheduled test case (merged DTO)
router.get("/:suiteId/cases/:caseId", async (req, res) => {
  const [row] = await db
    .select({
      id: scheduledTestCases.id,
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
    .where(eq(scheduledTestCases.id, req.params.caseId));

  if (!row) {
    res.status(404).json({ error: "Scheduled test case not found" });
    return;
  }

  // Also include suite info
  const [suite] = await suitesBaseQuery().where(eq(scheduledTestSuites.id, req.params.suiteId));
  const caseDTO = await buildCaseDTO(row);
  res.json({
    ...caseDTO,
    testSuiteName: suite?.testSuiteName ?? null,
    startDate: suite?.startDate ?? null,
    endDate: suite?.endDate ?? null,
  });
});

// Update a scheduled test case (state, assignedTo, actualResults, linkedBugIds)
router.put("/:suiteId/cases/:caseId", async (req, res) => {
  const parsed = updateScheduledTestCaseSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    return;
  }
  const [updated] = await db
    .update(scheduledTestCases)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(scheduledTestCases.id, req.params.caseId))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Scheduled test case not found" });
    return;
  }

  // Return full DTO
  const [row] = await db
    .select({
      id: scheduledTestCases.id,
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

  res.json(await buildCaseDTO(row));
});

export default router;