import { pgTable, uuid, text, timestamp, pgEnum, jsonb, integer } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { users } from "./users.js";
import { testCases } from "./testCases.js";
import { botConnections } from "./botConnections.js";
import { projects } from "./projects.js";

export const testRunStateEnum = pgEnum("test_run_state", [
  "queued",
  "running",
  "passed",
  "failed",
  "errored",
  "cancelled",
]);

export type TranscriptTurn = {
  role: "tester" | "sut" | "system";
  text: string;
  ts: number;
};

export type TestRunProperties = Record<string, string | number>;

export const testRuns = pgTable("test_runs", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  testCaseId: uuid("test_case_id").notNull().references(() => testCases.id, { onDelete: "cascade" }),
  botConnectionId: uuid("bot_connection_id").references(() => botConnections.id),
  state: testRunStateEnum("state").default("queued").notNull(),
  verdict: text("verdict").default("").notNull(),
  transcript: jsonb("transcript").$type<TranscriptTurn[]>().default([]).notNull(),
  error: text("error").default("").notNull(),
  recordingUrl: text("recording_url").default("").notNull(),
  recordingBlobName: text("recording_blob_name").default("").notNull(),
  recordingDurationMs: integer("recording_duration_ms").default(0).notNull(),
  properties: jsonb("properties").$type<TestRunProperties>().default({}).notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertTestRunSchema = createInsertSchema(testRuns).omit({
  id: true,
  projectId: true,
  createdBy: true,
  createdAt: true,
});

export const selectTestRunSchema = createSelectSchema(testRuns);

export const updateTestRunSchema = z.object({
  state: z.enum(["queued", "running", "passed", "failed", "errored", "cancelled"]).optional(),
  verdict: z.string().max(10000).optional(),
  transcript: z
    .array(
      z.object({
        role: z.enum(["tester", "sut", "system"]),
        text: z.string(),
        ts: z.number(),
      }),
    )
    .optional(),
  error: z.string().max(10000).optional(),
  recordingUrl: z.string().max(2000).optional(),
  recordingBlobName: z.string().max(500).optional(),
  recordingDurationMs: z.number().int().nonnegative().optional(),
  properties: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
  startedAt: z.coerce.date().nullable().optional(),
  finishedAt: z.coerce.date().nullable().optional(),
});

export type TestRun = z.infer<typeof selectTestRunSchema>;
export type InsertTestRun = z.infer<typeof insertTestRunSchema>;
