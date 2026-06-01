import { useReducer, useCallback } from 'react';
import type { ParsedSpec } from '../../spec/types';
import type { RunEvent, PlaywrightAction, Verdict, RunResult } from '../../runner/events';

export interface StepState {
  index: number;
  text: string;
  status: 'pending' | 'running' | 'thinking' | 'ok' | 'error';
  actions: PlaywrightAction[];
  screenshot: string | null;
  durationMs: number | null;
  error: string | null;
}

export interface RunState {
  spec: ParsedSpec | null;
  runId: string | null;
  steps: StepState[];
  activeStepIndex: number | null;
  judging: boolean;
  verdict: Verdict | null;
  result: RunResult | null;
  startedAt: number | null;
}

const initialState: RunState = {
  spec: null,
  runId: null,
  steps: [],
  activeStepIndex: null,
  judging: false,
  verdict: null,
  result: null,
  startedAt: null,
};

function reducer(state: RunState, event: RunEvent): RunState {
  switch (event.kind) {
    case 'run.start':
      return {
        ...state,
        spec: event.spec,
        runId: event.runId,
        startedAt: Date.now(),
        steps: event.spec.steps.map((text, index) => ({
          index,
          text,
          status: 'pending',
          actions: [],
          screenshot: null,
          durationMs: null,
          error: null,
        })),
      };

    case 'step.start':
      return {
        ...state,
        activeStepIndex: event.index,
        steps: updateStep(state.steps, event.index, { status: 'running' }),
      };

    case 'step.thinking':
      return {
        ...state,
        steps: updateStep(state.steps, event.index, { status: 'thinking' }),
      };

    case 'step.action':
      return {
        ...state,
        steps: updateStepFn(state.steps, event.index, (s) => ({
          ...s,
          actions: [...s.actions, event.action],
        })),
      };

    case 'step.snapshot':
      return {
        ...state,
        steps: updateStep(state.steps, event.index, { screenshot: event.screenshot }),
      };

    case 'step.end':
      return {
        ...state,
        activeStepIndex: null,
        steps: updateStep(state.steps, event.index, {
          status: event.status,
          durationMs: event.durationMs,
          error: event.error ?? null,
        }),
      };

    case 'judge.start':
      return { ...state, judging: true };

    case 'judge.end':
      return { ...state, judging: false, verdict: event.verdict };

    case 'run.end':
      return { ...state, result: event.result };

    default:
      return state;
  }
}

function updateStep(steps: StepState[], index: number, patch: Partial<StepState>): StepState[] {
  return steps.map((s) => (s.index === index ? { ...s, ...patch } : s));
}

function updateStepFn(
  steps: StepState[],
  index: number,
  fn: (s: StepState) => StepState,
): StepState[] {
  return steps.map((s) => (s.index === index ? fn(s) : s));
}

export function useRunEvents() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const pushEvent = useCallback((e: RunEvent) => dispatch(e), []);
  return { state, pushEvent };
}

export { reducer, initialState };
