import { type Router as RouterType, Router } from "express";
import { eq, and, desc } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { ServiceBusClient } from "@azure/service-bus";
import { ManagedIdentityCredential } from "@azure/identity";
import { randomUUID } from "crypto";
import {
  testRuns,
  testCases,
  botConnections,
  users,
} from "@coglity/shared/schema";
import {
  SUPPORTED_LANGUAGES,
  SUPPORTED_ENVIRONMENTS,
  getLanguageConfig,
  getEnvironmentConfig,
} from "@coglity/shared";
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
  language: testRuns.language,
  environment: testRuns.environment,
  batchId: testRuns.batchId,
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
  const batchId = typeof req.query.batchId === "string" ? req.query.batchId : "";

  const conditions = [eq(testRuns.projectId, projectId)];
  if (testCaseId) conditions.push(eq(testRuns.testCaseId, testCaseId));
  if (batchId) conditions.push(eq(testRuns.batchId, batchId));

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

  // Determine language/environment combinations
  const languages: string[] = Array.isArray(req.body.languages) ? req.body.languages : [];
  const environments: string[] = Array.isArray(req.body.environments) ? req.body.environments : [];
  const crossProduct = req.body.crossProduct === true;
  const combinations: Array<{ language: string; environment: string }> = Array.isArray(req.body.combinations) ? req.body.combinations : [];

  // Validate values against supported constants
  const validLangs = new Set(SUPPORTED_LANGUAGES.map((l) => l.code));
  const validEnvs = new Set(SUPPORTED_ENVIRONMENTS.map((e) => e.id));
  for (const l of languages) {
    if (!validLangs.has(l)) { res.status(400).json({ error: `Unsupported language: ${l}` }); return; }
  }
  for (const e of environments) {
    if (!validEnvs.has(e)) { res.status(400).json({ error: `Unsupported environment: ${e}` }); return; }
  }

  let pairs: Array<{ language: string; environment: string }>;
  if (languages.length === 0 && environments.length === 0 && combinations.length === 0) {
    pairs = [{ language: "en-US", environment: "quiet" }];
  } else if (crossProduct && languages.length > 0 && environments.length > 0) {
    pairs = languages.flatMap((l) => environments.map((e) => ({ language: l, environment: e })));
  } else if (combinations.length > 0) {
    pairs = combinations;
  } else {
    const langs = languages.length > 0 ? languages : ["en-US"];
    const envs = environments.length > 0 ? environments : ["quiet"];
    pairs = langs.flatMap((l) => envs.map((e) => ({ language: l, environment: e })));
  }

  const batchId = pairs.length > 1 ? randomUUID() : null;

  const insertedRuns = await Promise.all(
    pairs.map(async ({ language, environment }) => {
      const [inserted] = await db
        .insert(testRuns)
        .values({
          testCaseId: tc.id,
          botConnectionId: bc.id,
          projectId,
          state: "queued",
          language,
          environment,
          batchId,
          createdBy: userId,
        })
        .returning();

      const langConfig = getLanguageConfig(language);
      const envConfig = getEnvironmentConfig(environment);

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
        language: langConfig?.sttLanguage ?? "en-US",
        ttsVoice: langConfig?.ttsVoice,
        environment: envConfig?.id ?? "quiet",
        environmentSnrDb: envConfig?.defaultSnrDb,
      }).catch((err) => {
        console.error(`[test-runs] dispatch failed for ${inserted.id}:`, err);
      });

      return inserted;
    }),
  );

  const rows = await baseQuery(db)
    .where(and(
      eq(testRuns.projectId, projectId),
      ...(batchId ? [eq(testRuns.batchId, batchId)] : [eq(testRuns.id, insertedRuns[0].id)]),
    ))
    .orderBy(desc(testRuns.createdAt));

  if (batchId) {
    res.status(201).json({ data: rows, batchId });
  } else {
    res.status(201).json(rows[0]);
  }
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
  const client = new ServiceBusClient(namespace, new ManagedIdentityCredential());
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
