import { pgTable, uuid, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { users } from "./users.js";
import { testSuites } from "./testSuites.js";
import { projects } from "./projects.js";

export const scheduledTestSuites = pgTable("scheduled_test_suites", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  testSuiteId: uuid("test_suite_id").notNull().references(() => testSuites.id, { onDelete: "cascade" }),
  startDate: timestamp("start_date", { withTimezone: true }).notNull(),
  endDate: timestamp("end_date", { withTimezone: true }).notNull(),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertScheduledTestSuiteSchema = createInsertSchema(scheduledTestSuites, {
  startDate: (schema) => schema,
  endDate: (schema) => schema,
}).omit({ id: true, projectId: true, createdBy: true, createdAt: true, updatedAt: true });

export const selectScheduledTestSuiteSchema = createSelectSchema(scheduledTestSuites);

export type ScheduledTestSuite = z.infer<typeof selectScheduledTestSuiteSchema>;
export type InsertScheduledTestSuite = z.infer<typeof insertScheduledTestSuiteSchema>;
