import { pgTable, uuid, varchar, text, timestamp, pgEnum, jsonb, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod/v4';
import { users } from './users';
import { projects } from './projects';

export const bugTypeEnum = pgEnum('bug_type', [
  'functional',
  'performance',
  'security',
  'usability',
  'compatibility',
  'regression',
  'other',
]);

export const bugStateEnum = pgEnum('bug_state', [
  'new',
  'open',
  'in_progress',
  'resolved',
  'closed',
  'reopened',
]);

export const bugResolutionEnum = pgEnum('bug_resolution', [
  'unresolved',
  'fixed',
  'wont_fix',
  'duplicate',
  'cannot_reproduce',
  'by_design',
]);

export const bugPriorityEnum = pgEnum('bug_priority', ['critical', 'high', 'medium', 'low']);

export const bugSeverityEnum = pgEnum('bug_severity', [
  'blocker',
  'critical',
  'major',
  'minor',
  'trivial',
]);

export const bugReproducibilityEnum = pgEnum('bug_reproducibility', [
  'always',
  'sometimes',
  'rare',
  'unable',
]);

export const bugs = pgTable('bugs', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description').default('').notNull(),
  comments: jsonb('comments').$type<BugComment[]>().default([]).notNull(),
  attachments: jsonb('attachments').$type<BugAttachment[]>().default([]).notNull(),
  assignedTo: uuid('assigned_to').references(() => users.id),
  bugType: bugTypeEnum('bug_type').default('functional').notNull(),
  createdBy: uuid('created_by').references(() => users.id),
  priority: bugPriorityEnum('priority').default('medium').notNull(),
  severity: bugSeverityEnum('severity').default('major').notNull(),
  resolution: bugResolutionEnum('resolution').default('unresolved').notNull(),
  state: bugStateEnum('state').default('new').notNull(),
  reproducibility: bugReproducibilityEnum('reproducibility').default('always').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
},
(table) => [
  index('bugs_project_created_idx').on(table.projectId, table.createdAt),
  index('bugs_project_state_created_idx').on(table.projectId, table.state, table.createdAt),
  // Trigram index for ILIKE '%term%' title search (pg_trgm extension required).
  index('bugs_title_trgm_idx').using('gin', sql`${table.title} gin_trgm_ops`),
]);

export interface BugComment {
  id: string;
  text: string;
  createdBy: string;
  createdByName?: string;
  createdAt: string;
}

export interface BugAttachment {
  id: string;
  fileName: string;
  url: string;
  createdBy?: string;
  createdAt: string;
}

export const insertBugSchema = createInsertSchema(bugs, {
  title: z.string().min(1, 'Title is required').max(255),
  description: z.string().max(50000).optional().default(''),
}).omit({
  id: true,
  projectId: true,
  createdBy: true,
  comments: true,
  attachments: true,
  createdAt: true,
  updatedAt: true,
});

export const selectBugSchema = createSelectSchema(bugs);

export type Bug = z.infer<typeof selectBugSchema>;
export type InsertBug = z.infer<typeof insertBugSchema>;
