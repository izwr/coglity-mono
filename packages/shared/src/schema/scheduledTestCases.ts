import { pgTable, uuid, text, timestamp, pgEnum, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { users } from "./users.js";
import { testCases } from "./testCases.js";
import { scheduledTestSuites } from "./scheduledTestSuites.js";

export const scheduledTestCaseStateEnum = pgEnum("scheduled_test_case_state", [
  "not_started",
  "in_progress",
  "passed",
  "failed",
  "blocked",
  "skipped",
]);

export const scheduledTestCases = pgTable("scheduled_test_cases", {
  id: uuid("id").defaultRandom().primaryKey(),
  scheduledTestSuiteId: uuid("scheduled_test_suite_id").notNull().references(() => scheduledTestSuites.id, { onDelete: "cascade" }),
  testCaseId: uuid("test_case_id").notNull().references(() => testCases.id, { onDelete: "cascade" }),
  assignedTo: uuid("assigned_to").references(() => users.id),
  actualResults: text("actual_results").default("").notNull(),
  state: scheduledTestCaseStateEnum("state").default("not_started").notNull(),
  linkedBugIds: jsonb("linked_bug_ids").$type<string[]>().default([]).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertScheduledTestCaseSchema = createInsertSchema(scheduledTestCases, {
  actualResults: (schema) => schema.max(50000).optional().default(""),
}).omit({ id: true, createdAt: true, updatedAt: true });

export const updateScheduledTestCaseSchema = z.object({
  assignedTo: z.string().uuid().nullable().optional(),
  actualResults: z.string().max(50000).optional(),
  state: z.enum(["not_started", "in_progress", "passed", "failed", "blocked", "skipped"]).optional(),
  linkedBugIds: z.array(z.string().uuid()).optional(),
});

export const selectScheduledTestCaseSchema = createSelectSchema(scheduledTestCases);

export type ScheduledTestCase = z.infer<typeof selectScheduledTestCaseSchema>;
export type InsertScheduledTestCase = z.infer<typeof insertScheduledTestCaseSchema>;