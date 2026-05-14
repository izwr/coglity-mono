import { pgTable, uuid, text, timestamp, numeric, pgEnum, primaryKey, index, unique } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { organizations } from "./organizations";

export const billingAccountTypeEnum = pgEnum("billing_account_type", ["credit", "debit"]);
export const reservationStatusEnum = pgEnum("reservation_status", ["pending", "settled", "expired"]);

export const billingAccount = pgTable("billing_account", {
  accountId: uuid("account_id").defaultRandom().primaryKey(),
  organisationId: uuid("organisation_id")
    .notNull()
    .unique()
    .references(() => organizations.id, { onDelete: "cascade" }),
  accountType: billingAccountTypeEnum("account_type").notNull(),
  consumptionLimit: numeric("consumption_limit", { precision: 14, scale: 2 }).default("0").notNull(),
  balance: numeric("balance", { precision: 14, scale: 2 }).default("0").notNull(),
});

export const billingEvents = pgTable(
  "billing_events",
  {
    eventId: text("event_id").notNull(),
    correlationId: text("correlation_id").notNull(),
    projectId: uuid("project_id").notNull(),
    organisationId: uuid("organisation_id").notNull(),
    timestamp: timestamp("timestamp", { withTimezone: true }).notNull(),
    sku: text("sku").notNull(),
    consumptionQty: numeric("consumption_qty", { precision: 14, scale: 4 }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.eventId, table.timestamp] }),
    index("idx_billing_events_org_time").on(table.organisationId, table.timestamp),
    index("idx_billing_events_correlation").on(table.correlationId),
  ],
);

export const sku = pgTable("sku", {
  skuId: text("sku_id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
});

export const pricing = pgTable("pricing", {
  pricingId: uuid("pricing_id").defaultRandom().primaryKey(),
  skuId: text("sku_id")
    .notNull()
    .references(() => sku.skuId),
  name: text("name").notNull(),
  unitPrice: numeric("unit_price", { precision: 14, scale: 6 }).notNull(),
  validFrom: timestamp("valid_from", { withTimezone: true }).notNull(),
  validTill: timestamp("valid_till", { withTimezone: true }),
});

export const runTypeLimits = pgTable("run_type_limits", {
  runType: text("run_type").primaryKey(),
  minBalance: numeric("min_balance", { precision: 14, scale: 2 }).notNull(),
});

export const reservations = pgTable(
  "reservations",
  {
    reservationId: uuid("reservation_id").defaultRandom().primaryKey(),
    correlationId: text("correlation_id").notNull().unique(),
    organisationId: uuid("organisation_id").notNull(),
    runType: text("run_type")
      .notNull()
      .references(() => runTypeLimits.runType),
    estimatedCost: numeric("estimated_cost", { precision: 14, scale: 2 }).notNull(),
    actualCost: numeric("actual_cost", { precision: 14, scale: 2 }),
    status: reservationStatusEnum("status").default("pending").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => [index("idx_reservations_org_status").on(table.organisationId, table.status)],
);

export const insertBillingAccountSchema = createInsertSchema(billingAccount).omit({
  accountId: true,
});

export const selectBillingAccountSchema = createSelectSchema(billingAccount);

export const reserveRequestSchema = z.object({
  organisation_id: z.uuid(),
  correlation_id: z.string().min(1),
  run_type: z.string().min(1),
});

export const usageEventSchema = z.object({
  event_id: z.string().min(1),
  correlation_id: z.string().min(1),
  project_id: z.uuid(),
  organisation_id: z.uuid(),
  sku: z.string().min(1),
  consumption_qty: z.number().positive(),
  timestamp: z.iso.datetime(),
});

export const completionEventSchema = z.object({
  event_type: z.literal("run_completed"),
  correlation_id: z.string().min(1),
});

export type BillingAccount = z.infer<typeof selectBillingAccountSchema>;
export type InsertBillingAccount = z.infer<typeof insertBillingAccountSchema>;
export type ReserveRequest = z.infer<typeof reserveRequestSchema>;
export type UsageEvent = z.infer<typeof usageEventSchema>;
export type CompletionEvent = z.infer<typeof completionEventSchema>;
