import { eq, and, or, ilike, desc, asc, sql, inArray } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import {
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

export class TestSuiteService {
  static async listTestSuites(
    db: DbHandle,
    projectId: string,
    options: {
      search?: string;
      tagId?: string;
      sortBy?: string;
      sortDir?: 'asc' | 'desc';
      page: number;
      limit: number;
    }
  ) {
    const { search, tagId, sortBy = 'createdAt', sortDir = 'desc', page, limit } = options;

    let tagFilterIds: string[] | null = null;
    if (tagId) {
      const tagRows = await db
        .select({ entityId: entityTags.entityId })
        .from(entityTags)
        .innerJoin(testSuites, eq(entityTags.entityId, testSuites.id))
        .where(
          and(
            eq(entityTags.tagId, tagId),
            eq(entityTags.entityType, 'test_suite'),
            eq(testSuites.projectId, projectId),
          ),
        );
      tagFilterIds = tagRows.map((r) => r.entityId);
      if (tagFilterIds.length === 0) {
        return { data: [], total: 0, page, limit };
      }
    }

    const conditions: any[] = [];
    if (search) {
      conditions.push(
        or(ilike(testSuites.name, `%${search}%`), ilike(testSuites.description, `%${search}%`))!,
      );
    }
    if (tagFilterIds) conditions.push(inArray(testSuites.id, tagFilterIds));
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const sortColumn =
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

    const offset = (page - 1) * limit;
    const suites = await suitesBaseQuery(db)
      .where(where)
      .orderBy(orderFn(sortColumn))
      .limit(limit)
      .offset(offset);

    const tagsBySuite = await getTagsForEntities(
      db,
      suites.map((suite) => suite.id),
      'test_suite',
    );
    const result = suites.map((suite) => ({ ...suite, tags: tagsBySuite.get(suite.id) ?? [] }));

    return { data: result, total, page, limit };
  }

  static async getTestSuite(db: DbHandle, projectId: string, id: string) {
    const [suite] = await suitesBaseQuery(db).where(eq(testSuites.id, id));
    if (!suite) return null;
    return { ...suite, tags: await getTagsForEntity(db, suite.id, 'test_suite') };
  }

  static async createTestSuite(
    db: DbHandle,
    projectId: string,
    userId: string | undefined,
    data: any,
    tagIds?: string[]
  ) {
    const [inserted] = await db
      .insert(testSuites)
      .values({ ...data, projectId, createdBy: userId, updatedBy: userId })
      .returning();

    if (Array.isArray(tagIds) && tagIds.length > 0) {
      await syncEntityTags(db, inserted.id, 'test_suite', tagIds, projectId, userId);
    }
    
    const [suite] = await suitesBaseQuery(db).where(eq(testSuites.id, inserted.id));
    return { ...suite, tags: await getTagsForEntity(db, suite.id, 'test_suite') };
  }

  static async updateTestSuite(
    db: DbHandle,
    projectId: string,
    userId: string | undefined,
    id: string,
    data: any,
    tagIds?: string[]
  ) {
    const [updated] = await db
      .update(testSuites)
      .set({ ...data, updatedBy: userId, updatedAt: new Date() })
      .where(eq(testSuites.id, id))
      .returning();

    if (!updated) {
      return null;
    }

    if (Array.isArray(tagIds)) {
      await syncEntityTags(db, updated.id, 'test_suite', tagIds, projectId, userId);
    }

    const [suite] = await suitesBaseQuery(db).where(eq(testSuites.id, updated.id));
    return { ...suite, tags: await getTagsForEntity(db, suite.id, 'test_suite') };
  }

  static async deleteTestSuite(db: DbHandle, projectId: string, id: string) {
    const [deleted] = await db
      .delete(testSuites)
      .where(eq(testSuites.id, id))
      .returning({ id: testSuites.id });

    if (!deleted) {
      return false;
    }

    await db
      .delete(entityTags)
      .where(
        and(
          eq(entityTags.entityId, id),
          eq(entityTags.entityType, 'test_suite'),
        ),
      );

    return true;
  }
}
