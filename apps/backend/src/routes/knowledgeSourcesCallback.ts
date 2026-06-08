import express, { type Router as RouterType, Router } from 'express';
import { eq } from 'drizzle-orm';
import { knowledgeSources } from '@coglity/shared/schema';
import { db } from '../db';

const router: RouterType = Router();

router.use(express.json());

function requireSecret(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): void {
  const expected = process.env.EXECUTOR_WEBHOOK_SECRET ?? '';
  const actual = req.header('x-webhook-secret') ?? '';
  if (!expected || actual !== expected) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }
  next();
}

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
    .where(eq(knowledgeSources.id, req.params.id as string))
    .returning();
  if (!updated) {
    res.status(404).json({ error: 'Knowledge source not found' });
    return;
  }
  res.json(updated);
});

export default router;
