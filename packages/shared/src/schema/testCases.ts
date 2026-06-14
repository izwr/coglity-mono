import { pgTable, uuid, varchar, text, timestamp, pgEnum, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod/v4';
import { users } from './users';
import { testSuites } from './testSuites';
import { botConnections } from './botConnections';
import { projects } from './projects';

export const testCaseStatusEnum = pgEnum('test_case_status', ['draft', 'active']);

export const testCaseTypeEnum = pgEnum('test_case_type', [
  'web',
  'mobile',
  'chat',
  'voice',
  'agent',
]);

export const testCases = pgTable(
  'test_cases',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    testSuiteId: uuid('test_suite_id')
      .notNull()
      .references(() => testSuites.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 255 }).notNull(),
    preCondition: text('pre_condition').default('').notNull(),
    testSteps: text('test_steps').default('').notNull(),
    data: text('data').default('').notNull(),
    expectedResults: text('expected_results').default('').notNull(),
    status: testCaseStatusEnum('status').default('active').notNull(),
    testCaseType: testCaseTypeEnum('test_case_type').default('web').notNull(),
    botConnectionId: uuid('bot_connection_id').references(() => botConnections.id),
    createdBy: uuid('created_by').references(() => users.id),
    updatedBy: uuid('updated_by').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('test_cases_project_created_idx').on(table.projectId, table.createdAt, table.id),
    index('test_cases_project_updated_idx').on(table.projectId, table.updatedAt),
    index('test_cases_suite_idx').on(table.testSuiteId),
    // Trigram index so ILIKE '%term%' title search uses a bitmap scan at 100K+ rows.
    // Requires the pg_trgm extension (created in a hand-written migration).
    index('test_cases_title_trgm_idx').using('gin', sql`${table.title} gin_trgm_ops`),
  ],
);

export const insertTestCaseSchema = createInsertSchema(testCases, {
  title: z.string().min(1, 'Title is required').max(255),
  preCondition: z.string().max(10000).optional().default(''),
  testSteps: z.string().max(10000).optional().default(''),
  data: z.string().max(10000).optional().default(''),
  expectedResults: z.string().max(10000).optional().default(''),
}).omit({
  id: true,
  projectId: true,
  createdBy: true,
  updatedBy: true,
  createdAt: true,
  updatedAt: true,
});

export const selectTestCaseSchema = createSelectSchema(testCases);

export type TestCase = z.infer<typeof selectTestCaseSchema>;
export type InsertTestCase = z.infer<typeof insertTestCaseSchema>;
