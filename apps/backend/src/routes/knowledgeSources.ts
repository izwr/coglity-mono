import { type Request, type Router as RouterType, Router } from 'express';
import { eq, and, ilike, desc, asc, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import multer from 'multer';
import { knowledgeSources, insertKnowledgeSourceSchema, users } from '@coglity/shared/schema';
import { db as rootDb } from '../db';
import { uploadBlob, deleteBlob } from '../lib/blobStorage';
import { deleteChunksByBlob } from '../lib/searchClient';
import { sendToIndexQueue, type IndexQueuePayload } from '../lib/indexQueue';

const router: RouterType = Router({ mergeParams: true });
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

type DbHandle = typeof rootDb;

const DISPATCH_ATTEMPTS = 3;
const DISPATCH_RETRY_DELAY_MS = 250;

const createdByUser = alias(users, 'createdByUser');
const updatedByUser = alias(users, 'updatedByUser');

const columns = {
  id: knowledgeSources.id,
  projectId: knowledgeSources.projectId,
  name: knowledgeSources.name,
  sourceType: knowledgeSources.sourceType,
  url: knowledgeSources.url,
  description: knowledgeSources.description,
  status: knowledgeSources.status,
  chunkCount: knowledgeSources.chunkCount,
  indexedAt: knowledgeSources.indexedAt,
  errorMessage: knowledgeSources.errorMessage,
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

router.get('/', async (req, res) => {
  const db = (req.db ?? rootDb) as DbHandle;
  const projectId = req.projectId!;
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  const sourceType = typeof req.query.sourceType === 'string' ? req.query.sourceType : '';
  const sortBy = typeof req.query.sortBy === 'string' ? req.query.sortBy : 'createdAt';
  const sortDir = req.query.sortDir === 'asc' ? 'asc' : 'desc';
  const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '10'), 10) || 10));

  const conditions = [eq(knowledgeSources.projectId, projectId)];
  if (search) conditions.push(ilike(knowledgeSources.name, `%${search}%`));
  if (
    sourceType === 'pdf' ||
    sourceType === 'docx' ||
    sourceType === 'screen' ||
    sourceType === 'figma' ||
    sourceType === 'url'
  ) {
    conditions.push(eq(knowledgeSources.sourceType, sourceType));
  }
  const where = and(...conditions);

  const sortColumn =
    sortBy === 'name'
      ? knowledgeSources.name
      : sortBy === 'updatedAt'
        ? knowledgeSources.updatedAt
        : knowledgeSources.createdAt;
  const orderFn = sortDir === 'asc' ? asc : desc;

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

function extractBlobName(url: string): string | null {
  if (!url || !url.includes('blob.core.windows.net')) return null;
  try {
    return new URL(url).pathname.split('/').pop() ?? null;
  } catch {
    return null;
  }
}

router.get('/:id', async (req, res) => {
  const db = (req.db ?? rootDb) as DbHandle;
  const projectId = req.projectId!;
  const [row] = await baseQuery(db).where(
    and(
      eq(knowledgeSources.id, req.params.id as string),
      eq(knowledgeSources.projectId, projectId),
    ),
  );
  if (!row) {
    res.status(404).json({ error: 'Knowledge source not found' });
    return;
  }
  res.json(row);
});

router.post('/', upload.single('file'), async (req, res) => {
  const db = (req.db ?? rootDb) as DbHandle;
  const projectId = req.projectId!;
  const body = {
    name: req.body.name,
    sourceType: req.body.sourceType,
    url: req.file ? '' : req.body.url || '',
    description: req.body.description || '',
  };

  const parsed = insertKnowledgeSourceSchema.safeParse(body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    return;
  }

  let fileUrl = '';
  let blobName = '';
  if (req.file) {
    const blob = await uploadBlob(req.file, { projectId });
    fileUrl = blob.url;
    blobName = blob.blobName;
    cleanupBlobAfterRollback(req, fileUrl);
  }

  const userId = req.session.userId;
  const hasContent = Boolean(req.file) || parsed.data.sourceType === 'url';
  const [inserted] = await db
    .insert(knowledgeSources)
    .values({
      ...parsed.data,
      url: fileUrl || parsed.data.url,
      projectId,
      createdBy: userId,
      updatedBy: userId,
      status: hasContent ? 'processing' : 'pending',
    })
    .returning();

  if (hasContent) {
    queueIndexAfterCommit(req, projectId, inserted.id, {
      knowledgeSourceId: inserted.id,
      projectId,
      blobName,
      blobUrl: fileUrl,
      sourceType: parsed.data.sourceType,
      fileName: req.file?.originalname ?? parsed.data.name,
      url: parsed.data.sourceType === 'url' ? parsed.data.url : undefined,
    });
  }

  const [row] = await baseQuery(db).where(eq(knowledgeSources.id, inserted.id));
  res.status(201).json(row);
});

router.put('/:id', upload.single('file'), async (req, res) => {
  const db = (req.db ?? rootDb) as DbHandle;
  const projectId = req.projectId!;
  const [existing] = await db
    .select({ url: knowledgeSources.url })
    .from(knowledgeSources)
    .where(
      and(
        eq(knowledgeSources.id, req.params.id as string),
        eq(knowledgeSources.projectId, projectId),
      ),
    );
  if (!existing) {
    res.status(404).json({ error: 'Knowledge source not found' });
    return;
  }

  const body = {
    name: req.body.name,
    sourceType: req.body.sourceType,
    url: req.file ? '' : req.body.url || '',
    description: req.body.description || '',
  };

  const parsed = insertKnowledgeSourceSchema.safeParse(body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    return;
  }

  let fileUrl = '';
  let blobName = '';
  let oldBlobName: string | undefined;
  let oldBlobUrl: string | undefined;
  if (req.file) {
    if (existing.url && existing.url.includes('blob.core.windows.net')) {
      oldBlobName = extractBlobName(existing.url) ?? undefined;
      oldBlobUrl = existing.url;
    }
    const blob = await uploadBlob(req.file, { projectId });
    fileUrl = blob.url;
    blobName = blob.blobName;
    cleanupBlobAfterRollback(req, fileUrl);
  }

  const userId = req.session.userId;
  const [updated] = await db
    .update(knowledgeSources)
    .set({
      ...parsed.data,
      url: fileUrl || parsed.data.url,
      updatedBy: userId,
      updatedAt: new Date(),
      ...(req.file
        ? { status: 'processing' as const, chunkCount: 0, indexedAt: null, errorMessage: null }
        : {}),
    })
    .where(
      and(
        eq(knowledgeSources.id, req.params.id as string),
        eq(knowledgeSources.projectId, projectId),
      ),
    )
    .returning();

  if (!updated) {
    if (fileUrl) await deleteBlob(fileUrl);
    res.status(404).json({ error: 'Knowledge source not found' });
    return;
  }

  if (req.file && blobName) {
    queueIndexAfterCommit(req, projectId, updated.id, {
      knowledgeSourceId: updated.id,
      projectId,
      blobName,
      blobUrl: fileUrl,
      sourceType: parsed.data.sourceType,
      fileName: req.file.originalname ?? parsed.data.name,
      url: parsed.data.sourceType === 'url' ? parsed.data.url : undefined,
      oldBlobName,
    });
    if (oldBlobUrl) {
      deleteBlobAfterCommit(req, oldBlobUrl);
    }
  }

  const [row] = await baseQuery(db).where(eq(knowledgeSources.id, updated.id));
  res.json(row);
});

router.delete('/:id', async (req, res) => {
  const db = (req.db ?? rootDb) as DbHandle;
  const projectId = req.projectId!;
  const [existing] = await db
    .select({ url: knowledgeSources.url })
    .from(knowledgeSources)
    .where(
      and(
        eq(knowledgeSources.id, req.params.id as string),
        eq(knowledgeSources.projectId, projectId),
      ),
    );

  const [deleted] = await db
    .delete(knowledgeSources)
    .where(
      and(
        eq(knowledgeSources.id, req.params.id as string),
        eq(knowledgeSources.projectId, projectId),
      ),
    )
    .returning({ id: knowledgeSources.id });
  if (!deleted) {
    res.status(404).json({ error: 'Knowledge source not found' });
    return;
  }

  if (existing?.url && existing.url.includes('blob.core.windows.net')) {
    const blobName = extractBlobName(existing.url);
    if (blobName) {
      deleteChunksByBlob(blobName).catch(() => {});
    }
    await deleteBlob(existing.url);
  }

  res.status(204).send();
});

function queueIndexAfterCommit(
  req: Request,
  projectId: string,
  knowledgeSourceId: string,
  payload: IndexQueuePayload,
) {
  const dispatch = async () => {
    try {
      await retryQueueDispatch(() => sendToIndexQueue(payload));
    } catch (err) {
      const message = getErrorMessage(err);
      console.error(`[knowledge-sources] queue send failed for ${knowledgeSourceId}:`, err);
      await rootDb
        .update(knowledgeSources)
        .set({
          status: 'failed',
          errorMessage: `Dispatch failed: ${message}`.slice(0, 2000),
          updatedAt: new Date(),
        })
        .where(
          and(eq(knowledgeSources.id, knowledgeSourceId), eq(knowledgeSources.projectId, projectId)),
        );
    }
  };

  if (req.afterCommit) {
    req.afterCommit(dispatch);
  } else {
    void dispatch();
  }
}

function cleanupBlobAfterRollback(req: Request, blobUrl: string) {
  if (req.afterRollback) {
    req.afterRollback(() => deleteBlob(blobUrl));
  }
}

function deleteBlobAfterCommit(req: Request, blobUrl: string) {
  const cleanup = () => deleteBlob(blobUrl);
  if (req.afterCommit) {
    req.afterCommit(cleanup);
  } else {
    void cleanup();
  }
}

async function retryQueueDispatch(send: () => Promise<void>): Promise<void> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= DISPATCH_ATTEMPTS; attempt++) {
    try {
      await send();
      return;
    } catch (err) {
      lastError = err;
      if (attempt < DISPATCH_ATTEMPTS) {
        await sleep(DISPATCH_RETRY_DELAY_MS * attempt);
      }
    }
  }
  throw lastError;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export default router;
