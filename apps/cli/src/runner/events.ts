import type { ParsedSpec } from '../spec/types.js';

export type PlaywrightAction =
  | { tool: 'click'; selector: string }
  | { tool: 'fill'; selector: string; value: string }
  | { tool: 'goto'; url: string }
  | { tool: 'press'; key: string }
  | { tool: 'select'; selector: string; value: string }
  | { tool: 'wait_for'; selector: string; state?: 'visible' | 'hidden' | 'attached' | 'detached' };

export interface Verdict {
  outcome: 'pass' | 'fail' | 'inconclusive';
  reasoning: string;
}

export interface StepResult {
  index: number;
  text: string;
  status: 'ok' | 'error';
  durationMs: number;
  error?: string;
}

export interface RunResult {
  runId: string;
  specFile: string;
  verdict: Verdict;
  steps: StepResult[];
  durationMs: number;
}

export type RunEvent =
  | { kind: 'run.start'; spec: ParsedSpec; runId: string }
  | { kind: 'step.start'; index: number; text: string }
  | { kind: 'step.thinking'; index: number; agent: 'planner' }
  | { kind: 'step.action'; index: number; action: PlaywrightAction }
  | { kind: 'step.snapshot'; index: number; screenshot: string }
  | { kind: 'step.end'; index: number; status: 'ok' | 'error'; durationMs: number; error?: string }
  | { kind: 'judge.start' }
  | { kind: 'judge.end'; verdict: Verdict }
  | { kind: 'run.end'; result: RunResult };

export type RunEventEmitter = (e: RunEvent) => void;

export interface RunOptions {
  headed?: boolean;
  plannerModel?: string;
  judgeModel?: string;
  signal?: AbortSignal;
}
