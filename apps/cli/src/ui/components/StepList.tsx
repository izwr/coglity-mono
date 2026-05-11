import { Box, Static } from 'ink';
import type { StepState } from '../hooks/useRunEvents';
import { StepRow } from './StepRow';

interface StepListProps {
  steps: StepState[];
  activeIndex: number | null;
}

export function StepList({ steps, activeIndex }: StepListProps) {
  const completed = steps.filter(
    (s) => s.status === 'ok' || s.status === 'error',
  );
  const rest = steps.filter(
    (s) => s.status !== 'ok' && s.status !== 'error',
  );

  return (
    <Box flexDirection="column" gap={0}>
      <Static items={completed}>
        {(step) => <StepRow key={step.index} step={step} />}
      </Static>
      {rest.map((step) => (
        <StepRow key={step.index} step={step} />
      ))}
    </Box>
  );
}
