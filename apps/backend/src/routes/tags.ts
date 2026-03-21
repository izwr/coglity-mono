import { type Router as RouterType, Router } from "express";
import { eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { tags, insertTagSchema, users } from "@coglity/shared/schema";
import { db } from "../db.js";

const router: RouterType = Router();

const createdByUser = alias(users, "createdByUser");
const updatedByUser = alias(users, "updatedByUser");

const tagColumns = {
  id: tags.id,
  name: tags.name,
  description: tags.description,
  createdBy: tags.createdBy,
  updatedBy: tags.updatedBy,
  createdAt: tags.createdAt,
  updatedAt: tags.updatedAt,
  createdByName: createdByUser.displayName,
  updatedByName: updatedByUser.displayName,
} as const;

function tagsBaseQuery() {
  return db
    .select(tagColumns)
    .from(tags)
    .leftJoin(createdByUser, eq(tags.createdBy, createdByUser.id))
    .leftJoin(updatedByUser, eq(tags.updatedBy, updatedByUser.id));
}

// List all
router.get("/", async (_req, res) => {
  const results = await tagsBaseQuery().orderBy(tags.createdAt);
  res.json(results);
});

// Get by ID
router.get("/:id", async (req, res) => {
  const [tag] = await tagsBaseQuery().where(eq(tags.id, req.params.id));
  if (!tag) {
    res.status(404).json({ error: "Tag not found" });
    return;
  }
  res.json(tag);
});

// Create
router.post("/", async (req, res) => {
  const parsed = insertTagSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    return;
  }
  const userId = req.session.userId;
  const [inserted] = await db
    .insert(tags)
    .values({ ...parsed.data, createdBy: userId, updatedBy: userId })
    .returning();
  const [tag] = await tagsBaseQuery().where(eq(tags.id, inserted.id));
  res.status(201).json(tag);
});

// Update
router.put("/:id", async (req, res) => {
  const parsed = insertTagSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    return;
  }
  const userId = req.session.userId;
  const [updated] = await db
    .update(tags)
    .set({ ...parsed.data, updatedBy: userId, updatedAt: new Date() })
    .where(eq(tags.id, req.params.id))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Tag not found" });
    return;
  }
  const [tag] = await tagsBaseQuery().where(eq(tags.id, updated.id));
  res.json(tag);
});

// Delete
router.delete("/:id", async (req, res) => {
  const [deleted] = await db
    .delete(tags)
    .where(eq(tags.id, req.params.id))
    .returning({ id: tags.id });
  if (!deleted) {
    res.status(404).json({ error: "Tag not found" });
    return;
  }
  res.status(204).send();
});

export default router;