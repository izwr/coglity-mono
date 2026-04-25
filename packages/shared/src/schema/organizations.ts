import { pgTable, uuid, varchar, timestamp, pgEnum, primaryKey } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { users } from "./users.js";

export const orgRoleEnum = pgEnum("org_role", ["super_admin", "member"]);
export const ORG_ROLES = ["super_admin", "member"] as const;
export type OrgRole = (typeof ORG_ROLES)[number];

export const orgJoinedViaEnum = pgEnum("org_joined_via", ["creation", "invite"]);

export const organizations = pgTable("organizations", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull().unique(),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const organizationMembers = pgTable(
  "organization_members",
  {
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    orgRole: orgRoleEnum("org_role").notNull().default("member"),
    joinedVia: orgJoinedViaEnum("joined_via").notNull().default("invite"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.organizationId, table.userId] })],
);

export const insertOrganizationSchema = createInsertSchema(organizations, {
  name: (schema) => schema.min(1, "Name is required").max(255),
}).omit({ id: true, createdBy: true, createdAt: true, updatedAt: true });

export const selectOrganizationSchema = createSelectSchema(organizations);
export const selectOrganizationMemberSchema = createSelectSchema(organizationMembers);

export type Organization = z.infer<typeof selectOrganizationSchema>;
export type InsertOrganization = z.infer<typeof insertOrganizationSchema>;
export type OrganizationMember = z.infer<typeof selectOrganizationMemberSchema>;
