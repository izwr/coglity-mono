import { Text } from 'ink';
import Spinner from 'ink-spinner';
import { colors } from '../theme';

export function ThinkingDots() {
  return (
    <Text color={colors.muted}>
      <Spinner type="dots" /> thinking
    </Text>
  );
}
