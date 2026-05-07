export const colors = {
  brand: '#7C3AED',
  pass: '#22C55E',
  fail: '#EF4444',
  inconclusive: '#F59E0B',
  dim: '#6B7280',
  muted: '#9CA3AF',
  action: {
    click: '#3B82F6',
    fill: '#8B5CF6',
    goto: '#06B6D4',
    press: '#F97316',
    select: '#EC4899',
    wait_for: '#6B7280',
  },
} as const;

export const icons = {
  pending: '○',
  running: '●',
  ok: '✓',
  error: '✗',
  thinking: '◌',
  judge: '⚖',
  pass: '✅',
  fail: '❌',
  inconclusive: '⚠️',
} as const;
