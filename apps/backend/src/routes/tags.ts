import { type Router as RouterType, Router } from "express";
import { eq, and } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { tags, insertTagSchema, users } from "@coglity/shared/schema";
import { db as rootDb } from "../db.js";

const router: RouterType = Router({ mergeParams: true });

type DbHandle = typeof rootDb;

const createdByUser = alias(users, "createdByUser");
const updatedByUser = alias(users, "updatedByUser");

const tagColumns = {
  id: tags.id,
  projectId: tags.projectId,
  name: tags.name,
  description: tags.description,
  createdBy: tags.createdBy,
  updatedBy: tags.updatedBy,
  createdAt: tags.createdAt,
  updatedAt: tags.updatedAt,
  createdByName: createdByUser.displayName,
  updatedByName: updatedByUser.displayName,
} as const;

function tagsBaseQuery(db: DbHandle) {
  return db
    .select(tagColumns)
    .from(tags)
    .leftJoin(createdByUser, eq(tags.createdBy, createdByUser.id))
    .leftJoin(updatedByUser, eq(tags.updatedBy, updatedByUser.id));
}

router.get("/", async (req, res) => {
  const db = (req.db ?? rootDb) as DbHandle;
  const projectId = req.projectId!;
  const results = await tagsBaseQuery(db).where(eq(tags.projectId, projectId)).orderBy(tags.createdAt);
  res.json(results);
});

router.get("/:id", async (req, res) => {
  const db = (req.db ?? rootDb) as DbHandle;
  const projectId = req.projectId!;
  const [tag] = await tagsBaseQuery(db).where(and(eq(tags.id, req.params.id as string), eq(tags.projectId, projectId)));
  if (!tag) {
    res.status(404).json({ error: "Tag not found" });
    return;
  }
  res.json(tag);
});

router.post("/", async (req, res) => {
  const db = (req.db ?? rootDb) as DbHandle;
  const projectId = req.projectId!;
  const parsed = insertTagSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    return;
  }
  const userId = req.session.userId;
  const [inserted] = await db
    .insert(tags)
    .values({ ...parsed.data, projectId, createdBy: userId, updatedBy: userId })
    .returning();
  const [tag] = await tagsBaseQuery(db).where(eq(tags.id, inserted.id));
  res.status(201).json(tag);
});

router.put("/:id", async (req, res) => {
  const db = (req.db ?? rootDb) as DbHandle;
  const projectId = req.projectId!;
  const parsed = insertTagSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    return;
  }
  const userId = req.session.userId;
  const [updated] = await db
    .update(tags)
    .set({ ...parsed.data, updatedBy: userId, updatedAt: new Date() })
    .where(and(eq(tags.id, req.params.id as string), eq(tags.projectId, projectId)))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Tag not found" });
    return;
  }
  const [tag] = await tagsBaseQuery(db).where(eq(tags.id, updated.id));
  res.json(tag);
});

router.delete("/:id", async (req, res) => {
  const db = (req.db ?? rootDb) as DbHandle;
  const projectId = req.projectId!;
  const [deleted] = await db
    .delete(tags)
    .where(and(eq(tags.id, req.params.id as string), eq(tags.projectId, projectId)))
    .returning({ id: tags.id });
  if (!deleted) {
    res.status(404).json({ error: "Tag not found" });
    return;
  }
  res.status(204).send();
});

export default router;
