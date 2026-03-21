import { pgTable, uuid, varchar, timestamp, primaryKey } from "drizzle-orm/pg-core";
import { tags } from "./tags.js";
import { users } from "./users.js";

export const entityTagsEntityTypes = ["test_suite", "test_case", "scheduled_test_suite"] as const;
export type EntityTagEntityType = (typeof entityTagsEntityTypes)[number];

export const entityTags = pgTable(
  "entity_tags",
  {
    entityId: uuid("entity_id").notNull(),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
    entityType: varchar("entity_type", { length: 50 })
      .notNull()
      .$type<EntityTagEntityType>(),
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.entityId, table.tagId, table.entityType] }),
  ],
);
