import { Box, Text } from 'ink';
import { colors } from '../theme';
import { formatMs } from '../hooks/useElapsed';

interface FooterProps {
  elapsed: number;
  runId: string | null;
  done: boolean;
}

export function Footer({ elapsed, runId, done }: FooterProps) {
  return (
    <Box flexDirection="column" marginTop={1}>
      <Box gap={1}>
        <Text dimColor>elapsed</Text>
        <Text>{formatMs(elapsed)}</Text>
      </Box>
      {done && runId && (
        <Box gap={1}>
          <Text dimColor>run dir</Text>
          <Text color={colors.muted}>.coglity/runs/{runId}/</Text>
        </Box>
      )}
    </Box>
  );
}
