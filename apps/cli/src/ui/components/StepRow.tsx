import { Box, Text } from 'ink';
import type { StepState } from '../hooks/useRunEvents.js';
import { colors, icons } from '../theme.js';
import { ThinkingDots } from './ThinkingDots.js';
import { ActionBadge } from './ActionBadge.js';
import { formatMs } from '../hooks/useElapsed.js';

interface StepRowProps {
  step: StepState;
}

export function StepRow({ step }: StepRowProps) {
  const icon = statusIcon(step.status);
  const iconColor = statusColor(step.status);
  const lastAction = step.actions.length > 0 ? step.actions[step.actions.length - 1] : null;

  return (
    <Box flexDirection="column">
      <Box gap={1}>
        <Text color={iconColor}>{icon}</Text>
        <Text dimColor={step.status === 'pending'}>
          {step.index + 1}. {step.text}
        </Text>
        {step.durationMs !== null && (
          <Text dimColor>{formatMs(step.durationMs)}</Text>
        )}
      </Box>
      {step.status === 'thinking' && (
        <Box marginLeft={3}>
          <ThinkingDots />
        </Box>
      )}
      {lastAction && step.status !== 'pending' && step.status !== 'ok' && step.status !== 'error' && (
        <Box marginLeft={3}>
          <ActionBadge action={lastAction} />
        </Box>
      )}
      {step.error && (
        <Box marginLeft={3}>
          <Text color={colors.fail}>{step.error}</Text>
        </Box>
      )}
    </Box>
  );
}

function statusIcon(status: StepState['status']): string {
  switch (status) {
    case 'pending': return icons.pending;
    case 'running': return icons.running;
    case 'thinking': return icons.running;
    case 'ok': return icons.ok;
    case 'error': return icons.error;
  }
}

function statusColor(status: StepState['status']): string {
  switch (status) {
    case 'pending': return colors.dim;
    case 'running': return colors.brand;
    case 'thinking': return colors.brand;
    case 'ok': return colors.pass;
    case 'error': return colors.fail;
  }
}
