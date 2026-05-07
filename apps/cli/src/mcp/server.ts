import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import fs from 'node:fs/promises';
import path from 'node:path';
import { parseSpecContent } from '../spec/parser.js';
import { runSpec } from '../runner/index.js';
import type { RunEvent, RunResult, RunEventEmitter, PlaywrightAction } from '../runner/events.js';
import { CoglityError } from '../agents/shared/errors.js';

type RunFn = typeof runSpec;

const SPEC_FORMAT_DESCRIPTION = `The test spec as inline markdown with YAML frontmatter and two required sections.

Format:
---
name: <test name>           # required
url: <starting URL>         # required, must be valid URL
viewport:                   # optional, defaults to 1280x720
  width: 1280
  height: 720
auth: <path to auth state>  # optional, Playwright storage state JSON
timeout: 30000              # optional, per-step timeout in ms, defaults to 30000
---

# Setup

<Prose describing the app state and preconditions. Gives context to the AI planner agent that drives the browser.>

# Steps

1. <First action to perform>
2. <Second action to perform>
...

The last step is the implicit success criterion — the judge agent uses it to decide pass/fail.
Each step should be a clear, single instruction (e.g. "Click the Submit button", "Verify the dashboard shows 3 items").`;

export interface McpServerOptions {
  runner?: RunFn;
}

export function createServer(opts: McpServerOptions = {}): McpServer {
  const runner = opts.runner ?? runSpec;

  const server = new McpServer(
    { name: 'coglity', version: '0.0.1' },
    { capabilities: { tools: {} } },
  );

  server.tool(
    'run_web_test',
    `Run a Coglity web test against a live website. Launches a Chromium browser (auto-installed on first use), executes each step using an AI planner agent that reads the page's accessibility tree and performs browser actions (click, fill, navigate, etc.), then evaluates the final page state with a judge agent that returns pass/fail/inconclusive with reasoning. Returns a structured result with the verdict, per-step outcomes (status, duration, actions taken, errors), and the path to the run directory containing screenshots, accessibility snapshots, and full LLM traces. Typical execution takes 15-60 seconds depending on step count and page complexity.`,
    {
      spec: z.string().describe(SPEC_FORMAT_DESCRIPTION),
      headed: z.boolean().optional().describe('Run browser in headed mode with visible UI. Defaults to false (headless).'),
      plannerModel: z.string().optional().describe('Override the planner LLM model. Defaults to claude-sonnet-4-6.'),
      judgeModel: z.string().optional().describe('Override the judge LLM model. Defaults to claude-haiku-4-5.'),
    },
    async ({ spec, headed, plannerModel, judgeModel }) => {
      try {
        const parsed = parseSpecContent(spec, '<mcp>');
        const events: RunEvent[] = [];
        const onEvent: RunEventEmitter = (e) => events.push(e);

        const result = await runner(
          parsed,
          { headed, plannerModel, judgeModel },
          onEvent,
        );

        return { content: [{ type: 'text', text: formatRunResult(result, events) }] };
      } catch (err) {
        return errorResponse(err);
      }
    },
  );

  server.tool(
    'dry_run',
    `Parse and validate a Coglity test spec without executing it. Returns the parsed structure including resolved defaults (viewport, timeout) and extracted steps. Use this to verify a spec is well-formed before committing to a full test run, or to inspect what the runner will see. Returns an error with specific field-level details if the spec is malformed (e.g., missing URL, invalid viewport dimensions, missing # Setup or # Steps section).`,
    {
      spec: z.string().describe(SPEC_FORMAT_DESCRIPTION),
    },
    async ({ spec }) => {
      try {
        const parsed = parseSpecContent(spec, '<dry-run>');
        const summary = {
          name: parsed.name,
          url: parsed.url,
          viewport: parsed.viewport,
          auth: parsed.auth ?? null,
          timeout: parsed.timeout,
          setup: parsed.setup,
          steps: parsed.steps,
          stepCount: parsed.steps.length,
        };
        return { content: [{ type: 'text', text: JSON.stringify(summary, null, 2) }] };
      } catch (err) {
        return errorResponse(err);
      }
    },
  );

  server.tool(
    'list_runs',
    `List recent Coglity web test runs from the .coglity/runs/ directory in the current working directory. Returns run IDs (ISO timestamps), the spec that was tested, the verdict (pass/fail/inconclusive), and total duration. Runs are sorted newest-first. Use this to review test history, find failing runs, or locate a specific run ID for detailed inspection with get_run_result.`,
    {
      limit: z.number().int().positive().optional().describe('Maximum number of runs to return. Defaults to 20.'),
    },
    async ({ limit }) => {
      try {
        const runsDir = path.join(process.cwd(), '.coglity', 'runs');
        let entries: string[];
        try {
          entries = await fs.readdir(runsDir);
        } catch {
          return { content: [{ type: 'text', text: 'No runs found. The .coglity/runs/ directory does not exist yet.' }] };
        }

        entries.sort().reverse();
        const cap = limit ?? 20;
        const runs: string[] = [];

        for (const entry of entries.slice(0, cap)) {
          const resultPath = path.join(runsDir, entry, 'result.json');
          try {
            const raw = await fs.readFile(resultPath, 'utf-8');
            const result = JSON.parse(raw) as RunResult;
            runs.push(
              `${result.runId}  ${result.verdict.outcome.toUpperCase().padEnd(13)}  ${result.specFile}  ${result.durationMs}ms`,
            );
          } catch {
            runs.push(`${entry}  (no result.json)`);
          }
        }

        if (runs.length === 0) {
          return { content: [{ type: 'text', text: 'No runs found.' }] };
        }

        return { content: [{ type: 'text', text: runs.join('\n') }] };
      } catch (err) {
        return errorResponse(err);
      }
    },
  );

  server.tool(
    'get_run_result',
    `Get the full result of a specific Coglity test run by its run ID (e.g., '2026-05-03T19-33-21-000Z'). Returns the verdict with reasoning, per-step results (status, duration, errors), the original spec, and the path to the run directory containing screenshots, accessibility snapshots, and LLM trace files. Use this to investigate why a test failed, review the judge's reasoning, or find screenshot paths for visual inspection.`,
    {
      runId: z.string().describe('The run ID to look up (e.g., "2026-05-03T19-33-21-000Z").'),
    },
    async ({ runId }) => {
      try {
        const dir = path.join(process.cwd(), '.coglity', 'runs', runId);
        const resultPath = path.join(dir, 'result.json');

        let raw: string;
        try {
          raw = await fs.readFile(resultPath, 'utf-8');
        } catch {
          return {
            content: [{ type: 'text', text: `Run not found: ${runId}\nExpected path: ${resultPath}` }],
            isError: true,
          };
        }

        const result = JSON.parse(raw) as RunResult;
        return { content: [{ type: 'text', text: formatDetailedResult(result, dir) }] };
      } catch (err) {
        return errorResponse(err);
      }
    },
  );

  return server;
}

function formatRunResult(result: RunResult, events: RunEvent[]): string {
  const lines: string[] = [
    `## Run: ${result.runId}`,
    `**Spec**: ${result.specFile}`,
    `**Verdict**: ${result.verdict.outcome.toUpperCase()} — ${result.verdict.reasoning}`,
    `**Duration**: ${result.durationMs}ms`,
    '',
    '### Steps',
  ];

  for (const step of result.steps) {
    const status = step.status === 'ok' ? 'ok' : `FAIL: ${step.error}`;
    lines.push(`${step.index + 1}. ${step.text} — ${status} (${step.durationMs}ms)`);

    const actions = events
      .filter((e): e is RunEvent & { kind: 'step.action' } => e.kind === 'step.action' && e.index === step.index)
      .map((e) => formatAction(e.action));

    if (actions.length > 0) {
      lines.push(`   Actions: ${actions.join(', ')}`);
    }
  }

  lines.push('', `**Run dir**: .coglity/runs/${result.runId}/`);
  return lines.join('\n');
}

function formatDetailedResult(result: RunResult, dir: string): string {
  const lines: string[] = [
    `## Run: ${result.runId}`,
    `**Spec**: ${result.specFile}`,
    `**Verdict**: ${result.verdict.outcome.toUpperCase()}`,
    `**Reasoning**: ${result.verdict.reasoning}`,
    `**Duration**: ${result.durationMs}ms`,
    `**Run dir**: ${dir}`,
    '',
    '### Steps',
  ];

  for (const step of result.steps) {
    const status = step.status === 'ok' ? 'ok' : `FAIL: ${step.error}`;
    lines.push(`${step.index + 1}. ${step.text} — ${status} (${step.durationMs}ms)`);
  }

  lines.push('', '### Artifacts');
  lines.push(`- Screenshots: ${dir}/snapshots/`);
  lines.push(`- LLM traces: ${dir}/llm/`);
  lines.push(`- Event log: ${dir}/events.jsonl`);

  return lines.join('\n');
}

function formatAction(action: PlaywrightAction): string {
  switch (action.tool) {
    case 'click': return `click "${action.selector}"`;
    case 'fill': return `fill "${action.selector}" "${action.value}"`;
    case 'goto': return `goto ${action.url}`;
    case 'press': return `press ${action.key}`;
    case 'select': return `select "${action.value}" in "${action.selector}"`;
    case 'wait_for': return `wait_for "${action.selector}"`;
  }
}

function errorResponse(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  const code = err instanceof CoglityError ? err.code : 'UNKNOWN';
  return {
    content: [{ type: 'text' as const, text: `Error [${code}]: ${message}` }],
    isError: true,
  };
}
