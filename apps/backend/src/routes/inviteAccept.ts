import { Router, type Router as RouterType } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/requireAuth.js";
import { consumeInvite, RbacError } from "../services/rbac.js";

const router: RouterType = Router();

const acceptSchema = z.object({ token: z.string().min(20).max(128) });

// Simple in-memory rate limit: 10 tokens per minute per user.
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 10;
const buckets = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (bucket.count >= RATE_LIMIT_MAX) return false;
  bucket.count += 1;
  return true;
}

router.post("/", requireAuth, async (req, res) => {
  const parsed = acceptSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    return;
  }
  const userId = req.session.userId!;
  const email = req.session.email;
  if (!email) {
    res.status(400).json({ error: "Session missing email" });
    return;
  }
  if (!checkRateLimit(userId)) {
    res.status(429).json({ error: "Rate limit exceeded" });
    return;
  }
  try {
    const result = await consumeInvite({ token: parsed.data.token, userId, userEmail: email });
    res.status(200).json(result);
  } catch (err) {
    if (err instanceof RbacError) {
      res.status(err.status).json({ error: err.code, message: err.message });
      return;
    }
    throw err;
  }
});

export default router;
