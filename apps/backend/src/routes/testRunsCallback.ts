import express, { type Router as RouterType, Router } from "express";
import { eq } from "drizzle-orm";
import { testRuns, updateTestRunSchema, type TestRunProperties } from "@coglity/shared/schema";
import { db } from "../db.js";

const router: RouterType = Router();

// Mounted OUTSIDE the session auth chain. Protected by a shared secret header.
router.use(express.json({ limit: "5mb" })); // transcripts can be large-ish

function requireSecret(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): void {
  const expected = process.env.EXECUTOR_WEBHOOK_SECRET ?? "";
  const actual = req.header("x-webhook-secret") ?? "";
  if (!expected || actual !== expected) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  next();
}

router.patch("/:id", requireSecret, async (req, res) => {
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
    .where(eq(testRuns.id, req.params.id as string))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Test run not found" });
    return;
  }
  res.json(updated);
});

export default router;
