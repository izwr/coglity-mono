import { type Router as RouterType, Router } from "express";
import { eq, and, ilike, desc, asc, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import multer from "multer";
import { knowledgeSources, insertKnowledgeSourceSchema, users } from "@coglity/shared/schema";
import { db as rootDb } from "../db.js";
import { uploadBlob, deleteBlob } from "../lib/blobStorage.js";

const router: RouterType = Router({ mergeParams: true });
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

type DbHandle = typeof rootDb;

const createdByUser = alias(users, "createdByUser");
const updatedByUser = alias(users, "updatedByUser");

const columns = {
  id: knowledgeSources.id,
  projectId: knowledgeSources.projectId,
  name: knowledgeSources.name,
  sourceType: knowledgeSources.sourceType,
  url: knowledgeSources.url,
  description: knowledgeSources.description,
  createdBy: knowledgeSources.createdBy,
  updatedBy: knowledgeSources.updatedBy,
  createdAt: knowledgeSources.createdAt,
  updatedAt: knowledgeSources.updatedAt,
  createdByName: createdByUser.displayName,
  updatedByName: updatedByUser.displayName,
} as const;

function baseQuery(db: DbHandle) {
  return db
    .select(columns)
    .from(knowledgeSources)
    .leftJoin(createdByUser, eq(knowledgeSources.createdBy, createdByUser.id))
    .leftJoin(updatedByUser, eq(knowledgeSources.updatedBy, updatedByUser.id));
}

router.get("/", async (req, res) => {
  const db = (req.db ?? rootDb) as DbHandle;
  const projectId = req.projectId!;
  const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
  const sourceType = typeof req.query.sourceType === "string" ? req.query.sourceType : "";
  const sortBy = typeof req.query.sortBy === "string" ? req.query.sortBy : "createdAt";
  const sortDir = req.query.sortDir === "asc" ? "asc" : "desc";
  const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? "10"), 10) || 10));

  const conditions = [eq(knowledgeSources.projectId, projectId)];
  if (search) conditions.push(ilike(knowledgeSources.name, `%${search}%`));
  if (sourceType === "pdf" || sourceType === "screen" || sourceType === "figma" || sourceType === "url") {
    conditions.push(eq(knowledgeSources.sourceType, sourceType));
  }
  const where = and(...conditions);

  const sortColumn = sortBy === "name" ? knowledgeSources.name : sortBy === "updatedAt" ? knowledgeSources.updatedAt : knowledgeSources.createdAt;
  const orderFn = sortDir === "asc" ? asc : desc;

  const [{ count: total }] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(knowledgeSources)
    .where(where);

  const offset = (page - 1) * limit;
  const data = await baseQuery(db)
    .where(where)
    .orderBy(orderFn(sortColumn))
    .limit(limit)
    .offset(offset);

  res.json({ data, total, page, limit });
});

router.get("/:id", async (req, res) => {
  const db = (req.db ?? rootDb) as DbHandle;
  const projectId = req.projectId!;
  const [row] = await baseQuery(db).where(
    and(eq(knowledgeSources.id, req.params.id as string), eq(knowledgeSources.projectId, projectId)),
  );
  if (!row) {
    res.status(404).json({ error: "Knowledge source not found" });
    return;
  }
  res.json(row);
});

router.post("/", upload.single("file"), async (req, res) => {
  const db = (req.db ?? rootDb) as DbHandle;
  const projectId = req.projectId!;
  let fileUrl = "";
  if (req.file) {
    const blob = await uploadBlob(req.file);
    fileUrl = blob.url;
  }

  const body = {
    name: req.body.name,
    sourceType: req.body.sourceType,
    url: fileUrl || req.body.url || "",
    description: req.body.description || "",
  };

  const parsed = insertKnowledgeSourceSchema.safeParse(body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    return;
  }
  const userId = req.session.userId;
  const [inserted] = await db
    .insert(knowledgeSources)
    .values({ ...parsed.data, projectId, createdBy: userId, updatedBy: userId })
    .returning();
  const [row] = await baseQuery(db).where(eq(knowledgeSources.id, inserted.id));
  res.status(201).json(row);
});

router.put("/:id", upload.single("file"), async (req, res) => {
  const db = (req.db ?? rootDb) as DbHandle;
  const projectId = req.projectId!;
  const [existing] = await db
    .select({ url: knowledgeSources.url })
    .from(knowledgeSources)
    .where(and(eq(knowledgeSources.id, req.params.id as string), eq(knowledgeSources.projectId, projectId)));
  if (!existing) {
    res.status(404).json({ error: "Knowledge source not found" });
    return;
  }

  let fileUrl = "";
  if (req.file) {
    if (existing.url && existing.url.includes("blob.core.windows.net")) {
      await deleteBlob(existing.url);
    }
    const blob = await uploadBlob(req.file);
    fileUrl = blob.url;
  }

  const body = {
    name: req.body.name,
    sourceType: req.body.sourceType,
    url: fileUrl || req.body.url || "",
    description: req.body.description || "",
  };

  const parsed = insertKnowledgeSourceSchema.safeParse(body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    return;
  }
  const userId = req.session.userId;
  const [updated] = await db
    .update(knowledgeSources)
    .set({ ...parsed.data, updatedBy: userId, updatedAt: new Date() })
    .where(and(eq(knowledgeSources.id, req.params.id as string), eq(knowledgeSources.projectId, projectId)))
    .returning();
  const [row] = await baseQuery(db).where(eq(knowledgeSources.id, updated.id));
  res.json(row);
});

router.delete("/:id", async (req, res) => {
  const db = (req.db ?? rootDb) as DbHandle;
  const projectId = req.projectId!;
  const [existing] = await db
    .select({ url: knowledgeSources.url })
    .from(knowledgeSources)
    .where(and(eq(knowledgeSources.id, req.params.id as string), eq(knowledgeSources.projectId, projectId)));

  const [deleted] = await db
    .delete(knowledgeSources)
    .where(and(eq(knowledgeSources.id, req.params.id as string), eq(knowledgeSources.projectId, projectId)))
    .returning({ id: knowledgeSources.id });
  if (!deleted) {
    res.status(404).json({ error: "Knowledge source not found" });
    return;
  }

  if (existing?.url && existing.url.includes("blob.core.windows.net")) {
    await deleteBlob(existing.url);
  }

  res.status(204).send();
});

export default router;
