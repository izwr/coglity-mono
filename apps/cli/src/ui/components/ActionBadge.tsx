import { Text } from 'ink';
import type { PlaywrightAction } from '../../runner/events.js';
import { colors } from '../theme.js';

interface ActionBadgeProps {
  action: PlaywrightAction;
}

export function ActionBadge({ action }: ActionBadgeProps) {
  const color = colors.action[action.tool] ?? colors.dim;
  const label = formatAction(action);

  return <Text color={color}>{label}</Text>;
}

function formatAction(action: PlaywrightAction): string {
  switch (action.tool) {
    case 'click':
      return `click "${action.selector}"`;
    case 'fill':
      return `fill "${action.selector}" → "${action.value}"`;
    case 'goto':
      return `goto ${action.url}`;
    case 'press':
      return `press ${action.key}`;
    case 'select':
      return `select "${action.value}" in "${action.selector}"`;
    case 'wait_for':
      return `wait "${action.selector}" ${action.state ?? 'visible'}`;
  }
}
