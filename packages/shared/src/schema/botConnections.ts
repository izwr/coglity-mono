import { pgTable, uuid, varchar, text, timestamp, pgEnum, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { users } from "./users.js";
import { projects } from "./projects.js";

export const botTypeEnum = pgEnum("bot_type", ["voice", "chat"]);

export const connectionProviderEnum = pgEnum("connection_provider", [
  "dialin",
  "websocket",
  "http",
]);

export const botConnections = pgTable("bot_connections", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  botType: botTypeEnum("bot_type").notNull(),
  provider: connectionProviderEnum("provider").notNull(),
  config: jsonb("config").default({}).notNull(),
  description: text("description").default("").notNull(),
  createdBy: uuid("created_by").references(() => users.id),
  updatedBy: uuid("updated_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertBotConnectionSchema = createInsertSchema(botConnections, {
  name: (schema) => schema.min(1, "Name is required").max(255),
  description: (schema) => schema.max(2000).optional().default(""),
}).omit({ id: true, projectId: true, createdBy: true, updatedBy: true, createdAt: true, updatedAt: true });

export const selectBotConnectionSchema = createSelectSchema(botConnections);

export type BotConnection = z.infer<typeof selectBotConnectionSchema>;
export type InsertBotConnection = z.infer<typeof insertBotConnectionSchema>;
