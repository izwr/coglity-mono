import type { Request, Response, NextFunction } from "express";
import { sql } from "drizzle-orm";
import { db } from "../db.js";

/**
 * Narrow variant of withScopedTx used only by POST /api/invites/accept.
 * The caller does not yet belong to the target organization, so we cannot
 * set app.org_id. Instead we set app.invite_accept = 'true' which unlocks
 * the invite-row read policy installed in 0012_rls_policies.sql.
 */
export function withInviteAcceptTx(req: Request, res: Response, next: NextFunction): void {
  const userId = req.session?.userId;
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  let settled = false;
  let passThroughError: unknown = undefined;

  const waitForResponse = () =>
    new Promise<void>((resolve, reject) => {
      const finish = () => {
        if (settled) return;
        settled = true;
        if (passThroughError) reject(passThroughError);
        else resolve();
      };
      res.once("finish", finish);
      res.once("close", finish);
      res.once("error", (err) => {
        passThroughError = err;
        finish();
      });
    });

  db.transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('app.user_id', ${userId}, true)`);
    await tx.execute(sql`SELECT set_config('app.invite_accept', 'true', true)`);
    req.db = tx as unknown as typeof db;

    const wait = waitForResponse();
    next();
    await wait;

    if (res.statusCode >= 500 || passThroughError) {
      throw passThroughError ?? new Error(`HTTP ${res.statusCode}`);
    }
  }).catch((err) => {
    if (!res.headersSent) {
      if (err instanceof Error && /^HTTP 5\d\d$/.test(err.message)) return;
      console.error("withInviteAcceptTx error:", err);
      res.status(500).json({ error: "Internal error" });
    }
  });
}
