import { pgTable, uuid, varchar, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { users } from "./users.js";
import { organizations } from "./organizations.js";
import { projects, projectRoleEnum } from "./projects.js";

export const invites = pgTable(
  "invites",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    token: varchar("token", { length: 64 }).notNull(),
    email: varchar("email", { length: 255 }).notNull(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    projectRole: projectRoleEnum("project_role").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    consumedByUserId: uuid("consumed_by_user_id").references(() => users.id),
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("invites_email_org_idx").on(table.email, table.organizationId),
    uniqueIndex("invites_active_token_uniq")
      .on(table.token)
      .where(sql`${table.consumedAt} IS NULL`),
  ],
);

export const insertInviteSchema = createInsertSchema(invites, {
  email: (schema) => schema.min(3).max(255),
}).omit({
  id: true,
  token: true,
  expiresAt: true,
  consumedAt: true,
  consumedByUserId: true,
  createdBy: true,
  createdAt: true,
});

export const selectInviteSchema = createSelectSchema(invites);

export type Invite = z.infer<typeof selectInviteSchema>;
export type InsertInvite = z.infer<typeof insertInviteSchema>;
