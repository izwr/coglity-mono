import { pgTable, uuid, varchar, text, timestamp, pgEnum, primaryKey, unique } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { users } from "./users.js";
import { organizations } from "./organizations.js";

export const projectRoleEnum = pgEnum("project_role", ["admin", "writer", "read"]);
export const PROJECT_ROLES = ["admin", "writer", "read"] as const;
export type ProjectRole = (typeof PROJECT_ROLES)[number];

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description").default("").notNull(),
    createdBy: uuid("created_by").references(() => users.id),
    updatedBy: uuid("updated_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [unique("projects_org_name_uniq").on(table.organizationId, table.name)],
);

export const projectMembers = pgTable(
  "project_members",
  {
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: projectRoleEnum("role").notNull(),
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.projectId, table.userId] })],
);

export const insertProjectSchema = createInsertSchema(projects, {
  name: (schema) => schema.min(1, "Name is required").max(255),
  description: (schema) => schema.max(2000).optional().default(""),
}).omit({ id: true, createdBy: true, updatedBy: true, createdAt: true, updatedAt: true });

export const selectProjectSchema = createSelectSchema(projects);
export const selectProjectMemberSchema = createSelectSchema(projectMembers);

export type Project = z.infer<typeof selectProjectSchema>;
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type ProjectMember = z.infer<typeof selectProjectMemberSchema>;
