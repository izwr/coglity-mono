import { type Router as RouterType, Router } from "express";
import { users } from "@coglity/shared/schema";
import { db } from "../db.js";

const router: RouterType = Router();

// List all users (id, displayName, email)
router.get("/", async (_req, res) => {
  const rows = await db
    .select({
      id: users.id,
      displayName: users.displayName,
      email: users.email,
    })
    .from(users)
    .orderBy(users.displayName);
  res.json(rows);
});

export default router;