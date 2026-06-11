import express, { type Router as RouterType, Router } from 'express';
import { and, eq, inArray } from 'drizzle-orm';
import crypto from 'node:crypto';
import { testRuns, updateTestRunSchema, type TestRunProperties } from '@coglity/shared/schema';
import { db } from '../db';

const router: RouterType = Router();

// Mounted OUTSIDE the session auth chain. Protected by a shared secret header.
router.use(express.json({ limit: '5mb' })); // transcripts can be large-ish

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

// A run can only be mutated while it is still in flight. Once it reaches a terminal state the
// webhook becomes a no-op, so a replayed or forged callback cannot overwrite a finished run's
// verdict/recording (and cannot plant an attacker-chosen recordingBlobName after the fact).
const MUTABLE_STATES = ['queued', 'running'] as const;

router.patch('/:id', requireSecret, async (req, res) => {
  const parsed = updateTestRunSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    return;
  }
  const setData = {
    ...parsed.data,
    ...(parsed.data.properties ? { properties: parsed.data.properties as TestRunProperties } : {}),
  };
  const [updated] = await db
    .update(testRuns)
    .set(setData)
    .where(and(eq(testRuns.id, req.params.id as string), inArray(testRuns.state, MUTABLE_STATES)))
    .returning();
  if (!updated) {
    res.status(404).json({ error: 'Test run not found or already finalized' });
    return;
  }
  res.json(updated);
});

export default router;
