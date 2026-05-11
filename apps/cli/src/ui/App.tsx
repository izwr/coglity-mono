import { Box, useApp } from 'ink';
import { useEffect, useRef } from 'react';
import type { ParsedSpec } from '../spec/types';
import type { RunOptions, RunResult } from '../runner/events';
import { useRunEvents } from './hooks/useRunEvents';
import { useElapsed } from './hooks/useElapsed';
import { Header } from './components/Header';
import { StepList } from './components/StepList';
import { JudgePanel } from './components/JudgePanel';
import { Verdict } from './components/Verdict';
import { Footer } from './components/Footer';

interface AppProps {
  spec: ParsedSpec;
  opts: RunOptions;
  run: (
    spec: ParsedSpec,
    opts: RunOptions,
    onEvent: (e: import('../runner/events.js').RunEvent) => void,
  ) => Promise<RunResult>;
}

export function App({ spec, opts, run }: AppProps) {
  const { exit } = useApp();
  const { state, pushEvent } = useRunEvents();
  const done = state.result !== null;
  const elapsed = useElapsed(state.startedAt, done);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    run(spec, opts, pushEvent)
      .then(() => {
        setTimeout(() => exit(), 100);
      })
      .catch((err: unknown) => {
        exit(err instanceof Error ? err : new Error(String(err)));
      });
  }, [spec, opts, run, pushEvent, exit]);

  return (
    <Box flexDirection="column">
      <Header
        name={state.spec?.name ?? spec.name}
        url={state.spec?.url ?? spec.url}
        runId={state.runId}
      />
      <StepList steps={state.steps} activeIndex={state.activeStepIndex} />
      {state.judging && <JudgePanel />}
      {state.verdict && <Verdict verdict={state.verdict} />}
      <Footer elapsed={elapsed} runId={state.runId} done={done} />
    </Box>
  );
}
