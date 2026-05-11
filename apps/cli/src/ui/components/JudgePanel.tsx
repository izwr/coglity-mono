import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import { colors, icons } from '../theme';

export function JudgePanel() {
  return (
    <Box marginTop={1}>
      <Text color={colors.muted}>
        <Spinner type="dots" /> {icons.judge} Judging result…
      </Text>
    </Box>
  );
}
