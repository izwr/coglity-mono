import { pgTable, uuid, varchar, text, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { users } from "./users.js";
import { testSuites } from "./testSuites.js";

export const testCaseStatusEnum = pgEnum("test_case_status", ["draft", "active"]);

export const testCases = pgTable("test_cases", {
  id: uuid("id").defaultRandom().primaryKey(),
  testSuiteId: uuid("test_suite_id").notNull().references(() => testSuites.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }).notNull(),
  preCondition: text("pre_condition").default("").notNull(),
  testSteps: text("test_steps").default("").notNull(),
  data: text("data").default("").notNull(),
  expectedResults: text("expected_results").default("").notNull(),
  status: testCaseStatusEnum("status").default("active").notNull(),
  createdBy: uuid("created_by").references(() => users.id),
  updatedBy: uuid("updated_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertTestCaseSchema = createInsertSchema(testCases, {
  title: (schema) => schema.min(1, "Title is required").max(255),
  preCondition: (schema) => schema.max(10000).optional().default(""),
  testSteps: (schema) => schema.max(10000).optional().default(""),
  data: (schema) => schema.max(10000).optional().default(""),
  expectedResults: (schema) => schema.max(10000).optional().default(""),
}).omit({ id: true, createdBy: true, updatedBy: true, createdAt: true, updatedAt: true });

export const selectTestCaseSchema = createSelectSchema(testCases);

export type TestCase = z.infer<typeof selectTestCaseSchema>;
export type InsertTestCase = z.infer<typeof insertTestCaseSchema>;