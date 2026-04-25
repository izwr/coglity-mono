import { Router, type Router as RouterType } from "express";
import { and, eq, or, ilike, desc, asc, sql, inArray, isNull } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import {
  testSuites,
  testCases,
  tags,
  bugs,
  scheduledTestSuites,
  scheduledTestCases,
  botConnections,
  knowledgeSources,
  testRuns,
  projects,
  users,
} from "@coglity/shared/schema";
import { db } from "../db.js";

const router: RouterType = Router({ mergeParams: true });

const createdByUser = alias(users, "createdByUser");
const updatedByUser = alias(users, "updatedByUser");
const assignedToUser = alias(users, "assignedToUser");

function paging(req: { query: { page?: unknown; limit?: unknown; sortBy?: unknown; sortDir?: unknown } }) {
  return {
    page: Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1),
    limit: Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? "10"), 10) || 10)),
    sortBy: typeof req.query.sortBy === "string" ? req.query.sortBy : "createdAt",
    sortDir: req.query.sortDir === "asc" ? ("asc" as const) : ("desc" as const),
  };
}

// ── Test Suites ────────────────────────────────────────────────
router.get("/test-suites", async (req, res) => {
  const ids = req.projectIdsScope ?? [];
  if (ids.length === 0) {
    res.json({ data: [], total: 0, page: 1, limit: 10 });
    return;
  }
  const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
  const { page, limit, sortBy, sortDir } = paging(req);

  const conditions = [inArray(testSuites.projectId, ids)];
  if (search) conditions.push(or(ilike(testSuites.name, `%${search}%`), ilike(testSuites.description, `%${search}%`))!);
  const where = and(...conditions);

  const sortCol = sortBy === "name" ? testSuites.name : sortBy === "updatedAt" ? testSuites.updatedAt : testSuites.createdAt;
  const orderFn = sortDir === "asc" ? asc : desc;

  const [{ count: total }] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(testSuites)
    .where(where);

  const data = await db
    .select({
      id: testSuites.id,
      projectId: testSuites.projectId,
      projectName: projects.name,
      name: testSuites.name,
      description: testSuites.description,
      createdBy: testSuites.createdBy,
      updatedBy: testSuites.updatedBy,
      createdAt: testSuites.createdAt,
      updatedAt: testSuites.updatedAt,
      createdByName: createdByUser.displayName,
      updatedByName: updatedByUser.displayName,
    })
    .from(testSuites)
    .innerJoin(projects, eq(testSuites.projectId, projects.id))
    .leftJoin(createdByUser, eq(testSuites.createdBy, createdByUser.id))
    .leftJoin(updatedByUser, eq(testSuites.updatedBy, updatedByUser.id))
    .where(where)
    .orderBy(orderFn(sortCol))
    .limit(limit)
    .offset((page - 1) * limit);

  res.json({ data, total, page, limit });
});

// ── Test Cases ────────────────────────────────────────────────
router.get("/test-cases", async (req, res) => {
  const ids = req.projectIdsScope ?? [];
  if (ids.length === 0) {
    res.json({ data: [], total: 0, page: 1, limit: 10 });
    return;
  }
  const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
  const status = typeof req.query.status === "string" ? req.query.status : "";
  const { page, limit, sortBy, sortDir } = paging(req);

  const testSuiteAlias = alias(testSuites, "ts");
  const conditions = [inArray(testCases.projectId, ids)];
  if (search) conditions.push(or(ilike(testCases.title, `%${search}%`), ilike(testSuiteAlias.name, `%${search}%`))!);
  if (status === "draft" || status === "active") conditions.push(eq(testCases.status, status));
  const where = and(...conditions);

  const sortCol = sortBy === "title" ? testCases.title : sortBy === "updatedAt" ? testCases.updatedAt : testCases.createdAt;
  const orderFn = sortDir === "asc" ? asc : desc;

  const [{ count: total }] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(testCases)
    .innerJoin(testSuiteAlias, eq(testCases.testSuiteId, testSuiteAlias.id))
    .where(where);

  const data = await db
    .select({
      id: testCases.id,
      projectId: testCases.projectId,
      projectName: projects.name,
      testSuiteId: testCases.testSuiteId,
      testSuiteName: testSuiteAlias.name,
      title: testCases.title,
      status: testCases.status,
      testCaseType: testCases.testCaseType,
      createdBy: testCases.createdBy,
      updatedBy: testCases.updatedBy,
      createdAt: testCases.createdAt,
      updatedAt: testCases.updatedAt,
      createdByName: createdByUser.displayName,
      updatedByName: updatedByUser.displayName,
    })
    .from(testCases)
    .innerJoin(testSuiteAlias, eq(testCases.testSuiteId, testSuiteAlias.id))
    .innerJoin(projects, eq(testCases.projectId, projects.id))
    .leftJoin(createdByUser, eq(testCases.createdBy, createdByUser.id))
    .leftJoin(updatedByUser, eq(testCases.updatedBy, updatedByUser.id))
    .where(where)
    .orderBy(orderFn(sortCol))
    .limit(limit)
    .offset((page - 1) * limit);

  res.json({ data, total, page, limit });
});

// ── Tags ────────────────────────────────────────────────
router.get("/tags", async (req, res) => {
  const ids = req.projectIdsScope ?? [];
  if (ids.length === 0) {
    res.json([]);
    return;
  }
  const data = await db
    .select({
      id: tags.id,
      projectId: tags.projectId,
      projectName: projects.name,
      name: tags.name,
      description: tags.description,
      createdBy: tags.createdBy,
      updatedBy: tags.updatedBy,
      createdAt: tags.createdAt,
      updatedAt: tags.updatedAt,
      createdByName: createdByUser.displayName,
      updatedByName: updatedByUser.displayName,
    })
    .from(tags)
    .innerJoin(projects, eq(tags.projectId, projects.id))
    .leftJoin(createdByUser, eq(tags.createdBy, createdByUser.id))
    .leftJoin(updatedByUser, eq(tags.updatedBy, updatedByUser.id))
    .where(inArray(tags.projectId, ids))
    .orderBy(tags.createdAt);
  res.json(data);
});

// ── Bugs ────────────────────────────────────────────────
router.get("/bugs", async (req, res) => {
  const ids = req.projectIdsScope ?? [];
  if (ids.length === 0) {
    res.json({ data: [], total: 0, page: 1, limit: 10 });
    return;
  }
  const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
  const state = typeof req.query.state === "string" ? req.query.state : "";
  const priority = typeof req.query.priority === "string" ? req.query.priority : "";
  const severity = typeof req.query.severity === "string" ? req.query.severity : "";
  const bugType = typeof req.query.bugType === "string" ? req.query.bugType : "";
  const { page, limit, sortBy, sortDir } = paging(req);

  const conditions = [inArray(bugs.projectId, ids)];
  if (search) conditions.push(or(ilike(bugs.title, `%${search}%`), ilike(bugs.description, `%${search}%`))!);
  if (state) conditions.push(eq(bugs.state, state as any));
  if (priority) conditions.push(eq(bugs.priority, priority as any));
  if (severity) conditions.push(eq(bugs.severity, severity as any));
  if (bugType) conditions.push(eq(bugs.bugType, bugType as any));
  const where = and(...conditions);

  const sortCol =
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

  const data = await db
    .select({
      id: bugs.id,
      projectId: bugs.projectId,
      projectName: projects.name,
      title: bugs.title,
      description: bugs.description,
      assignedTo: bugs.assignedTo,
      bugType: bugs.bugType,
      priority: bugs.priority,
      severity: bugs.severity,
      resolution: bugs.resolution,
      state: bugs.state,
      reproducibility: bugs.reproducibility,
      createdBy: bugs.createdBy,
      createdAt: bugs.createdAt,
      updatedAt: bugs.updatedAt,
      createdByName: createdByUser.displayName,
      assignedToName: assignedToUser.displayName,
    })
    .from(bugs)
    .innerJoin(projects, eq(bugs.projectId, projects.id))
    .leftJoin(createdByUser, eq(bugs.createdBy, createdByUser.id))
    .leftJoin(assignedToUser, eq(bugs.assignedTo, assignedToUser.id))
    .where(where)
    .orderBy(orderFn(sortCol))
    .limit(limit)
    .offset((page - 1) * limit);

  res.json({ data, total, page, limit });
});

// ── Scheduled test suites ─────────────────────────────
router.get("/scheduled-test-suites", async (req, res) => {
  const ids = req.projectIdsScope ?? [];
  if (ids.length === 0) {
    res.json({ data: [], total: 0, page: 1, limit: 10 });
    return;
  }
  const { page, limit, sortBy, sortDir } = paging(req);
  const sortCol = sortBy === "startDate" ? scheduledTestSuites.startDate : sortBy === "endDate" ? scheduledTestSuites.endDate : scheduledTestSuites.createdAt;
  const orderFn = sortDir === "asc" ? asc : desc;

  const where = inArray(scheduledTestSuites.projectId, ids);

  const [{ count: total }] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(scheduledTestSuites)
    .where(where);

  const rows = await db
    .select({
      id: scheduledTestSuites.id,
      projectId: scheduledTestSuites.projectId,
      projectName: projects.name,
      testSuiteId: scheduledTestSuites.testSuiteId,
      testSuiteName: testSuites.name,
      startDate: scheduledTestSuites.startDate,
      endDate: scheduledTestSuites.endDate,
      createdBy: scheduledTestSuites.createdBy,
      createdAt: scheduledTestSuites.createdAt,
      updatedAt: scheduledTestSuites.updatedAt,
      createdByName: createdByUser.displayName,
    })
    .from(scheduledTestSuites)
    .innerJoin(projects, eq(scheduledTestSuites.projectId, projects.id))
    .innerJoin(testSuites, eq(scheduledTestSuites.testSuiteId, testSuites.id))
    .leftJoin(createdByUser, eq(scheduledTestSuites.createdBy, createdByUser.id))
    .where(where)
    .orderBy(orderFn(sortCol))
    .limit(limit)
    .offset((page - 1) * limit);

  const enriched = await Promise.all(
    rows.map(async (row) => {
      const [stats] = await db
        .select({
          total: sql<number>`cast(count(*) as int)`,
          passed: sql<number>`cast(count(*) filter (where ${scheduledTestCases.state} = 'passed') as int)`,
          failed: sql<number>`cast(count(*) filter (where ${scheduledTestCases.state} = 'failed') as int)`,
        })
        .from(scheduledTestCases)
        .where(eq(scheduledTestCases.scheduledTestSuiteId, row.id));
      return { ...row, caseCount: stats?.total ?? 0, passedCount: stats?.passed ?? 0, failedCount: stats?.failed ?? 0 };
    }),
  );

  res.json({ data: enriched, total, page, limit });
});

// ── Bot connections ─────────────────────────────────
router.get("/bot-connections", async (req, res) => {
  const ids = req.projectIdsScope ?? [];
  if (ids.length === 0) {
    res.json({ data: [], total: 0, page: 1, limit: 10 });
    return;
  }
  const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
  const botType = typeof req.query.botType === "string" ? req.query.botType : "";
  const { page, limit, sortBy, sortDir } = paging(req);

  const conditions = [inArray(botConnections.projectId, ids)];
  if (search) conditions.push(ilike(botConnections.name, `%${search}%`));
  if (botType === "voice" || botType === "chat") conditions.push(eq(botConnections.botType, botType));
  const where = and(...conditions);

  const sortCol = sortBy === "name" ? botConnections.name : sortBy === "updatedAt" ? botConnections.updatedAt : botConnections.createdAt;
  const orderFn = sortDir === "asc" ? asc : desc;

  const [{ count: total }] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(botConnections)
    .where(where);

  const data = await db
    .select({
      id: botConnections.id,
      projectId: botConnections.projectId,
      projectName: projects.name,
      name: botConnections.name,
      botType: botConnections.botType,
      provider: botConnections.provider,
      config: botConnections.config,
      description: botConnections.description,
      createdBy: botConnections.createdBy,
      updatedBy: botConnections.updatedBy,
      createdAt: botConnections.createdAt,
      updatedAt: botConnections.updatedAt,
      createdByName: createdByUser.displayName,
      updatedByName: updatedByUser.displayName,
    })
    .from(botConnections)
    .innerJoin(projects, eq(botConnections.projectId, projects.id))
    .leftJoin(createdByUser, eq(botConnections.createdBy, createdByUser.id))
    .leftJoin(updatedByUser, eq(botConnections.updatedBy, updatedByUser.id))
    .where(where)
    .orderBy(orderFn(sortCol))
    .limit(limit)
    .offset((page - 1) * limit);

  res.json({ data, total, page, limit });
});

// ── Knowledge sources ─────────────────────────────────
router.get("/knowledge-sources", async (req, res) => {
  const ids = req.projectIdsScope ?? [];
  if (ids.length === 0) {
    res.json({ data: [], total: 0, page: 1, limit: 10 });
    return;
  }
  const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
  const sourceType = typeof req.query.sourceType === "string" ? req.query.sourceType : "";
  const { page, limit, sortBy, sortDir } = paging(req);

  const conditions = [inArray(knowledgeSources.projectId, ids)];
  if (search) conditions.push(ilike(knowledgeSources.name, `%${search}%`));
  if (sourceType === "pdf" || sourceType === "screen" || sourceType === "figma" || sourceType === "url") {
    conditions.push(eq(knowledgeSources.sourceType, sourceType));
  }
  const where = and(...conditions);

  const sortCol = sortBy === "name" ? knowledgeSources.name : sortBy === "updatedAt" ? knowledgeSources.updatedAt : knowledgeSources.createdAt;
  const orderFn = sortDir === "asc" ? asc : desc;

  const [{ count: total }] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(knowledgeSources)
    .where(where);

  const data = await db
    .select({
      id: knowledgeSources.id,
      projectId: knowledgeSources.projectId,
      projectName: projects.name,
      name: knowledgeSources.name,
      sourceType: knowledgeSources.sourceType,
      url: knowledgeSources.url,
      description: knowledgeSources.description,
      createdBy: knowledgeSources.createdBy,
      updatedBy: knowledgeSources.updatedBy,
      createdAt: knowledgeSources.createdAt,
      updatedAt: knowledgeSources.updatedAt,
      createdByName: createdByUser.displayName,
      updatedByName: updatedByUser.displayName,
    })
    .from(knowledgeSources)
    .innerJoin(projects, eq(knowledgeSources.projectId, projects.id))
    .leftJoin(createdByUser, eq(knowledgeSources.createdBy, createdByUser.id))
    .leftJoin(updatedByUser, eq(knowledgeSources.updatedBy, updatedByUser.id))
    .where(where)
    .orderBy(orderFn(sortCol))
    .limit(limit)
    .offset((page - 1) * limit);

  res.json({ data, total, page, limit });
});

// ── Test Runs (reports) ───────────────────────────────────────
router.get("/test-runs", async (req, res) => {
  const ids = req.projectIdsScope ?? [];
  if (ids.length === 0) {
    res.json({ data: [], total: 0, page: 1, limit: 10 });
    return;
  }
  const { page, limit, sortDir } = paging(req);
  const state = typeof req.query.state === "string" ? req.query.state : "";
  const testCaseId = typeof req.query.testCaseId === "string" ? req.query.testCaseId : "";

  const conditions = [inArray(testRuns.projectId, ids)];
  if (state) conditions.push(eq(testRuns.state, state as "passed" | "failed" | "errored"));
  if (testCaseId) conditions.push(eq(testRuns.testCaseId, testCaseId));
  const where = and(...conditions);

  const [{ count: total }] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(testRuns)
    .where(where);

  const orderFn = sortDir === "asc" ? asc : desc;
  const data = await db
    .select({
      id: testRuns.id,
      projectId: testRuns.projectId,
      testCaseId: testRuns.testCaseId,
      botConnectionId: testRuns.botConnectionId,
      state: testRuns.state,
      verdict: testRuns.verdict,
      transcript: testRuns.transcript,
      error: testRuns.error,
      recordingUrl: testRuns.recordingUrl,
      recordingBlobName: testRuns.recordingBlobName,
      recordingDurationMs: testRuns.recordingDurationMs,
      properties: testRuns.properties,
      startedAt: testRuns.startedAt,
      finishedAt: testRuns.finishedAt,
      createdBy: testRuns.createdBy,
      createdAt: testRuns.createdAt,
      createdByName: createdByUser.displayName,
      testCaseTitle: testCases.title,
    })
    .from(testRuns)
    .leftJoin(createdByUser, eq(testRuns.createdBy, createdByUser.id))
    .leftJoin(testCases, eq(testRuns.testCaseId, testCases.id))
    .where(where)
    .orderBy(orderFn(testRuns.createdAt))
    .limit(limit)
    .offset((page - 1) * limit);

  res.json({ data, total, page, limit });
});

export default router;
