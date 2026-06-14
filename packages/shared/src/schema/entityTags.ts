import { pgTable, uuid, varchar, timestamp, primaryKey, index } from 'drizzle-orm/pg-core';
import { tags } from './tags';
import { users } from './users';

export const entityTagsEntityTypes = [
  'test_suite',
  'test_case',
  'scheduled_test_suite',
  'bug',
] as const;
export type EntityTagEntityType = (typeof entityTagsEntityTypes)[number];

export const entityTags = pgTable(
  'entity_tags',
  {
    entityId: uuid('entity_id').notNull(),
    tagId: uuid('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
    entityType: varchar('entity_type', { length: 50 }).notNull().$type<EntityTagEntityType>(),
    createdBy: uuid('created_by').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.entityId, table.tagId, table.entityType] }),
    // The PK leads with entity_id; tag-filter reverse lookups need the other direction.
    index('entity_tags_tag_type_idx').on(table.tagId, table.entityType),
  ],
);
