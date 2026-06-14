import { eq, and, or, ilike, desc, asc, sql, inArray } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import {
  bugs,
  tags,
  entityTags,
  users,
  type EntityTagEntityType,
  type BugComment,
} from '@coglity/shared/schema';
import { db as rootDb } from '../db';
import { randomUUID } from 'crypto';
import { getTagsForEntity, getTagsForEntities } from '../lib/entityTagsLoader';

type DbHandle = typeof rootDb;

const createdByUser = alias(users, 'createdByUser');
const assignedToUser = alias(users, 'assignedToUser');

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

const bugColumns = {
  id: bugs.id,
  projectId: bugs.projectId,
  title: bugs.title,
  description: bugs.description,
  comments: bugs.comments,
  attachments: bugs.attachments,
  assignedTo: bugs.assignedTo,
  bugType: bugs.bugType,
  createdBy: bugs.createdBy,
  priority: bugs.priority,
  severity: bugs.severity,
  resolution: bugs.resolution,
  state: bugs.state,
  reproducibility: bugs.reproducibility,
  createdAt: bugs.createdAt,
  updatedAt: bugs.updatedAt,
  createdByName: createdByUser.displayName,
  assignedToName: assignedToUser.displayName,
} as const;

function bugsBaseQuery(db: DbHandle) {
  return db
    .select(bugColumns)
    .from(bugs)
    .leftJoin(createdByUser, eq(bugs.createdBy, createdByUser.id))
    .leftJoin(assignedToUser, eq(bugs.assignedTo, assignedToUser.id));
}

export class BugService {
  static async listBugs(
    db: DbHandle,
    projectId: string,
    options: {
      search?: string;
      state?: string;
      priority?: string;
      severity?: string;
      bugType?: string;
      assignedToId?: string;
      tagId?: string;
      sortBy?: string;
      sortDir?: 'asc' | 'desc';
      page: number;
      limit: number;
    }
  ) {
    const {
      search,
      state,
      priority,
      severity,
      bugType,
      assignedToId,
      tagId,
      sortBy = 'createdAt',
      sortDir = 'desc',
      page,
      limit,
    } = options;

    let tagFilterIds: string[] | null = null;
    if (tagId) {
      const tagRows = await db
        .select({ entityId: entityTags.entityId })
        .from(entityTags)
        .innerJoin(bugs, eq(entityTags.entityId, bugs.id))
        .where(
          and(
            eq(entityTags.tagId, tagId),
            eq(entityTags.entityType, 'bug' as EntityTagEntityType),
            eq(bugs.projectId, projectId),
          ),
        );
      tagFilterIds = tagRows.map((r) => r.entityId);
      if (tagFilterIds.length === 0) {
        return { data: [], total: 0, page, limit };
      }
    }

    const conditions = [eq(bugs.projectId, projectId)];
    if (search)
      conditions.push(or(ilike(bugs.title, `%${search}%`), ilike(bugs.description, `%${search}%`))!);
    if (state) conditions.push(eq(bugs.state, state as any));
    if (priority) conditions.push(eq(bugs.priority, priority as any));
    if (severity) conditions.push(eq(bugs.severity, severity as any));
    if (bugType) conditions.push(eq(bugs.bugType, bugType as any));
    if (assignedToId) conditions.push(eq(bugs.assignedTo, assignedToId));
    if (tagFilterIds) conditions.push(inArray(bugs.id, tagFilterIds));
    const where = and(...conditions);

    const sortColumn =
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

    const offset = (page - 1) * limit;
    const rows = await bugsBaseQuery(db)
      .where(where)
      .orderBy(orderFn(sortColumn))
      .limit(limit)
      .offset(offset);

    const tagsByBug = await getTagsForEntities(
      db,
      rows.map((bug) => bug.id),
      'bug' as EntityTagEntityType,
    );
    const result = rows.map((bug) => ({ ...bug, tags: tagsByBug.get(bug.id) ?? [] }));

    return { data: result, total, page, limit };
  }

  static async getBug(db: DbHandle, projectId: string, id: string) {
    const [bug] = await bugsBaseQuery(db).where(
      and(eq(bugs.id, id), eq(bugs.projectId, projectId)),
    );
    if (!bug) return null;
    return { ...bug, tags: await getTagsForEntity(db, bug.id, 'bug' as EntityTagEntityType) };
  }

  static async createBug(
    db: DbHandle,
    projectId: string,
    userId: string | undefined,
    data: any,
    tagIds?: string[]
  ) {
    const [inserted] = await db
      .insert(bugs)
      .values({ ...data, projectId, createdBy: userId })
      .returning();

    if (Array.isArray(tagIds) && tagIds.length > 0) {
      await syncEntityTags(db, inserted.id, 'bug' as EntityTagEntityType, tagIds, projectId, userId);
    }
    const [bug] = await bugsBaseQuery(db).where(eq(bugs.id, inserted.id));
    return { ...bug, tags: await getTagsForEntity(db, bug.id, 'bug' as EntityTagEntityType) };
  }

  static async updateBug(
    db: DbHandle,
    projectId: string,
    userId: string | undefined,
    id: string,
    data: any,
    tagIds?: string[]
  ) {
    const [updated] = await db
      .update(bugs)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(bugs.id, id), eq(bugs.projectId, projectId)))
      .returning();

    if (!updated) return null;

    if (Array.isArray(tagIds)) {
      await syncEntityTags(
        db,
        updated.id,
        'bug' as EntityTagEntityType,
        tagIds,
        projectId,
        userId,
      );
    }
    const [bug] = await bugsBaseQuery(db).where(eq(bugs.id, updated.id));
    return { ...bug, tags: await getTagsForEntity(db, bug.id, 'bug' as EntityTagEntityType) };
  }

  static async addComment(
    db: DbHandle,
    projectId: string,
    userId: string | undefined,
    id: string,
    text: string
  ) {
    let createdByName: string | undefined;
    if (userId) {
      const [user] = await db
        .select({ displayName: users.displayName })
        .from(users)
        .where(eq(users.id, userId));
      createdByName = user?.displayName;
    }

    const newComment: BugComment = {
      id: randomUUID(),
      text: text.trim(),
      createdBy: userId ?? 'unknown',
      createdByName,
      createdAt: new Date().toISOString(),
    };

    const [touched] = await db
      .update(bugs)
      .set({
        comments: sql`COALESCE(${bugs.comments}, '[]'::jsonb) || ${JSON.stringify([newComment])}::jsonb`,
        updatedAt: new Date(),
      })
      .where(and(eq(bugs.id, id), eq(bugs.projectId, projectId)))
      .returning({ id: bugs.id });

    if (!touched) return null;

    const [bug] = await bugsBaseQuery(db).where(eq(bugs.id, id));
    return { ...bug, tags: await getTagsForEntity(db, bug.id, 'bug' as EntityTagEntityType) };
  }

  static async deleteBug(db: DbHandle, projectId: string, id: string) {
    const [deleted] = await db
      .delete(bugs)
      .where(and(eq(bugs.id, id), eq(bugs.projectId, projectId)))
      .returning({ id: bugs.id });

    if (!deleted) return false;

    await db
      .delete(entityTags)
      .where(
        and(
          eq(entityTags.entityId, id),
          eq(entityTags.entityType, 'bug' as EntityTagEntityType),
        ),
      );

    return true;
  }
}
