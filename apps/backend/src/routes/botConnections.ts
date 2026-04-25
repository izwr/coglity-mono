import { type Router as RouterType, Router } from "express";
import { eq, and, ilike, desc, asc, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { botConnections, insertBotConnectionSchema, users } from "@coglity/shared/schema";
import { db as rootDb } from "../db.js";

const router: RouterType = Router({ mergeParams: true });

type DbHandle = typeof rootDb;

const createdByUser = alias(users, "createdByUser");
const updatedByUser = alias(users, "updatedByUser");

const columns = {
  id: botConnections.id,
  projectId: botConnections.projectId,
  name: botConnections.name,
  botType: botConnections.botType,
  provider: botConnections.provider,
  config: botConnections.config,
  description: botConnections.description,
  createdBy: botConnections.createdBy,
  updatedBy: botConnections.updatedBy,
  createdAt: botConnections.createdAt,
  updatedAt: botConnections.updatedAt,
  createdByName: createdByUser.displayName,
  updatedByName: updatedByUser.displayName,
} as const;

function baseQuery(db: DbHandle) {
  return db
    .select(columns)
    .from(botConnections)
    .leftJoin(createdByUser, eq(botConnections.createdBy, createdByUser.id))
    .leftJoin(updatedByUser, eq(botConnections.updatedBy, updatedByUser.id));
}

router.get("/", async (req, res) => {
  const db = (req.db ?? rootDb) as DbHandle;
  const projectId = req.projectId!;
  const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
  const botType = typeof req.query.botType === "string" ? req.query.botType : "";
  const sortBy = typeof req.query.sortBy === "string" ? req.query.sortBy : "createdAt";
  const sortDir = req.query.sortDir === "asc" ? "asc" : "desc";
  const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? "10"), 10) || 10));

  const conditions = [eq(botConnections.projectId, projectId)];
  if (search) conditions.push(ilike(botConnections.name, `%${search}%`));
  if (botType === "voice" || botType === "chat") {
    conditions.push(eq(botConnections.botType, botType));
  }
  const where = and(...conditions);

  const sortColumn = sortBy === "name" ? botConnections.name : sortBy === "updatedAt" ? botConnections.updatedAt : botConnections.createdAt;
  const orderFn = sortDir === "asc" ? asc : desc;

  const [{ count: total }] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(botConnections)
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
    and(eq(botConnections.id, req.params.id as string), eq(botConnections.projectId, projectId)),
  );
  if (!row) {
    res.status(404).json({ error: "Bot connection not found" });
    return;
  }
  res.json(row);
});

router.post("/", async (req, res) => {
  const db = (req.db ?? rootDb) as DbHandle;
  const projectId = req.projectId!;
  const parsed = insertBotConnectionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    return;
  }
  const userId = req.session.userId;
  const [inserted] = await db
    .insert(botConnections)
    .values({ ...parsed.data, projectId, createdBy: userId, updatedBy: userId })
    .returning();
  const [row] = await baseQuery(db).where(eq(botConnections.id, inserted.id));
  res.status(201).json(row);
});

router.put("/:id", async (req, res) => {
  const db = (req.db ?? rootDb) as DbHandle;
  const projectId = req.projectId!;
  const parsed = insertBotConnectionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    return;
  }
  const userId = req.session.userId;
  const [updated] = await db
    .update(botConnections)
    .set({ ...parsed.data, updatedBy: userId, updatedAt: new Date() })
    .where(and(eq(botConnections.id, req.params.id as string), eq(botConnections.projectId, projectId)))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Bot connection not found" });
    return;
  }
  const [row] = await baseQuery(db).where(eq(botConnections.id, updated.id));
  res.json(row);
});

router.delete("/:id", async (req, res) => {
  const db = (req.db ?? rootDb) as DbHandle;
  const projectId = req.projectId!;
  const [deleted] = await db
    .delete(botConnections)
    .where(and(eq(botConnections.id, req.params.id as string), eq(botConnections.projectId, projectId)))
    .returning({ id: botConnections.id });
  if (!deleted) {
    res.status(404).json({ error: "Bot connection not found" });
    return;
  }
  res.status(204).send();
});

export default router;
