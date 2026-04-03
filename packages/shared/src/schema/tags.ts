import { pgTable, uuid, varchar, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { users } from "./users.js";

export const tags = pgTable("tags", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull().unique(),
  description: text("description").default("").notNull(),
  createdBy: uuid("created_by").references(() => users.id),
  updatedBy: uuid("updated_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertTagSchema = createInsertSchema(tags, {
  name: z.string().min(1, "Name is required").max(255),
  description: z.string().max(2000).optional().default(""),
}).omit({ id: true, createdBy: true, updatedBy: true, createdAt: true, updatedAt: true });

export const selectTagSchema = createSelectSchema(tags);

export type Tag = z.infer<typeof selectTagSchema>;
export type InsertTag = z.infer<typeof insertTagSchema>;
