import { pgTable, uuid, varchar, text, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { users } from "./users.js";
import { projects } from "./projects.js";

export const knowledgeSourceTypeEnum = pgEnum("knowledge_source_type", [
  "pdf",
  "screen",
  "figma",
  "url",
]);

export const knowledgeSources = pgTable("knowledge_sources", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  sourceType: knowledgeSourceTypeEnum("source_type").notNull(),
  url: text("url").default("").notNull(),
  description: text("description").default("").notNull(),
  createdBy: uuid("created_by").references(() => users.id),
  updatedBy: uuid("updated_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertKnowledgeSourceSchema = createInsertSchema(knowledgeSources, {
  name: (schema) => schema.min(1, "Name is required").max(255),
  url: (schema) => schema.max(2000).optional().default(""),
  description: (schema) => schema.max(2000).optional().default(""),
}).omit({ id: true, projectId: true, createdBy: true, updatedBy: true, createdAt: true, updatedAt: true });

export const selectKnowledgeSourceSchema = createSelectSchema(knowledgeSources);

export type KnowledgeSource = z.infer<typeof selectKnowledgeSourceSchema>;
export type InsertKnowledgeSource = z.infer<typeof insertKnowledgeSourceSchema>;
