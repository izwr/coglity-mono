import type { RunEventEmitter, RunResult, PlaywrightAction } from './events';
import type { ParsedSpec } from '../spec/types';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const FAKE_ACTIONS: PlaywrightAction[] = [
  { tool: 'goto', url: 'https://demo.playwright.dev/todomvc' },
  { tool: 'fill', selector: 'input.new-todo', value: 'Buy groceries' },
  { tool: 'press', key: 'Enter' },
  { tool: 'fill', selector: 'input.new-todo', value: 'Clean the house' },
  { tool: 'click', selector: 'input.toggle' },
  { tool: 'click', selector: 'a[href="#/active"]' },
];

export async function fakeRun(onEvent: RunEventEmitter): Promise<RunResult> {
  const spec: ParsedSpec = {
    name: 'Guest checkout flow',
    url: 'https://demo.playwright.dev/todomvc',
    viewport: { width: 1280, height: 720 },
    timeout: 30000,
    setup: 'A TodoMVC application. The page loads with an empty todo list.',
    steps: [
      'Navigate to the app and verify the input field is visible',
      'Add a new todo item called "Buy groceries"',
      'Add a second todo item called "Clean the house"',
      'Mark "Buy groceries" as completed',
      'Filter to show only active items and confirm only "Clean the house" is visible',
      'Filter to show all items and confirm both todos appear with correct completion states',
    ],
    filePath: 'examples/checkout.spec.md',
    rawContent: '',
  };

  const runId = 'fake-' + Date.now();
  onEvent({ kind: 'run.start', spec, runId });

  for (let i = 0; i < spec.steps.length; i++) {
    onEvent({ kind: 'step.start', index: i, text: spec.steps[i] });
    await sleep(200);

    onEvent({ kind: 'step.thinking', index: i, agent: 'planner' });
    await sleep(600 + Math.random() * 400);

    const action = FAKE_ACTIONS[i % FAKE_ACTIONS.length];
    onEvent({ kind: 'step.action', index: i, action });
    await sleep(300);

    onEvent({
      kind: 'step.snapshot',
      index: i,
      screenshot: `.coglity/runs/${runId}/snapshots/step-${i}.png`,
    });
    await sleep(100);

    const durationMs = 800 + Math.floor(Math.random() * 1200);
    onEvent({ kind: 'step.end', index: i, status: 'ok', durationMs });
  }

  onEvent({ kind: 'judge.start' });
  await sleep(1200);

  const verdict = {
    outcome: 'pass' as const,
    reasoning:
      'All steps completed. Final state shows both todos with correct completion states matching the spec.',
  };
  onEvent({ kind: 'judge.end', verdict });

  const result: RunResult = {
    runId,
    specFile: spec.filePath,
    verdict,
    steps: spec.steps.map((text, index) => ({
      index,
      text,
      status: 'ok' as const,
      durationMs: 800 + Math.floor(Math.random() * 1200),
    })),
    durationMs: 8500,
  };

  onEvent({ kind: 'run.end', result });
  return result;
}
