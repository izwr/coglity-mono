import { eq, and, ilike, desc, asc, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { botConnections, users } from '@coglity/shared/schema';
import { db as rootDb } from '../db';
import { PROJECT_ROLE_RANK } from '../services/rbac';

type DbHandle = typeof rootDb;

export function canSeeConfig(role: string | undefined): boolean {
  return !!role && (PROJECT_ROLE_RANK[role as keyof typeof PROJECT_ROLE_RANK] ?? 0) >= PROJECT_ROLE_RANK.writer;
}

export function redactConfig<T extends { config?: unknown }>(row: T): T {
  return { ...row, config: null };
}

const createdByUser = alias(users, 'createdByUser');
const updatedByUser = alias(users, 'updatedByUser');

const columns = {
  id: botConnections.id,
  projectId: botConnections.projectId,
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
} as const;

function baseQuery(db: DbHandle) {
  return db
    .select(columns)
    .from(botConnections)
    .leftJoin(createdByUser, eq(botConnections.createdBy, createdByUser.id))
    .leftJoin(updatedByUser, eq(botConnections.updatedBy, updatedByUser.id));
}

export class BotConnectionService {
  static async listConnections(
    db: DbHandle,
    projectId: string,
    role: string | undefined,
    options: {
      search?: string;
      botType?: string;
      sortBy?: string;
      sortDir?: 'asc' | 'desc';
      page: number;
      limit: number;
    }
  ) {
    const { search, botType, sortBy = 'createdAt', sortDir = 'desc', page, limit } = options;

    const conditions = [eq(botConnections.projectId, projectId)];
    if (search) conditions.push(ilike(botConnections.name, `%${search}%`));
    if (botType === 'voice' || botType === 'chat') {
      conditions.push(eq(botConnections.botType, botType));
    }
    const where = and(...conditions);

    const sortColumn =
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

    const offset = (page - 1) * limit;
    const data = await baseQuery(db)
      .where(where)
      .orderBy(orderFn(sortColumn))
      .limit(limit)
      .offset(offset);

    const visible = canSeeConfig(role) ? data : data.map(redactConfig);
    return { data: visible, total, page, limit };
  }

  static async getConnection(db: DbHandle, projectId: string, id: string, role: string | undefined) {
    const [row] = await baseQuery(db).where(
      and(eq(botConnections.id, id), eq(botConnections.projectId, projectId)),
    );
    if (!row) return null;
    return canSeeConfig(role) ? row : redactConfig(row);
  }

  static async createConnection(
    db: DbHandle,
    projectId: string,
    userId: string | undefined,
    data: any
  ) {
    const [inserted] = await db
      .insert(botConnections)
      .values({ ...data, projectId, createdBy: userId, updatedBy: userId })
      .returning();
    const [row] = await baseQuery(db).where(eq(botConnections.id, inserted.id));
    return row;
  }

  static async updateConnection(
    db: DbHandle,
    projectId: string,
    userId: string | undefined,
    id: string,
    data: any
  ) {
    const [updated] = await db
      .update(botConnections)
      .set({ ...data, updatedBy: userId, updatedAt: new Date() })
      .where(
        and(eq(botConnections.id, id), eq(botConnections.projectId, projectId)),
      )
      .returning();
    if (!updated) return null;
    const [row] = await baseQuery(db).where(eq(botConnections.id, updated.id));
    return row;
  }

  static async deleteConnection(db: DbHandle, projectId: string, id: string) {
    const [deleted] = await db
      .delete(botConnections)
      .where(
        and(eq(botConnections.id, id), eq(botConnections.projectId, projectId)),
      )
      .returning({ id: botConnections.id });
    return !!deleted;
  }
}
