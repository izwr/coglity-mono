import { eq, and, sql, between } from "drizzle-orm";
import {
  billingAccount,
  billingEvents,
  pricing,
  reservations,
  runTypeLimits,
  type UsageEvent,
} from "@coglity/shared/schema";
import { db } from "../db";

type AccountWithReserved = {
  accountId: string;
  organisationId: string;
  accountType: "credit" | "debit";
  consumptionLimit: string;
  balance: string;
  reservedBalance: number;
  available: number;
};

export async function getAccountWithReserved(
  orgId: string,
): Promise<AccountWithReserved | null> {
  const rows = await db
    .select({
      accountId: billingAccount.accountId,
      organisationId: billingAccount.organisationId,
      accountType: billingAccount.accountType,
      consumptionLimit: billingAccount.consumptionLimit,
      balance: billingAccount.balance,
      reservedBalance:
        sql<number>`coalesce(sum(${reservations.estimatedCost}), 0)`.as(
          "reserved_balance",
        ),
    })
    .from(billingAccount)
    .leftJoin(
      reservations,
      and(
        eq(reservations.organisationId, billingAccount.organisationId),
        eq(reservations.status, "pending"),
      ),
    )
    .where(eq(billingAccount.organisationId, orgId))
    .groupBy(billingAccount.accountId);

  if (rows.length === 0) return null;

  const row = rows[0];
  const balance = Number(row.balance);
  const reserved = Number(row.reservedBalance);
  const limit = Number(row.consumptionLimit);
  let available = balance - reserved;
  if (row.accountType === "credit") {
    available += limit;
  }

  return { ...row, reservedBalance: reserved, available };
}

export async function reserve(
  orgId: string,
  correlationId: string,
  runType: string,
): Promise<{ allowed: boolean; reservationId?: string }> {
  const [limit] = await db
    .select({ minBalance: runTypeLimits.minBalance })
    .from(runTypeLimits)
    .where(eq(runTypeLimits.runType, runType));

  if (!limit) {
    throw new RunTypeNotFoundError(runType);
  }

  const minBalance = Number(limit.minBalance);

  return await db.transaction(async (tx) => {
    // Lock the billing account row to serialize concurrent reserves
    const [locked] = await tx.execute(
      sql`SELECT account_id, balance, consumption_limit, account_type
          FROM billing_account
          WHERE organisation_id = ${orgId}
          FOR UPDATE`,
    );

    if (!locked) {
      throw new AccountNotFoundError(orgId);
    }

    const balance = Number(locked.balance);
    const consumptionLimit = Number(locked.consumption_limit);
    const accountType = locked.account_type as string;

    // Derive reserved balance from pending reservations
    const [{ total }] = await tx
      .select({
        total: sql<number>`coalesce(sum(${reservations.estimatedCost}), 0)`,
      })
      .from(reservations)
      .where(
        and(
          eq(reservations.organisationId, orgId),
          eq(reservations.status, "pending"),
        ),
      );

    let available = balance - Number(total) - minBalance;
    if (accountType === "credit") {
      available += consumptionLimit;
    }

    if (available < 0) {
      return { allowed: false };
    }

    const [inserted] = await tx
      .insert(reservations)
      .values({
        correlationId,
        organisationId: orgId,
        runType,
        estimatedCost: String(minBalance),
        status: "pending",
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      })
      .returning({ reservationId: reservations.reservationId });

    return { allowed: true, reservationId: inserted.reservationId };
  });
}

export async function getBalance(orgId: string) {
  const account = await getAccountWithReserved(orgId);
  if (!account) throw new AccountNotFoundError(orgId);

  return {
    balance: Number(account.balance),
    available: account.available,
    accountType: account.accountType,
    consumptionLimit: Number(account.consumptionLimit),
    reservedBalance: account.reservedBalance,
  };
}

export async function canRun(orgId: string, runType: string) {
  const [limit] = await db
    .select({ minBalance: runTypeLimits.minBalance })
    .from(runTypeLimits)
    .where(eq(runTypeLimits.runType, runType));

  if (!limit) throw new RunTypeNotFoundError(runType);

  const account = await getAccountWithReserved(orgId);
  if (!account) throw new AccountNotFoundError(orgId);

  const minBalance = Number(limit.minBalance);
  return {
    canRun: account.available >= minBalance,
    available: account.available,
  };
}

export async function batchInsertBillingEvents(
  events: UsageEvent[],
): Promise<void> {
  if (events.length === 0) return;

  await db
    .insert(billingEvents)
    .values(
      events.map((e) => ({
        eventId: e.event_id,
        correlationId: e.correlation_id,
        projectId: e.project_id,
        organisationId: e.organisation_id,
        timestamp: new Date(e.timestamp),
        sku: e.sku,
        consumptionQty: String(e.consumption_qty),
      })),
    )
    .onConflictDoNothing();
}

export async function reconcile(correlationId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const [reservation] = await tx
      .select()
      .from(reservations)
      .where(
        and(
          eq(reservations.correlationId, correlationId),
          eq(reservations.status, "pending"),
        ),
      );

    if (!reservation) return;

    const [{ totalCost }] = await tx
      .select({
        totalCost:
          sql<number>`coalesce(sum(${billingEvents.consumptionQty}::numeric * ${pricing.unitPrice}::numeric), 0)`,
      })
      .from(billingEvents)
      .innerJoin(
        pricing,
        and(
          eq(billingEvents.sku, pricing.skuId),
          sql`${billingEvents.timestamp} >= ${pricing.validFrom}`,
          sql`${billingEvents.timestamp} < coalesce(${pricing.validTill}, 'infinity'::timestamptz)`,
        ),
      )
      .where(eq(billingEvents.correlationId, correlationId));

    const cost = Number(totalCost);

    await tx
      .update(billingAccount)
      .set({
        balance: sql`${billingAccount.balance}::numeric - ${cost}`,
      })
      .where(eq(billingAccount.organisationId, reservation.organisationId));

    await tx
      .update(reservations)
      .set({ status: "settled", actualCost: String(cost) })
      .where(eq(reservations.reservationId, reservation.reservationId));
  });
}

export async function updateAccount(
  orgId: string,
  data: { accountType?: "credit" | "debit"; consumptionLimit?: number },
) {
  const set: Record<string, unknown> = {};
  if (data.accountType !== undefined) set.accountType = data.accountType;
  if (data.consumptionLimit !== undefined)
    set.consumptionLimit = String(data.consumptionLimit);

  if (Object.keys(set).length === 0) {
    throw new Error("No fields to update");
  }

  const [updated] = await db
    .update(billingAccount)
    .set(set)
    .where(eq(billingAccount.organisationId, orgId))
    .returning();

  if (!updated) throw new AccountNotFoundError(orgId);
  return updated;
}

export async function addCredits(orgId: string, amount: number) {
  if (amount <= 0) throw new Error("Amount must be positive");

  const [updated] = await db
    .update(billingAccount)
    .set({
      balance: sql`${billingAccount.balance}::numeric + ${amount}`,
    })
    .where(eq(billingAccount.organisationId, orgId))
    .returning();

  if (!updated) throw new AccountNotFoundError(orgId);
  return updated;
}

export async function getUsage(
  orgId: string,
  from: Date,
  to: Date,
) {
  const rows = await db
    .select({
      sku: billingEvents.sku,
      totalQty: sql<number>`sum(${billingEvents.consumptionQty}::numeric)`,
      totalCost:
        sql<number>`sum(${billingEvents.consumptionQty}::numeric * ${pricing.unitPrice}::numeric)`,
      eventCount: sql<number>`count(*)::int`,
    })
    .from(billingEvents)
    .innerJoin(
      pricing,
      and(
        eq(billingEvents.sku, pricing.skuId),
        sql`${billingEvents.timestamp} >= ${pricing.validFrom}`,
        sql`${billingEvents.timestamp} < coalesce(${pricing.validTill}, 'infinity'::timestamptz)`,
      ),
    )
    .where(
      and(
        eq(billingEvents.organisationId, orgId),
        sql`${billingEvents.timestamp} >= ${from}`,
        sql`${billingEvents.timestamp} < ${to}`,
      ),
    )
    .groupBy(billingEvents.sku);

  return rows;
}

export class AccountNotFoundError extends Error {
  constructor(orgId: string) {
    super(`Billing account not found for organisation ${orgId}`);
    this.name = "AccountNotFoundError";
  }
}

export class RunTypeNotFoundError extends Error {
  constructor(runType: string) {
    super(`Unknown run type: ${runType}`);
    this.name = "RunTypeNotFoundError";
  }
}
