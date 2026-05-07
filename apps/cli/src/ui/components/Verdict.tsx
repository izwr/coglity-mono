import { Box, Text } from 'ink';
import type { Verdict as VerdictType } from '../../runner/events.js';
import { colors, icons } from '../theme.js';

interface VerdictProps {
  verdict: VerdictType;
}

export function Verdict({ verdict }: VerdictProps) {
  const icon = verdictIcon(verdict.outcome);
  const color = verdictColor(verdict.outcome);

  return (
    <Box flexDirection="column" marginTop={1}>
      <Box gap={1}>
        <Text>{icon}</Text>
        <Text bold color={color}>
          {verdict.outcome.toUpperCase()}
        </Text>
      </Box>
      <Box marginLeft={3}>
        <Text wrap="wrap" dimColor>{verdict.reasoning}</Text>
      </Box>
    </Box>
  );
}

function verdictIcon(outcome: VerdictType['outcome']): string {
  switch (outcome) {
    case 'pass': return icons.pass;
    case 'fail': return icons.fail;
    case 'inconclusive': return icons.inconclusive;
  }
}

function verdictColor(outcome: VerdictType['outcome']): string {
  switch (outcome) {
    case 'pass': return colors.pass;
    case 'fail': return colors.fail;
    case 'inconclusive': return colors.inconclusive;
  }
}
