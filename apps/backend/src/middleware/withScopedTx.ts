import type { Request, Response, NextFunction } from "express";
import { sql } from "drizzle-orm";
import { db } from "../db.js";

/**
 * Wraps the request in a DB transaction and sets Postgres session variables that
 * RLS policies depend on. `req.db` MUST be used by route handlers (instead of the
 * raw `db` import) otherwise queries run outside the transaction and hit RLS
 * with no context set, returning zero rows.
 */
export function withScopedTx(req: Request, res: Response, next: NextFunction): void {
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
    if (req.organizationId) {
      await tx.execute(sql`SELECT set_config('app.org_id', ${req.organizationId}, true)`);
    }
    if (req.projectId) {
      await tx.execute(sql`SELECT set_config('app.project_id', ${req.projectId}, true)`);
    }
    req.db = tx as unknown as typeof db;

    const wait = waitForResponse();
    next();
    await wait;

    if (res.statusCode >= 500 || passThroughError) {
      throw passThroughError ?? new Error(`HTTP ${res.statusCode}`);
    }
  }).catch((err) => {
    if (!res.headersSent) {
      // Distinguish our own rollback-on-5xx from a real caught error.
      if (err instanceof Error && /^HTTP 5\d\d$/.test(err.message)) {
        return;
      }
      console.error("withScopedTx error:", err);
      res.status(500).json({ error: "Internal error" });
    }
  });
}
