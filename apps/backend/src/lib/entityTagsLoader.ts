import { and, eq, inArray } from 'drizzle-orm';
import { tags, entityTags, type EntityTagEntityType } from '@coglity/shared/schema';
import { db as rootDb } from '../db';

type DbHandle = typeof rootDb;
export type Tag = typeof tags.$inferSelect;

/**
 * Bulk tag loader: one query for a whole page of entities instead of one
 * query per row (the previous per-entity helper made list endpoints O(rows)).
 * Every input id is present in the returned map (empty array when untagged).
 */
export async function getTagsForEntities(
  db: DbHandle,
  entityIds: string[],
  entityType: EntityTagEntityType,
): Promise<Map<string, Tag[]>> {
  const byEntity = new Map<string, Tag[]>(entityIds.map((id) => [id, []]));
  if (entityIds.length === 0) return byEntity;
  const rows = await db
    .select({ entityId: entityTags.entityId, tag: tags })
    .from(entityTags)
    .innerJoin(tags, eq(entityTags.tagId, tags.id))
    .where(and(inArray(entityTags.entityId, entityIds), eq(entityTags.entityType, entityType)));
  for (const row of rows) {
    byEntity.get(row.entityId)?.push(row.tag);
  }
  return byEntity;
}

export async function getTagsForEntity(
  db: DbHandle,
  entityId: string,
  entityType: EntityTagEntityType,
): Promise<Tag[]> {
  const map = await getTagsForEntities(db, [entityId], entityType);
  return map.get(entityId) ?? [];
}
