import { Box, Text } from 'ink';
import { colors } from '../theme';

interface HeaderProps {
  name: string | null;
  url: string | null;
  runId: string | null;
}

export function Header({ name, url, runId }: HeaderProps) {
  if (!name) return null;

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box>
        <Text bold color={colors.brand}>coglity</Text>
        <Text> web test</Text>
      </Box>
      <Box>
        <Text dimColor>spec </Text>
        <Text bold>{name}</Text>
      </Box>
      <Box>
        <Text dimColor>url  </Text>
        <Text>{url}</Text>
      </Box>
      {runId && (
        <Box>
          <Text dimColor>run  </Text>
          <Text>{runId}</Text>
        </Box>
      )}
    </Box>
  );
}
