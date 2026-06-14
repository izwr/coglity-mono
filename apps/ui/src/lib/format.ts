import type { CountResult } from '@coglity/shared';

const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });
const exact = new Intl.NumberFormat('en');

/** "≈1.2M" for estimates, "1,234" for exact counts. */
export function formatCount(count: CountResult | null | undefined): string {
  if (!count) return '—';
  return count.isEstimate ? `≈${compact.format(count.value)}` : exact.format(count.value);
}

/** Compact form regardless of estimate flag: 97412 → "97.4K". */
export function formatCompact(value: number): string {
  return compact.format(value);
}

export function formatExact(value: number): string {
  return exact.format(value);
}

/** "12s" / "1.2s" / "840ms" for run durations. */
export function formatDurationMs(ms: number | null | undefined): string {
  if (ms == null || ms <= 0) return '—';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${Math.round(s % 60)}s`;
}

/** "12m ago" / "3h ago" / "2d ago" relative timestamps for dense grids. */
export function formatRelative(date: string | Date | null | undefined): string {
  if (!date) return '—';
  const then = typeof date === 'string' ? new Date(date) : date;
  const diffMs = Date.now() - then.getTime();
  if (Number.isNaN(diffMs)) return '—';
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return then.toLocaleDateString();
}
