import { pgTable, uuid, text, timestamp, jsonb, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { users } from "./users.js";
import { testSuites } from "./testSuites.js";

export const aiSessionStatusEnum = pgEnum("ai_session_status", [
  "gathering_info",
  "scenarios_generated",
  "test_cases_created",
]);

export const aiGenerationSessions = pgTable("ai_generation_sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  testSuiteId: uuid("test_suite_id").notNull().references(() => testSuites.id, { onDelete: "cascade" }),
  userStory: text("user_story").notNull(),
  followUpQA: jsonb("follow_up_qa").default([]).notNull().$type<{ question: string; answer: string }[]>(),
  generatedScenarios: jsonb("generated_scenarios").default([]).notNull().$type<{ title: string; description: string }[]>(),
  selectedScenarioIndices: jsonb("selected_scenario_indices").default([]).notNull().$type<number[]>(),
  status: aiSessionStatusEnum("status").default("gathering_info").notNull(),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertAiGenerationSessionSchema = createInsertSchema(aiGenerationSessions, {
  userStory: (schema) => schema.min(1, "User story is required").max(5000),
}).omit({ id: true, createdBy: true, createdAt: true, updatedAt: true, followUpQA: true, generatedScenarios: true, selectedScenarioIndices: true, status: true });

export const selectAiGenerationSessionSchema = createSelectSchema(aiGenerationSessions);

export type AiGenerationSession = z.infer<typeof selectAiGenerationSessionSchema>;
export type InsertAiGenerationSession = z.infer<typeof insertAiGenerationSessionSchema>;