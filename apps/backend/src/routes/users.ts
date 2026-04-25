import { type Router as RouterType, Router } from "express";
import { eq } from "drizzle-orm";
import { projectMembers, users } from "@coglity/shared/schema";
import { db as rootDb } from "../db.js";

const router: RouterType = Router({ mergeParams: true });

type DbHandle = typeof rootDb;

/**
 * Project-scoped user directory. Used by assignee dropdowns (bugs, scheduled
 * test cases). Returns only users who are explicit members of the current
 * project does NOT leak the full org user list. Super admins see members
 * plus themselves (since their access isn't via project_members).
 */
router.get("/", async (req, res) => {
  const db = (req.db ?? rootDb) as DbHandle;
  const projectId = req.projectId!;
  const rows = await db
    .select({
      id: users.id,
      displayName: users.displayName,
      email: users.email,
    })
    .from(projectMembers)
    .innerJoin(users, eq(projectMembers.userId, users.id))
    .where(eq(projectMembers.projectId, projectId))
    .orderBy(users.displayName);
  res.json(rows);
});

export default router;
