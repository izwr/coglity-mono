import { formatCompact } from '../../lib/format';

export interface StackedSegment {
  key: string;
  label: string;
  value: number;
  color: string;
}

interface StackedBarProps {
  segments: StackedSegment[];
  /** When set, other segments dim to 35% (cross-filter highlight). */
  activeKey?: string | null;
  onSegmentClick?: (segment: StackedSegment) => void;
  height?: number;
}

/** One horizontal stacked distribution bar with a clickable legend. */
export function StackedBar({ segments, activeKey, onSegmentClick, height = 14 }: StackedBarProps) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  if (total === 0) {
    return (
      <div className="empty--inline" style={{ minHeight: 60 }}>
        <span className="microlabel plain">No runs in range</span>
      </div>
    );
  }
  const visible = segments.filter((s) => s.value > 0);

  return (
    <div>
      <div
        style={{
          display: 'flex',
          height,
          borderRadius: height / 2,
          overflow: 'hidden',
          background: 'var(--bg-2)',
        }}
      >
        {visible.map((s) => (
          <div
            key={s.key}
            title={`${s.label}: ${formatCompact(s.value)}`}
            onClick={onSegmentClick ? () => onSegmentClick(s) : undefined}
            style={{
              width: `${(s.value / total) * 100}%`,
              background: s.color,
              opacity: activeKey != null && activeKey !== s.key ? 0.35 : 1,
              cursor: onSegmentClick ? 'pointer' : undefined,
              transition: 'opacity var(--dur) var(--ease-out)',
              minWidth: 2,
            }}
          />
        ))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', marginTop: 10 }}>
        {visible.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={onSegmentClick ? () => onSegmentClick(s) : undefined}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 'var(--fs-micro)',
              fontFamily: 'var(--mono)',
              color: 'var(--muted)',
              opacity: activeKey != null && activeKey !== s.key ? 0.45 : 1,
              cursor: onSegmentClick ? 'pointer' : 'default',
              padding: 0,
            }}
          >
            <span style={{ width: 7, height: 7, borderRadius: 2, background: s.color }} />
            {s.label} {formatCompact(s.value)}
          </button>
        ))}
      </div>
    </div>
  );
}
