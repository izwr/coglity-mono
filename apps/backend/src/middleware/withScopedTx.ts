import type { Request, Response, NextFunction } from 'express';
import { sql } from 'drizzle-orm';
import { db } from '../db';

/**
 * Wraps the request in a single DB transaction, exposed to handlers as `req.db`.
 * Route handlers should use `req.db` (NOT the raw `db` import) so all of their writes
 * commit or roll back together.
 *
 * Tenant isolation: this also sets the app.user_id / app.org_id / app.project_id Postgres
 * session variables, but RLS is currently DISABLED (see 0013_disable_rls.sql) so those
 * variables gate nothing they are kept only so RLS can be re-enabled later. Isolation
 * therefore relies ENTIRELY on each handler adding an explicit `where project_id = …`
 * clause; there is no database-level safety net.
 *
 * Commit ordering: the response is buffered and only flushed to the client AFTER the
 * transaction commits. This prevents reporting success to the client when COMMIT fails,
 * and releases the pooled connection as soon as the handler finishes rather than holding
 * it open for the entire (possibly slow) client download.
 */
export function withScopedTx(req: Request, res: Response, next: NextFunction): void {
  const userId = req.session?.userId;
  if (!userId) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  const realEnd = res.end.bind(res) as (...args: any[]) => Response;
  let ended = false;
  let aborted = false;
  let bufferedEndArgs: any[] = [];
  let resolveDone!: () => void;
  const afterCommitCallbacks: Array<() => void | Promise<void>> = [];
  const afterRollbackCallbacks: Array<() => void | Promise<void>> = [];
  const handlerDone = new Promise<void>((resolve) => {
    resolveDone = resolve;
  });

  req.afterCommit = (callback) => {
    afterCommitCallbacks.push(callback);
  };
  req.afterRollback = (callback) => {
    afterRollbackCallbacks.push(callback);
  };

  // Intercept res.end so the commit can happen before the bytes are flushed. For a normal
  // JSON response res.end has not yet flushed headers, so we capture its args and replay
  // them post-commit. A streaming response (res.write already sent headers) cannot be
  // buffered, so we let it through and accept commit-after-flush for those read-only routes.
  res.end = function (this: Response, ...args: any[]): Response {
    if (ended) return this;
    ended = true;
    if (res.headersSent) {
      resolveDone();
      return realEnd(...args);
    }
    bufferedEndArgs = args;
    resolveDone();
    return this;
  } as Response['end'];

  // Client disconnected before the handler produced a response — roll back.
  res.once('close', () => {
    if (!ended) {
      aborted = true;
      resolveDone();
    }
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

    next();
    await handlerDone;

    // Roll back (by throwing) on a 5xx or a client abort; 2xx/3xx/4xx commit.
    if (aborted) throw new RollbackSignal('aborted');
    if (res.statusCode >= 500) throw new RollbackSignal('http5xx');
    // Returning commits the transaction.
  })
    .then(() => {
      res.end = realEnd as Response['end'];
      if (!aborted && !res.writableEnded) {
        realEnd(...bufferedEndArgs);
      }
      void runCallbacks(afterCommitCallbacks, 'afterCommit');
    })
    .catch((err) => {
      res.end = realEnd as Response['end'];
      void runCallbacks(afterRollbackCallbacks, 'afterRollback');
      // Expected rollback: the handler already built a 4xx/5xx body — flush it as-is.
      if (err instanceof RollbackSignal) {
        if (err.kind === 'http5xx' && !res.writableEnded) {
          realEnd(...bufferedEndArgs);
        }
        return;
      }
      // Unexpected error thrown by the transaction body itself.
      console.error('withScopedTx error:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Internal error' });
      } else if (!res.writableEnded) {
        realEnd();
      }
    });
}

async function runCallbacks(callbacks: Array<() => void | Promise<void>>, label: string) {
  for (const callback of callbacks) {
    try {
      await callback();
    } catch (err) {
      console.error(`[withScopedTx] ${label} callback failed:`, err);
    }
  }
}

/**
 * Internal marker used to force a transaction rollback when the handler signalled failure
 * (a 5xx status, or a client abort) without throwing. Kept distinct from real errors so the
 * catch handler can tell them apart.
 */
class RollbackSignal extends Error {
  constructor(public readonly kind: 'http5xx' | 'aborted') {
    super(kind);
  }
}
