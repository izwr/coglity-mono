import { pgTable, uuid, varchar, text, timestamp, numeric, integer, boolean, jsonb, pgEnum } from "drizzle-orm/pg-core";
import { users } from "./users.js";

export const billingModeEnum = pgEnum("billing_mode", ["prepaid", "postpaid"]);
export const transactionTypeEnum = pgEnum("transaction_type", ["credit", "debit"]);
export const usageEventStatusEnum = pgEnum("usage_event_status", ["pending", "processed", "failed"]);

export const resourceTypes = pgTable("resource_types", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 100 }).notNull().unique(),
  description: text("description"),
  baseCuCost: numeric("base_cu_cost", { precision: 10, scale: 2 }).notNull(),
  unit: varchar("unit", { length: 50 }).default("per_run").notNull(),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const cuAccounts = pgTable("cu_accounts", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  balance: numeric("balance", { precision: 14, scale: 2 }).default("0.00").notNull(),
  billingMode: billingModeEnum("billing_mode").default("prepaid").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const cuPricingTiers = pgTable("cu_pricing_tiers", {
  id: uuid("id").defaultRandom().primaryKey(),
  resourceTypeId: uuid("resource_type_id").notNull().references(() => resourceTypes.id, { onDelete: "cascade" }),
  tierOrder: integer("tier_order").notNull(),
  fromCu: integer("from_cu").notNull(),
  toCu: integer("to_cu"),
  cuMultiplier: numeric("cu_multiplier", { precision: 10, scale: 4 }).default("1.0000").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const cuTransactions = pgTable("cu_transactions", {
  id: uuid("id").defaultRandom().primaryKey(),
  accountId: uuid("account_id").notNull().references(() => cuAccounts.id, { onDelete: "cascade" }),
  type: transactionTypeEnum("type").notNull(),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  balanceAfter: numeric("balance_after", { precision: 14, scale: 2 }).notNull(),
  description: text("description"),
  referenceId: uuid("reference_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const cuUsageEvents = pgTable("cu_usage_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  resourceTypeId: uuid("resource_type_id").notNull().references(() => resourceTypes.id),
  quantity: integer("quantity").default(1).notNull(),
  metadata: jsonb("metadata"),
  status: usageEventStatusEnum("status").default("pending").notNull(),
  processedAt: timestamp("processed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
