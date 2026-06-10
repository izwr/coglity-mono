import { type Router as RouterType, Router } from 'express';
import { and, eq } from 'drizzle-orm';
import OpenAI from 'openai';
import { z } from 'zod';
import {
  aiGenerationSessions,
  insertAiGenerationSessionSchema,
  testCases,
  testSuites,
} from '@coglity/shared/schema';
import { db as rootDb } from '../db';
import { searchKnowledge } from '../lib/searchClient';

const router: RouterType = Router({ mergeParams: true });

type DbHandle = typeof rootDb;

const openaiModel = 'gemma-4-31B-it';

const openai = new OpenAI({
  baseURL: process.env.OPENAI_BASE_URL,
  apiKey: process.env.OPENAI_API_KEY,
});

type JsonSchema = Record<string, unknown>;

async function createJsonChatCompletion<T>(args: {
  instructions: string;
  input: string;
  schema: JsonSchema;
}): Promise<T | null> {
  const completion = await openai.chat.completions.create({
    model: openaiModel,
    messages: [
      {
        role: 'system',
        content:
          `${args.instructions}\n\n` +
          'Return only valid JSON. Do not include markdown fences or explanatory text. ' +
          `The JSON must match this schema: ${JSON.stringify(args.schema)}`,
      },
      { role: 'user', content: args.input },
    ],
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) return null;

  try {
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

router.post('/session', async (req, res) => {
  const db = (req.db ?? rootDb) as DbHandle;
  const projectId = req.projectId!;
  const parsed = insertAiGenerationSessionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    return;
  }
  // Verify testSuite belongs to this project
  const [suite] = await db
    .select({ id: testSuites.id })
    .from(testSuites)
    .where(and(eq(testSuites.id, parsed.data.testSuiteId), eq(testSuites.projectId, projectId)));
  if (!suite) {
    res.status(400).json({ error: 'testSuiteId does not belong to this project' });
    return;
  }
  const userId = req.session.userId;
  const [session] = await db
    .insert(aiGenerationSessions)
    .values({ ...parsed.data, projectId, createdBy: userId })
    .returning();
  res.status(201).json(session);
});

router.get('/session/:id', async (req, res) => {
  const db = (req.db ?? rootDb) as DbHandle;
  const projectId = req.projectId!;
  const [session] = await db
    .select()
    .from(aiGenerationSessions)
    .where(
      and(
        eq(aiGenerationSessions.id, req.params.id as string),
        eq(aiGenerationSessions.projectId, projectId),
      ),
    );
  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }
  res.json(session);
});

router.post('/session/:id/followup', async (req, res) => {
  const db = (req.db ?? rootDb) as DbHandle;
  const projectId = req.projectId!;
  const [session] = await db
    .select()
    .from(aiGenerationSessions)
    .where(
      and(
        eq(aiGenerationSessions.id, req.params.id as string),
        eq(aiGenerationSessions.projectId, projectId),
      ),
    );
  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  const knowledgeChunks = await searchKnowledge(projectId, session.userStory);
  const knowledgeContext =
    knowledgeChunks.length > 0
      ? '\n\nRelevant project knowledge:\n---\n' + knowledgeChunks.join('\n---\n')
      : '';

  const result = await createJsonChatCompletion<{ questions: string[] }>({
    instructions:
      'You are a senior QA engineer. Given a user story or feature description, generate 3-5 clarifying follow-up questions ' +
      'that would help you create better, more comprehensive test scenarios. ' +
      'Focus on edge cases, acceptance criteria, boundary conditions, and non-functional requirements.',
    input: `User Story: ${session.userStory}${knowledgeContext}`,
    schema: {
      type: 'object',
      properties: { questions: { type: 'array', items: { type: 'string' } } },
      required: ['questions'],
      additionalProperties: false,
    },
  });

  if (!result) {
    res.status(500).json({ error: 'Failed to generate follow-up questions' });
    return;
  }
  res.json({ questions: result.questions });
});

const answersSchema = z.object({
  answers: z.array(z.object({ question: z.string(), answer: z.string() })),
});

router.post('/session/:id/answers', async (req, res) => {
  const db = (req.db ?? rootDb) as DbHandle;
  const projectId = req.projectId!;
  const parsed = answersSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    return;
  }
  const [updated] = await db
    .update(aiGenerationSessions)
    .set({ followUpQA: parsed.data.answers, updatedAt: new Date() })
    .where(
      and(
        eq(aiGenerationSessions.id, req.params.id as string),
        eq(aiGenerationSessions.projectId, projectId),
      ),
    )
    .returning();
  if (!updated) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }
  res.json(updated);
});

router.post('/session/:id/generate-scenarios', async (req, res) => {
  const db = (req.db ?? rootDb) as DbHandle;
  const projectId = req.projectId!;
  const [session] = await db
    .select()
    .from(aiGenerationSessions)
    .where(
      and(
        eq(aiGenerationSessions.id, req.params.id as string),
        eq(aiGenerationSessions.projectId, projectId),
      ),
    );
  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }
  // Don't spend another LLM generation on a session that already produced test cases.
  if (session.status === 'test_cases_created') {
    res.status(409).json({ error: 'This session has already produced test cases' });
    return;
  }

  const followUpQA = session.followUpQA as { question: string; answer: string }[];
  const qaContext =
    followUpQA.length > 0
      ? '\n\nAdditional context from Q&A:\n' +
        followUpQA.map((qa) => `Q: ${qa.question}\nA: ${qa.answer}`).join('\n\n')
      : '';

  const knowledgeChunks = await searchKnowledge(projectId, session.userStory);
  const knowledgeContext =
    knowledgeChunks.length > 0
      ? '\n\nRelevant project knowledge:\n---\n' + knowledgeChunks.join('\n---\n')
      : '';

  const result = await createJsonChatCompletion<{
    scenarios: { title: string; description: string }[];
  }>({
    instructions:
      'You are a senior QA engineer. Given a user story and additional context, generate a comprehensive list of test scenarios. ' +
      'Each scenario should have a clear, concise title and a brief description of what to test. ' +
      'Cover happy paths, edge cases, error scenarios, and boundary conditions.',
    input: `User Story: ${session.userStory}${qaContext}${knowledgeContext}`,
    schema: {
      type: 'object',
      properties: {
        scenarios: {
          type: 'array',
          items: {
            type: 'object',
            properties: { title: { type: 'string' }, description: { type: 'string' } },
            required: ['title', 'description'],
            additionalProperties: false,
          },
        },
      },
      required: ['scenarios'],
      additionalProperties: false,
    },
  });

  if (!result) {
    res.status(500).json({ error: 'Failed to generate scenarios' });
    return;
  }

  const [updated] = await db
    .update(aiGenerationSessions)
    .set({
      generatedScenarios: result.scenarios,
      status: 'scenarios_generated',
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(aiGenerationSessions.id, req.params.id as string),
        eq(aiGenerationSessions.projectId, projectId),
      ),
    )
    .returning();

  res.json(updated);
});

const createTestCasesSchema = z.object({ selectedIndices: z.array(z.number()) });

router.post('/session/:id/create-test-cases', async (req, res) => {
  const db = (req.db ?? rootDb) as DbHandle;
  const projectId = req.projectId!;
  const parsed = createTestCasesSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    return;
  }

  const [session] = await db
    .select()
    .from(aiGenerationSessions)
    .where(
      and(
        eq(aiGenerationSessions.id, req.params.id as string),
        eq(aiGenerationSessions.projectId, projectId),
      ),
    );
  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  if (session.status !== 'scenarios_generated') {
    res.status(400).json({ error: 'Scenarios must be generated first' });
    return;
  }

  const userId = req.session.userId;
  const generatedScenarios = session.generatedScenarios as { title: string; description: string }[];
  const selectedScenarios = parsed.data.selectedIndices
    .filter((i: number) => i >= 0 && i < generatedScenarios.length)
    .map((i: number) => generatedScenarios[i]);

  if (selectedScenarios.length === 0) {
    res.status(400).json({ error: 'No valid scenarios selected' });
    return;
  }

  // Atomically claim the session (scenarios_generated -> test_cases_created) before the
  // expensive LLM call + inserts. This runs inside the request transaction, so a second
  // concurrent request blocks on the row lock, then sees the wrong status and is rejected
  // it can no longer double-spend on generation or insert duplicate test cases.
  const [claimed] = await db
    .update(aiGenerationSessions)
    .set({
      selectedScenarioIndices: parsed.data.selectedIndices,
      status: 'test_cases_created',
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(aiGenerationSessions.id, req.params.id as string),
        eq(aiGenerationSessions.projectId, projectId),
        eq(aiGenerationSessions.status, 'scenarios_generated'),
      ),
    )
    .returning({ id: aiGenerationSessions.id });
  if (!claimed) {
    res.status(409).json({ error: 'Test cases have already been created for this session' });
    return;
  }

  const followUpQA = session.followUpQA as { question: string; answer: string }[];
  const qaContext =
    followUpQA.length > 0
      ? '\n\nAdditional context from Q&A:\n' +
        followUpQA.map((qa) => `Q: ${qa.question}\nA: ${qa.answer}`).join('\n\n')
      : '';

  const knowledgeChunks = await searchKnowledge(projectId, session.userStory);
  const knowledgeContext =
    knowledgeChunks.length > 0
      ? '\n\nRelevant project knowledge:\n---\n' + knowledgeChunks.join('\n---\n')
      : '';

  const details = await createJsonChatCompletion<{
    testCases: { preCondition: string; testSteps: string; expectedResults: string }[];
  }>({
    instructions:
      'You are a senior QA engineer. Given a user story, context, and a list of test scenarios, ' +
      'generate detailed test case information for each scenario. ' +
      'For each scenario, provide: preCondition (setup or state required before testing), ' +
      'testSteps (numbered step-by-step instructions to execute the test), ' +
      'and expectedResults (what should happen when the test is executed correctly). ' +
      'Return the results in the same order as the input scenarios.',
    input: `User Story: ${session.userStory}${qaContext}${knowledgeContext}\n\nScenarios:\n${selectedScenarios.map((s, i) => `${i + 1}. ${s.title}: ${s.description}`).join('\n')}`,
    schema: {
      type: 'object',
      properties: {
        testCases: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              preCondition: { type: 'string' },
              testSteps: { type: 'string' },
              expectedResults: { type: 'string' },
            },
            required: ['preCondition', 'testSteps', 'expectedResults'],
            additionalProperties: false,
          },
        },
      },
      required: ['testCases'],
      additionalProperties: false,
    },
  });

  const insertedCases = await db
    .insert(testCases)
    .values(
      selectedScenarios.map((scenario, i) => ({
        projectId,
        testSuiteId: session.testSuiteId,
        title: scenario.title,
        preCondition: details?.testCases[i]?.preCondition ?? '',
        testSteps: details?.testCases[i]?.testSteps ?? scenario.description,
        data: '',
        expectedResults: details?.testCases[i]?.expectedResults ?? '',
        status: 'draft' as const,
        createdBy: userId,
        updatedBy: userId,
      })),
    )
    .returning();

  res.status(201).json(insertedCases);
});

export default router;
