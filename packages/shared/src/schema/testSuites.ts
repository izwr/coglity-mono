import { pgTable, uuid, varchar, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { users } from "./users.js";

export const testSuites = pgTable("test_suites", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description").default("").notNull(),
  createdBy: uuid("created_by").references(() => users.id),
  updatedBy: uuid("updated_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertTestSuiteSchema = createInsertSchema(testSuites, {
  name: (schema) => schema.min(1, "Name is required").max(255),
  description: (schema) => schema.max(2000).optional().default(""),
}).omit({ id: true, createdBy: true, updatedBy: true, createdAt: true, updatedAt: true });

export const selectTestSuiteSchema = createSelectSchema(testSuites);

export type TestSuite = z.infer<typeof selectTestSuiteSchema>;
export type InsertTestSuite = z.infer<typeof insertTestSuiteSchema>;
