import { eq, and, or, ilike, desc, asc, sql, inArray } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import {
  testCases,
  testSuites,
  tags,
  entityTags,
  users,
  type EntityTagEntityType,
} from '@coglity/shared/schema';
import { db as rootDb } from '../db';
import { getTagsForEntity, getTagsForEntities } from '../lib/entityTagsLoader';

type DbHandle = typeof rootDb;

const createdByUser = alias(users, 'createdByUser');
const updatedByUser = alias(users, 'updatedByUser');

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
    .innerJoin(
      testSuites,
      and(eq(testCases.testSuiteId, testSuites.id), eq(testSuites.projectId, testCases.projectId)),
    )
    .leftJoin(createdByUser, eq(testCases.createdBy, createdByUser.id))
    .leftJoin(updatedByUser, eq(testCases.updatedBy, updatedByUser.id));
}

async function syncEntityTags(
  db: DbHandle,
  entityId: string,
  entityType: EntityTagEntityType,
  tagIds: string[],
  projectId: string,
  userId?: string,
) {
  await db
    .delete(entityTags)
    .where(and(eq(entityTags.entityId, entityId), eq(entityTags.entityType, entityType)));
  if (tagIds.length > 0) {
    const owned = await db
      .select({ id: tags.id })
      .from(tags)
      .where(and(eq(tags.projectId, projectId), inArray(tags.id, tagIds)));
    if (owned.length > 0) {
      await db
        .insert(entityTags)
        .values(owned.map(({ id }) => ({ entityId, tagId: id, entityType, createdBy: userId })));
    }
  }
}

export class TestCaseService {
  static async listTestCases(
    db: DbHandle,
    projectId: string,
    options: {
      search?: string;
      suiteId?: string;
      status?: string;
      tagId?: string;
      sortBy?: string;
      sortDir?: 'asc' | 'desc';
      page: number;
      limit: number;
    }
  ) {
    const { search, suiteId, status, tagId, sortBy = 'createdAt', sortDir = 'desc', page, limit } = options;

    let tagFilterIds: string[] | null = null;
    if (tagId) {
      const tagRows = await db
        .select({ entityId: entityTags.entityId })
        .from(entityTags)
        .innerJoin(testCases, eq(entityTags.entityId, testCases.id))
        .where(
          and(
            eq(entityTags.tagId, tagId),
            eq(entityTags.entityType, 'test_case'),
            eq(testCases.projectId, projectId),
          ),
        );
      tagFilterIds = tagRows.map((r) => r.entityId);
      if (tagFilterIds.length === 0) {
        return { data: [], total: 0, page, limit };
      }
    }

    const conditions = [eq(testCases.projectId, projectId)];
    if (search)
      conditions.push(
        or(ilike(testCases.title, `%${search}%`), ilike(testSuites.name, `%${search}%`))!,
      );
    if (suiteId) conditions.push(eq(testCases.testSuiteId, suiteId));
    if (status === 'draft' || status === 'active') conditions.push(eq(testCases.status, status));
    if (tagFilterIds) conditions.push(inArray(testCases.id, tagFilterIds));
    const where = and(...conditions);

    const sortColumn =
      sortBy === 'title'
        ? testCases.title
        : sortBy === 'updatedAt'
          ? testCases.updatedAt
          : testCases.createdAt;
    const orderFn = sortDir === 'asc' ? asc : desc;

    const [{ count: total }] = await db
      .select({ count: sql<number>`cast(count(*) as int)` })
      .from(testCases)
      .innerJoin(
        testSuites,
        and(eq(testCases.testSuiteId, testSuites.id), eq(testSuites.projectId, testCases.projectId)),
      )
      .where(where);

    const offset = (page - 1) * limit;
    const cases = await casesBaseQuery(db)
      .where(where)
      .orderBy(orderFn(sortColumn))
      .limit(limit)
      .offset(offset);

    const tagsByCase = await getTagsForEntities(
      db,
      cases.map((tc) => tc.id),
      'test_case',
    );
    const result = cases.map((tc) => ({ ...tc, tags: tagsByCase.get(tc.id) ?? [] }));

    return { data: result, total, page, limit };
  }

  static async getTestCase(db: DbHandle, projectId: string, id: string) {
    const [tc] = await casesBaseQuery(db).where(
      and(eq(testCases.id, id), eq(testCases.projectId, projectId)),
    );
    if (!tc) return null;
    return { ...tc, tags: await getTagsForEntity(db, tc.id, 'test_case') };
  }

  static async createTestCase(
    db: DbHandle,
    projectId: string,
    userId: string | undefined,
    data: any,
    tagIds?: string[]
  ) {
    const [suiteOwned] = await db
      .select({ id: testSuites.id })
      .from(testSuites)
      .where(and(eq(testSuites.id, data.testSuiteId), eq(testSuites.projectId, projectId)));
    
    if (!suiteOwned) {
      throw new Error('Test suite not found in this project');
    }

    const [inserted] = await db
      .insert(testCases)
      .values({ ...data, projectId, createdBy: userId, updatedBy: userId })
      .returning();

    if (Array.isArray(tagIds) && tagIds.length > 0) {
      await syncEntityTags(db, inserted.id, 'test_case', tagIds, projectId, userId);
    }
    
    const [tc] = await casesBaseQuery(db).where(
      and(eq(testCases.id, inserted.id), eq(testCases.projectId, projectId)),
    );
    return { ...tc, tags: await getTagsForEntity(db, tc.id, 'test_case') };
  }

  static async updateTestCase(
    db: DbHandle,
    projectId: string,
    userId: string | undefined,
    id: string,
    data: any,
    tagIds?: string[]
  ) {
    const [updated] = await db
      .update(testCases)
      .set({ ...data, updatedBy: userId, updatedAt: new Date() })
      .where(and(eq(testCases.id, id), eq(testCases.projectId, projectId)))
      .returning();

    if (!updated) {
      return null;
    }

    if (Array.isArray(tagIds)) {
      await syncEntityTags(db, updated.id, 'test_case', tagIds, projectId, userId);
    }

    const [tc] = await casesBaseQuery(db).where(
      and(eq(testCases.id, updated.id), eq(testCases.projectId, projectId)),
    );
    return { ...tc, tags: await getTagsForEntity(db, tc.id, 'test_case') };
  }

  static async deleteTestCase(db: DbHandle, projectId: string, id: string) {
    const [deleted] = await db
      .delete(testCases)
      .where(and(eq(testCases.id, id), eq(testCases.projectId, projectId)))
      .returning({ id: testCases.id });

    if (!deleted) {
      return false;
    }

    await db
      .delete(entityTags)
      .where(
        and(eq(entityTags.entityId, id), eq(entityTags.entityType, 'test_case')),
      );

    return true;
  }
}
