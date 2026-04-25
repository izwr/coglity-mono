import { pgTable, uuid, varchar, jsonb, timestamp, index } from "drizzle-orm/pg-core";
import { createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { users } from "./users.js";
import { organizations } from "./organizations.js";
import { projects } from "./projects.js";

export const RBAC_AUDIT_ACTIONS = [
  "create_org",
  "delete_org",
  "add_org_member",
  "remove_org_member",
  "change_org_role",
  "create_project",
  "delete_project",
  "add_project_member",
  "remove_project_member",
  "change_project_role",
  "create_invite",
  "revoke_invite",
  "consume_invite",
] as const;

export type RbacAuditAction = (typeof RBAC_AUDIT_ACTIONS)[number];

export const rbacAuditLog = pgTable(
  "rbac_audit_log",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    actorUserId: uuid("actor_user_id").references(() => users.id),
    targetUserId: uuid("target_user_id").references(() => users.id),
    organizationId: uuid("organization_id").references(() => organizations.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }),
    action: varchar("action", { length: 50 }).notNull().$type<RbacAuditAction>(),
    fromRole: varchar("from_role", { length: 20 }),
    toRole: varchar("to_role", { length: 20 }),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("rbac_audit_org_created_idx").on(table.organizationId, table.createdAt)],
);

export const selectRbacAuditLogSchema = createSelectSchema(rbacAuditLog);
export type RbacAuditLogRow = z.infer<typeof selectRbacAuditLogSchema>;
