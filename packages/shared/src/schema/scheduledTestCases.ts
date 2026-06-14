import { pgTable, uuid, text, timestamp, pgEnum, jsonb, index } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod/v4';
import { users } from './users';
import { testCases } from './testCases';
import { scheduledTestSuites } from './scheduledTestSuites';
import { projects } from './projects';

export const scheduledTestCaseStateEnum = pgEnum('scheduled_test_case_state', [
  'not_started',
  'in_progress',
  'passed',
  'failed',
  'blocked',
  'skipped',
]);

export const scheduledTestCases = pgTable(
  'scheduled_test_cases',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    scheduledTestSuiteId: uuid('scheduled_test_suite_id')
      .notNull()
      .references(() => scheduledTestSuites.id, { onDelete: 'cascade' }),
    testCaseId: uuid('test_case_id')
      .notNull()
      .references(() => testCases.id, { onDelete: 'cascade' }),
    assignedTo: uuid('assigned_to').references(() => users.id),
    actualResults: text('actual_results').default('').notNull(),
    state: scheduledTestCaseStateEnum('state').default('not_started').notNull(),
    linkedBugIds: jsonb('linked_bug_ids').$type<string[]>().default([]).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    // Per-suite pass/fail rollups group by state within one scheduled suite
    index('scheduled_test_cases_suite_state_idx').on(table.scheduledTestSuiteId, table.state),
  ],
);

export const insertScheduledTestCaseSchema = createInsertSchema(scheduledTestCases, {
  actualResults: z.string().max(50000).optional().default(''),
}).omit({ id: true, projectId: true, createdAt: true, updatedAt: true });

export const updateScheduledTestCaseSchema = z.object({
  assignedTo: z.string().uuid().nullable().optional(),
  actualResults: z.string().max(50000).optional(),
  state: z
    .enum(['not_started', 'in_progress', 'passed', 'failed', 'blocked', 'skipped'])
    .optional(),
  linkedBugIds: z.array(z.string().uuid()).optional(),
});

export const selectScheduledTestCaseSchema = createSelectSchema(scheduledTestCases);

export type ScheduledTestCase = z.infer<typeof selectScheduledTestCaseSchema>;
export type InsertScheduledTestCase = z.infer<typeof insertScheduledTestCaseSchema>;
