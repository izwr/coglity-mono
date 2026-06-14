import { Router, type Router as RouterType } from 'express';
import { and, eq, or, ilike, desc, asc, sql, inArray, isNull, gte, lte } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import {
  testSuites,
  testCases,
  tags,
  entityTags,
  bugs,
  scheduledTestSuites,
  scheduledTestCases,
  botConnections,
  knowledgeSources,
  testRuns,
  projects,
  users,
  type EntityTagEntityType,
} from '@coglity/shared/schema';
import { cursorListQuerySchema, decodeCursor } from '@coglity/shared';
import { db } from '../db';
import { keysetWhere, nextCursorFrom } from '../lib/keyset';
import { countWithEstimate } from '../lib/estimatedCount';

const router: RouterType = Router({ mergeParams: true });

const createdByUser = alias(users, 'createdByUser');
const updatedByUser = alias(users, 'updatedByUser');
const assignedToUser = alias(users, 'assignedToUser');

function paging(req: {
  query: { page?: unknown; limit?: unknown; sortBy?: unknown; sortDir?: unknown };
}) {
  return {
    page: Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1),
    limit: Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '10'), 10) || 10)),
    sortBy: typeof req.query.sortBy === 'string' ? req.query.sortBy : 'createdAt',
    sortDir: req.query.sortDir === 'asc' ? ('asc' as const) : ('desc' as const),
  };
}

// ── Test Suites ────────────────────────────────────────────────
router.get('/test-suites', async (req, res) => {
  const ids = req.projectIdsScope ?? [];
  if (ids.length === 0) {
    res.json({ data: [], total: 0, page: 1, limit: 10 });
    return;
  }
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  const tagId = typeof req.query.tagId === 'string' ? req.query.tagId : '';
  const { page, limit, sortBy, sortDir } = paging(req);

  const conditions = [inArray(testSuites.projectId, ids)];
  if (search)
    conditions.push(
      or(ilike(testSuites.name, `%${search}%`), ilike(testSuites.description, `%${search}%`))!,
    );
  if (tagId) {
    const tagRows = await db
      .select({ entityId: entityTags.entityId })
      .from(entityTags)
      .innerJoin(testSuites, eq(entityTags.entityId, testSuites.id))
      .where(
        and(
          eq(entityTags.tagId, tagId),
          eq(entityTags.entityType, 'test_suite'),
          inArray(testSuites.projectId, ids),
        ),
      );
    const tagged = tagRows.map((r) => r.entityId);
    if (tagged.length === 0) {
      res.json({ data: [], total: 0, page, limit });
      return;
    }
    conditions.push(inArray(testSuites.id, tagged));
  }
  const where = and(...conditions);

  const sortCol =
    sortBy === 'name'
      ? testSuites.name
      : sortBy === 'updatedAt'
        ? testSuites.updatedAt
        : testSuites.createdAt;
  const orderFn = sortDir === 'asc' ? asc : desc;

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
const TEST_CASE_SORTS = ['createdAt', 'updatedAt', 'title'] as const;
type TestCaseSort = (typeof TEST_CASE_SORTS)[number];

router.get('/test-cases', async (req, res) => {
  const ids = req.projectIdsScope ?? [];
  const legacyPaging = typeof req.query.page === 'string';
  if (ids.length === 0) {
    if (legacyPaging) {
      res.json({ data: [], total: 0, page: 1, limit: 10 });
    } else {
      res.json({ data: [], nextCursor: null, totalCount: { value: 0, isEstimate: false } });
    }
    return;
  }
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  const status = typeof req.query.status === 'string' ? req.query.status : '';
  const suiteId = typeof req.query.testSuiteId === 'string' ? req.query.testSuiteId : '';
  const testCaseType = typeof req.query.testCaseType === 'string' ? req.query.testCaseType : '';
  const tagId = typeof req.query.tagId === 'string' ? req.query.tagId : '';

  const testSuiteAlias = alias(testSuites, 'ts');
  const conditions = [inArray(testCases.projectId, ids)];
  if (search)
    conditions.push(
      or(ilike(testCases.title, `%${search}%`), ilike(testSuiteAlias.name, `%${search}%`))!,
    );
  if (status === 'draft' || status === 'active') conditions.push(eq(testCases.status, status));
  if (suiteId) conditions.push(eq(testCases.testSuiteId, suiteId));
  if (
    testCaseType === 'web' ||
    testCaseType === 'mobile' ||
    testCaseType === 'chat' ||
    testCaseType === 'voice' ||
    testCaseType === 'agent'
  )
    conditions.push(eq(testCases.testCaseType, testCaseType));
  if (tagId) {
    // EXISTS instead of materializing tagged ids: at 100K+ tagged cases an
    // IN (...) list explodes; the entity_tags PK serves this lookup per row.
    conditions.push(
      sql`exists (select 1 from ${entityTags} where ${entityTags.entityId} = ${testCases.id} and ${entityTags.tagId} = ${tagId} and ${entityTags.entityType} = 'test_case')`,
    );
  }
  const where = and(...conditions);

  const caseListColumns = {
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
  };

  const caseListQuery = () =>
    db
      .select(caseListColumns)
      .from(testCases)
      .innerJoin(testSuiteAlias, eq(testCases.testSuiteId, testSuiteAlias.id))
      .innerJoin(projects, eq(testCases.projectId, projects.id))
      .leftJoin(createdByUser, eq(testCases.createdBy, createdByUser.id))
      .leftJoin(updatedByUser, eq(testCases.updatedBy, updatedByUser.id));

  // ── Legacy offset path (kept until all clients send cursors) ──
  if (legacyPaging) {
    const { page, limit, sortBy, sortDir } = paging(req);
    const sortCol =
      sortBy === 'title'
        ? testCases.title
        : sortBy === 'updatedAt'
          ? testCases.updatedAt
          : testCases.createdAt;
    const orderFn = sortDir === 'asc' ? asc : desc;

    const [{ count: total }] = await db
      .select({ count: sql<number>`cast(count(*) as int)` })
      .from(testCases)
      .innerJoin(testSuiteAlias, eq(testCases.testSuiteId, testSuiteAlias.id))
      .where(where);

    const data = await caseListQuery()
      .where(where)
      .orderBy(orderFn(sortCol))
      .limit(limit)
      .offset((page - 1) * limit);

    res.setHeader('Deprecation', 'true');
    res.json({ data, total, page, limit });
    return;
  }

  // ── Keyset path ──
  const parsedQuery = cursorListQuerySchema.safeParse({ ...req.query });
  if (!parsedQuery.success) {
    res.status(400).json({ error: parsedQuery.error.flatten().fieldErrors });
    return;
  }
  const { cursor: rawCursor, limit, sortDir } = parsedQuery.data;
  const sortBy = (TEST_CASE_SORTS as readonly string[]).includes(parsedQuery.data.sortBy ?? '')
    ? (parsedQuery.data.sortBy as TestCaseSort)
    : 'createdAt';
  const sortCol =
    sortBy === 'title'
      ? testCases.title
      : sortBy === 'updatedAt'
        ? testCases.updatedAt
        : testCases.createdAt;

  let cursor = null;
  if (rawCursor) {
    cursor = decodeCursor(rawCursor);
    if (!cursor || cursor.s !== sortBy || cursor.d !== sortDir) {
      res.status(400).json({ error: 'Invalid cursor' });
      return;
    }
  }

  const keysetConditions = cursor
    ? and(where, keysetWhere(sortCol, testCases.id, cursor))
    : where;
  const orderFn = sortDir === 'asc' ? asc : desc;

  const rows = await caseListQuery()
    .where(keysetConditions)
    .orderBy(orderFn(sortCol), orderFn(testCases.id))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const data = hasMore ? rows.slice(0, limit) : rows;
  const last = data[data.length - 1];
  const nextCursor =
    hasMore && last
      ? nextCursorFrom(sortBy, sortDir, last[sortBy as 'createdAt' | 'updatedAt' | 'title'], last.id)
      : null;

  let totalCount = null;
  if (!cursor) {
    totalCount = await countWithEstimate(
      db,
      db
        .select({ one: sql`1` })
        .from(testCases)
        .innerJoin(testSuiteAlias, eq(testCases.testSuiteId, testSuiteAlias.id))
        .where(where),
      async () => {
        const [{ count }] = await db
          .select({ count: sql<number>`cast(count(*) as int)` })
          .from(testCases)
          .innerJoin(testSuiteAlias, eq(testCases.testSuiteId, testSuiteAlias.id))
          .where(where);
        return count;
      },
    );
  }

  res.json({ data, nextCursor, totalCount });
});

// ── Tags ────────────────────────────────────────────────
router.get('/tags', async (req, res) => {
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
router.get('/bugs', async (req, res) => {
  const ids = req.projectIdsScope ?? [];
  if (ids.length === 0) {
    res.json({ data: [], total: 0, page: 1, limit: 10 });
    return;
  }
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  const state = typeof req.query.state === 'string' ? req.query.state : '';
  const priority = typeof req.query.priority === 'string' ? req.query.priority : '';
  const severity = typeof req.query.severity === 'string' ? req.query.severity : '';
  const bugType = typeof req.query.bugType === 'string' ? req.query.bugType : '';
  const tagId = typeof req.query.tagId === 'string' ? req.query.tagId : '';
  const { page, limit, sortBy, sortDir } = paging(req);

  const conditions = [inArray(bugs.projectId, ids)];
  if (search)
    conditions.push(or(ilike(bugs.title, `%${search}%`), ilike(bugs.description, `%${search}%`))!);
  if (state) conditions.push(eq(bugs.state, state as any));
  if (priority) conditions.push(eq(bugs.priority, priority as any));
  if (severity) conditions.push(eq(bugs.severity, severity as any));
  if (bugType) conditions.push(eq(bugs.bugType, bugType as any));
  if (tagId) {
    const tagRows = await db
      .select({ entityId: entityTags.entityId })
      .from(entityTags)
      .innerJoin(bugs, eq(entityTags.entityId, bugs.id))
      .where(
        and(
          eq(entityTags.tagId, tagId),
          eq(entityTags.entityType, 'bug' as EntityTagEntityType),
          inArray(bugs.projectId, ids),
        ),
      );
    const tagged = tagRows.map((r) => r.entityId);
    if (tagged.length === 0) {
      res.json({ data: [], total: 0, page, limit });
      return;
    }
    conditions.push(inArray(bugs.id, tagged));
  }
  const where = and(...conditions);

  const sortCol =
    sortBy === 'title'
      ? bugs.title
      : sortBy === 'priority'
        ? bugs.priority
        : sortBy === 'severity'
          ? bugs.severity
          : sortBy === 'updatedAt'
            ? bugs.updatedAt
            : bugs.createdAt;
  const orderFn = sortDir === 'asc' ? asc : desc;

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
router.get('/scheduled-test-suites', async (req, res) => {
  const ids = req.projectIdsScope ?? [];
  if (ids.length === 0) {
    res.json({ data: [], total: 0, page: 1, limit: 10 });
    return;
  }
  const { page, limit, sortBy, sortDir } = paging(req);
  const sortCol =
    sortBy === 'startDate'
      ? scheduledTestSuites.startDate
      : sortBy === 'endDate'
        ? scheduledTestSuites.endDate
        : scheduledTestSuites.createdAt;
  const orderFn = sortDir === 'asc' ? asc : desc;

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
      return {
        ...row,
        caseCount: stats?.total ?? 0,
        passedCount: stats?.passed ?? 0,
        failedCount: stats?.failed ?? 0,
      };
    }),
  );

  res.json({ data: enriched, total, page, limit });
});

// ── Bot connections ─────────────────────────────────
router.get('/bot-connections', async (req, res) => {
  const ids = req.projectIdsScope ?? [];
  if (ids.length === 0) {
    res.json({ data: [], total: 0, page: 1, limit: 10 });
    return;
  }
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  const botType = typeof req.query.botType === 'string' ? req.query.botType : '';
  const { page, limit, sortBy, sortDir } = paging(req);

  const conditions = [inArray(botConnections.projectId, ids)];
  if (search) conditions.push(ilike(botConnections.name, `%${search}%`));
  if (botType === 'voice' || botType === 'chat')
    conditions.push(eq(botConnections.botType, botType));
  const where = and(...conditions);

  const sortCol =
    sortBy === 'name'
      ? botConnections.name
      : sortBy === 'updatedAt'
        ? botConnections.updatedAt
        : botConnections.createdAt;
  const orderFn = sortDir === 'asc' ? asc : desc;

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

  // `config` holds bot auth secrets. Only return it for projects the caller can write to;
  // read-only members get it nulled so they cannot exfiltrate credentials from a list view.
  const writable = new Set(req.writableProjectIdsScope ?? []);
  const visible = data.map((row) => (writable.has(row.projectId) ? row : { ...row, config: null }));
  res.json({ data: visible, total, page, limit });
});

// ── Knowledge sources ─────────────────────────────────
router.get('/knowledge-sources', async (req, res) => {
  const ids = req.projectIdsScope ?? [];
  if (ids.length === 0) {
    res.json({ data: [], total: 0, page: 1, limit: 10 });
    return;
  }
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  const sourceType = typeof req.query.sourceType === 'string' ? req.query.sourceType : '';
  const { page, limit, sortBy, sortDir } = paging(req);

  const conditions = [inArray(knowledgeSources.projectId, ids)];
  if (search) conditions.push(ilike(knowledgeSources.name, `%${search}%`));
  if (
    sourceType === 'pdf' ||
    sourceType === 'docx' ||
    sourceType === 'screen' ||
    sourceType === 'figma' ||
    sourceType === 'url'
  ) {
    conditions.push(eq(knowledgeSources.sourceType, sourceType));
  }
  const where = and(...conditions);

  const sortCol =
    sortBy === 'name'
      ? knowledgeSources.name
      : sortBy === 'updatedAt'
        ? knowledgeSources.updatedAt
        : knowledgeSources.createdAt;
  const orderFn = sortDir === 'asc' ? asc : desc;

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
      status: knowledgeSources.status,
      chunkCount: knowledgeSources.chunkCount,
      indexedAt: knowledgeSources.indexedAt,
      errorMessage: knowledgeSources.errorMessage,
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
// List columns deliberately exclude transcript/recordingBlobName: at scale a
// page of transcripts is megabytes of jsonb nobody renders in a grid. The
// run detail endpoint still returns them.
const runListColumns = {
  id: testRuns.id,
  projectId: testRuns.projectId,
  testCaseId: testRuns.testCaseId,
  botConnectionId: testRuns.botConnectionId,
  state: testRuns.state,
  verdict: testRuns.verdict,
  error: testRuns.error,
  recordingUrl: testRuns.recordingUrl,
  recordingDurationMs: testRuns.recordingDurationMs,
  properties: testRuns.properties,
  language: testRuns.language,
  environment: testRuns.environment,
  batchId: testRuns.batchId,
  startedAt: testRuns.startedAt,
  finishedAt: testRuns.finishedAt,
  createdBy: testRuns.createdBy,
  createdAt: testRuns.createdAt,
  createdByName: createdByUser.displayName,
  testCaseTitle: testCases.title,
};

const RUN_STATE_VALUES = ['queued', 'running', 'passed', 'failed', 'errored', 'cancelled'] as const;
type RunStateValue = (typeof RUN_STATE_VALUES)[number];

router.get('/test-runs', async (req, res) => {
  const ids = req.projectIdsScope ?? [];
  const legacyPaging = typeof req.query.page === 'string';
  if (ids.length === 0) {
    if (legacyPaging) {
      res.json({ data: [], total: 0, page: 1, limit: 10 });
    } else {
      res.json({ data: [], nextCursor: null, totalCount: { value: 0, isEstimate: false } });
    }
    return;
  }

  const state = typeof req.query.state === 'string' ? req.query.state : '';
  const testCaseId = typeof req.query.testCaseId === 'string' ? req.query.testCaseId : '';
  const testSuiteId = typeof req.query.testSuiteId === 'string' ? req.query.testSuiteId : '';
  const batchId = typeof req.query.batchId === 'string' ? req.query.batchId : '';
  const environment = typeof req.query.environment === 'string' ? req.query.environment : '';
  const language = typeof req.query.language === 'string' ? req.query.language : '';
  const from = typeof req.query.from === 'string' ? new Date(req.query.from) : null;
  const to = typeof req.query.to === 'string' ? new Date(req.query.to) : null;

  const conditions = [inArray(testRuns.projectId, ids)];
  if (state && (RUN_STATE_VALUES as readonly string[]).includes(state))
    conditions.push(eq(testRuns.state, state as RunStateValue));
  if (testCaseId) conditions.push(eq(testRuns.testCaseId, testCaseId));
  if (testSuiteId)
    conditions.push(
      sql`exists (select 1 from ${testCases} where ${testCases.id} = ${testRuns.testCaseId} and ${testCases.testSuiteId} = ${testSuiteId})`,
    );
  if (batchId) conditions.push(eq(testRuns.batchId, batchId));
  if (environment) conditions.push(eq(testRuns.environment, environment));
  if (language) conditions.push(eq(testRuns.language, language));
  if (from && !Number.isNaN(from.getTime())) conditions.push(gte(testRuns.createdAt, from));
  if (to && !Number.isNaN(to.getTime())) conditions.push(lte(testRuns.createdAt, to));
  const where = and(...conditions);

  // ── Legacy offset path (kept until all clients send cursors) ──
  if (legacyPaging) {
    const { page, limit, sortDir } = paging(req);
    const [{ count: total }] = await db
      .select({ count: sql<number>`cast(count(*) as int)` })
      .from(testRuns)
      .where(where);
    const orderFn = sortDir === 'asc' ? asc : desc;
    const data = await db
      .select(runListColumns)
      .from(testRuns)
      .leftJoin(createdByUser, eq(testRuns.createdBy, createdByUser.id))
      .leftJoin(testCases, eq(testRuns.testCaseId, testCases.id))
      .where(where)
      .orderBy(orderFn(testRuns.createdAt))
      .limit(limit)
      .offset((page - 1) * limit);
    res.setHeader('Deprecation', 'true');
    res.json({ data, total, page, limit });
    return;
  }

  // ── Keyset path ──
  const parsedQuery = cursorListQuerySchema.safeParse({ ...req.query });
  if (!parsedQuery.success) {
    res.status(400).json({ error: parsedQuery.error.flatten().fieldErrors });
    return;
  }
  const { cursor: rawCursor, limit, sortDir } = parsedQuery.data;

  let cursor = null;
  if (rawCursor) {
    cursor = decodeCursor(rawCursor);
    if (!cursor || cursor.s !== 'createdAt' || cursor.d !== sortDir) {
      res.status(400).json({ error: 'Invalid cursor' });
      return;
    }
  }

  const keysetConditions = cursor
    ? and(where, keysetWhere(testRuns.createdAt, testRuns.id, cursor))
    : where;
  const orderFn = sortDir === 'asc' ? asc : desc;

  const rows = await db
    .select(runListColumns)
    .from(testRuns)
    .leftJoin(createdByUser, eq(testRuns.createdBy, createdByUser.id))
    .leftJoin(testCases, eq(testRuns.testCaseId, testCases.id))
    .where(keysetConditions)
    .orderBy(orderFn(testRuns.createdAt), orderFn(testRuns.id))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const data = hasMore ? rows.slice(0, limit) : rows;
  const last = data[data.length - 1];
  const nextCursor =
    hasMore && last ? nextCursorFrom('createdAt', sortDir, last.createdAt, last.id) : null;

  // Totals are computed once per result set (first page only), estimated when large.
  let totalCount = null;
  if (!cursor) {
    totalCount = await countWithEstimate(
      db,
      db.select({ one: sql`1` }).from(testRuns).where(where),
      async () => {
        const [{ count }] = await db
          .select({ count: sql<number>`cast(count(*) as int)` })
          .from(testRuns)
          .where(where);
        return count;
      },
    );
  }

  res.json({ data, nextCursor, totalCount });
});

export default router;
