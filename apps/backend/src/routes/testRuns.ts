import { type Router as RouterType, Router } from "express";
import { eq, and, desc } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { ServiceBusClient } from "@azure/service-bus";
import { DefaultAzureCredential } from "@azure/identity";
import {
  testRuns,
  testCases,
  botConnections,
  users,
} from "@coglity/shared/schema";
import { db as rootDb } from "../db.js";

const router: RouterType = Router({ mergeParams: true });

type DbHandle = typeof rootDb;

const createdByUser = alias(users, "createdByUser");

const columns = {
  id: testRuns.id,
  projectId: testRuns.projectId,
  testCaseId: testRuns.testCaseId,
  botConnectionId: testRuns.botConnectionId,
  state: testRuns.state,
  verdict: testRuns.verdict,
  transcript: testRuns.transcript,
  error: testRuns.error,
  recordingUrl: testRuns.recordingUrl,
  recordingBlobName: testRuns.recordingBlobName,
  recordingDurationMs: testRuns.recordingDurationMs,
  startedAt: testRuns.startedAt,
  finishedAt: testRuns.finishedAt,
  createdBy: testRuns.createdBy,
  createdAt: testRuns.createdAt,
  createdByName: createdByUser.displayName,
} as const;

function baseQuery(db: DbHandle) {
  return db
    .select(columns)
    .from(testRuns)
    .leftJoin(createdByUser, eq(testRuns.createdBy, createdByUser.id));
}

router.get("/", async (req, res) => {
  const db = (req.db ?? rootDb) as DbHandle;
  const projectId = req.projectId!;
  const testCaseId = typeof req.query.testCaseId === "string" ? req.query.testCaseId : "";

  const conditions = [eq(testRuns.projectId, projectId)];
  if (testCaseId) conditions.push(eq(testRuns.testCaseId, testCaseId));

  const rows = await baseQuery(db).where(and(...conditions)).orderBy(desc(testRuns.createdAt)).limit(50);
  res.json({ data: rows });
});

router.get("/:id", async (req, res) => {
  const db = (req.db ?? rootDb) as DbHandle;
  const projectId = req.projectId!;
  const [row] = await baseQuery(db).where(
    and(eq(testRuns.id, req.params.id as string), eq(testRuns.projectId, projectId)),
  );
  if (!row) {
    res.status(404).json({ error: "Test run not found" });
    return;
  }
  res.json(row);
});

router.post("/", async (req, res) => {
  const db = (req.db ?? rootDb) as DbHandle;
  const projectId = req.projectId!;
  const testCaseId = typeof req.body?.testCaseId === "string" ? req.body.testCaseId : "";
  if (!testCaseId) {
    res.status(400).json({ error: "testCaseId is required" });
    return;
  }

  const [tc] = await db
    .select({
      id: testCases.id,
      testCaseType: testCases.testCaseType,
      botConnectionId: testCases.botConnectionId,
      preCondition: testCases.preCondition,
      testSteps: testCases.testSteps,
      expectedResults: testCases.expectedResults,
      data: testCases.data,
    })
    .from(testCases)
    .where(and(eq(testCases.id, testCaseId), eq(testCases.projectId, projectId)));

  if (!tc) {
    res.status(404).json({ error: "Test case not found" });
    return;
  }
  if (tc.testCaseType !== "voice") {
    res.status(400).json({ error: "Only voice test cases can be run" });
    return;
  }
  if (!tc.botConnectionId) {
    res.status(400).json({ error: "Test case must have a bot connection attached" });
    return;
  }

  const [bc] = await db
    .select({ id: botConnections.id, provider: botConnections.provider, config: botConnections.config, botType: botConnections.botType })
    .from(botConnections)
    .where(and(eq(botConnections.id, tc.botConnectionId), eq(botConnections.projectId, projectId)));

  if (!bc) {
    res.status(400).json({ error: "Bot connection not found in this project" });
    return;
  }
  if (bc.botType !== "voice") {
    res.status(400).json({ error: "Attached bot connection is not voice" });
    return;
  }
  if (bc.provider === "dialin") {
    res.status(400).json({ error: "Dial-in provider is not supported yet" });
    return;
  }

  const userId = req.session.userId;
  const [inserted] = await db
    .insert(testRuns)
    .values({
      testCaseId: tc.id,
      botConnectionId: bc.id,
      projectId,
      state: "queued",
      createdBy: userId,
    })
    .returning();

  // Fire-and-forget dispatch to executor via Service Bus queue.
  sendToQueue(inserted.id, {
    runId: inserted.id,
    testCase: {
      id: tc.id,
      preCondition: tc.preCondition,
      testSteps: tc.testSteps,
      expectedResults: tc.expectedResults,
      data: tc.data,
    },
    botConnection: {
      id: bc.id,
      provider: bc.provider,
      config: bc.config,
    },
  }).catch((err) => {
    console.error(`[test-runs] dispatch failed for ${inserted.id}:`, err);
  });

  const [row] = await baseQuery(db).where(eq(testRuns.id, inserted.id));
  res.status(201).json(row);
});

async function sendToQueue(
  runId: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const namespace = process.env.AZURE_SERVICE_BUS_NAMESPACE;
  const queueName = process.env.AZURE_SERVICE_BUS_QUEUE_NAME;
  if (!namespace || !queueName) {
    console.warn(`[test-runs] AZURE_SERVICE_BUS_NAMESPACE or AZURE_SERVICE_BUS_QUEUE_NAME not set; run ${runId} will stay queued`);
    return;
  }
  const client = new ServiceBusClient(namespace, new DefaultAzureCredential());
  const sender = client.createSender(queueName);
  try {
    await sender.sendMessages({
      body: payload,
      messageId: runId,
      contentType: "application/json",
    });
  } finally {
    await sender.close();
    await client.close();
  }
}

export default router;
