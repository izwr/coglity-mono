import express, { type Router as RouterType, Router } from 'express';
import { and, eq, inArray } from 'drizzle-orm';
import crypto from 'node:crypto';
import { knowledgeSources } from '@coglity/shared/schema';
import { db } from '../db';

const router: RouterType = Router();

router.use(express.json());

// Constant-time comparison so the shared secret can't be recovered via timing.
function secretMatches(actual: string, expected: string): boolean {
  if (!expected) return false;
  const a = Buffer.from(actual);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function requireSecret(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): void {
  const expected = process.env.EXECUTOR_WEBHOOK_SECRET ?? '';
  const actual = req.header('x-webhook-secret') ?? '';
  if (!secretMatches(actual, expected)) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }
  next();
}

// Indexing can only be finalized while the source is still pending/processing. Once it is
// indexed or failed the callback is a no-op, so a replayed/forged call can't flip a finished
// source's status or chunk metadata.
const MUTABLE_STATES = ['pending', 'processing'] as const;

router.patch('/:id', requireSecret, async (req, res) => {
  const { status, chunkCount, indexedAt, errorMessage } = req.body;
  if (!status || (status !== 'indexed' && status !== 'failed')) {
    res.status(400).json({ error: 'status must be indexed or failed' });
    return;
  }

  const set: Record<string, unknown> = {
    status,
    updatedAt: new Date(),
  };
  if (status === 'indexed') {
    set.chunkCount = chunkCount ?? 0;
    set.indexedAt = indexedAt ? new Date(indexedAt) : new Date();
    set.errorMessage = null;
  } else {
    set.errorMessage = errorMessage ?? 'Unknown error';
  }

  const [updated] = await db
    .update(knowledgeSources)
    .set(set)
    .where(
      and(
        eq(knowledgeSources.id, req.params.id as string),
        inArray(knowledgeSources.status, MUTABLE_STATES),
      ),
    )
    .returning();
  if (!updated) {
    res.status(404).json({ error: 'Knowledge source not found or already finalized' });
    return;
  }
  res.json(updated);
});

export default router;
