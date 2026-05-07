import path from 'node:path';
import type { ParsedSpec } from '../spec/types.js';
import type {
  RunOptions,
  RunResult,
  RunEventEmitter,
  StepResult,
} from './events.js';
import { launchBrowser, closeBrowser, executeAction } from './playwright.js';
import { takeSnapshot } from './snapshot.js';
import { finalizeRun } from './recorder.js';
import { plannerAgent } from '../agents/planner/index.js';
import { judgeAgent } from '../agents/judge/index.js';
import { getClient } from '../agents/shared/client.js';
import { createTraceWriter } from '../agents/shared/trace.js';
import { isRetryable } from '../agents/shared/errors.js';
import { ensureRunDir, generateRunId } from '../lib/paths.js';
import {
  DEFAULT_PLANNER_MODEL,
  DEFAULT_JUDGE_MODEL,
} from '../lib/config.js';

export async function runSpec(
  spec: ParsedSpec,
  opts: RunOptions,
  onEvent: RunEventEmitter,
): Promise<RunResult> {
  const runId = generateRunId();
  const dir = await ensureRunDir(runId);
  const snapshotsDir = path.join(dir, 'snapshots');
  const trace = createTraceWriter(dir);
  const client = getClient();
  const startTime = Date.now();

  onEvent({ kind: 'run.start', spec, runId });

  const session = await launchBrowser(spec, { headed: opts.headed });
  const stepResults: StepResult[] = [];

  try {
    for (let i = 0; i < spec.steps.length; i++) {
      const stepText = spec.steps[i];
      const stepStart = Date.now();

      onEvent({ kind: 'step.start', index: i, text: stepText });

      try {
        const result = await executeStep(i, spec, session.page, {
          client,
          plannerModel: opts.plannerModel ?? DEFAULT_PLANNER_MODEL,
          trace,
          snapshotsDir,
          onEvent,
        });
        stepResults.push(result);
      } catch (err) {
        if (isRetryable(err)) {
          try {
            const retryResult = await executeStep(i, spec, session.page, {
              client,
              plannerModel: opts.plannerModel ?? DEFAULT_PLANNER_MODEL,
              trace,
              snapshotsDir,
              onEvent,
            });
            stepResults.push(retryResult);
            continue;
          } catch (_retryErr) {
            // fall through to error handling
          }
        }

        const durationMs = Date.now() - stepStart;
        const error = err instanceof Error ? err.message : String(err);
        onEvent({ kind: 'step.end', index: i, status: 'error', durationMs, error });
        stepResults.push({ index: i, text: stepText, status: 'error', durationMs, error });
        break;
      }
    }

    // Judge phase
    onEvent({ kind: 'judge.start' });

    const finalSnapshot = await takeSnapshot(
      session.page,
      snapshotsDir,
      'final',
    );

    const judgeResult = await judgeAgent.run(
      {
        spec,
        stepResults,
        finalAccessibilityTree: finalSnapshot.accessibilityTree,
      },
      {
        client,
        model: opts.judgeModel ?? DEFAULT_JUDGE_MODEL,
        trace,
      },
    );

    onEvent({ kind: 'judge.end', verdict: judgeResult.output });

    const result: RunResult = {
      runId,
      specFile: spec.filePath,
      verdict: judgeResult.output,
      steps: stepResults,
      durationMs: Date.now() - startTime,
    };

    onEvent({ kind: 'run.end', result });
    await finalizeRun(dir, spec, result);
    await trace.flush();

    return result;
  } finally {
    await closeBrowser(session);
  }
}

interface StepContext {
  client: import('@anthropic-ai/sdk').default;
  plannerModel: string;
  trace: import('../agents/shared/trace.js').TraceWriter;
  snapshotsDir: string;
  onEvent: RunEventEmitter;
}

async function executeStep(
  index: number,
  spec: ParsedSpec,
  page: import('playwright').Page,
  ctx: StepContext,
): Promise<StepResult> {
  const stepText = spec.steps[index];
  const stepStart = Date.now();

  const initialSnapshot = await takeSnapshot(page, ctx.snapshotsDir, `step-${index}-0`);
  ctx.onEvent({
    kind: 'step.snapshot',
    index,
    screenshot: initialSnapshot.screenshotPath,
  });

  let snapshotCounter = 1;

  await plannerAgent.run(
    {
      step: stepText,
      stepIndex: index,
      setup: spec.setup,
      previousSteps: spec.steps.slice(0, index),
      accessibilityTree: initialSnapshot.accessibilityTree,
    },
    {
      onThinking: () => {
        ctx.onEvent({ kind: 'step.thinking', index, agent: 'planner' });
      },
      onAction: (action) => {
        ctx.onEvent({ kind: 'step.action', index, action });
      },
      executeAction: async (action) => {
        const result = await executeAction(page, action);
        return result;
      },
      takeSnapshot: async () => {
        const snap = await takeSnapshot(
          page,
          ctx.snapshotsDir,
          `step-${index}-${snapshotCounter++}`,
        );
        ctx.onEvent({ kind: 'step.snapshot', index, screenshot: snap.screenshotPath });
        return snap.accessibilityTree;
      },
    },
    {
      client: ctx.client,
      model: ctx.plannerModel,
      trace: ctx.trace,
    },
  );

  const durationMs = Date.now() - stepStart;
  ctx.onEvent({ kind: 'step.end', index, status: 'ok', durationMs });
  return { index, text: stepText, status: 'ok', durationMs };
}
