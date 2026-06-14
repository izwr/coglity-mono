import type { ReactNode } from 'react';
import { Sparkline } from './Sparkline';
import { useCountUp } from '../../hooks/useCountUp';
import { formatCompact, formatExact } from '../../lib/format';

interface StatTileProps {
  label: string;
  /** Numeric dial value; animated. Pass `display` instead for non-numerics. */
  value?: number | null;
  /** Pre-formatted value (e.g. "97.4%"); skips the count-up. */
  display?: string;
  /** Prefix the dial with ≈ for estimated counts. */
  approx?: boolean;
  delta?: ReactNode;
  deltaDir?: 'up' | 'down';
  spark?: number[];
  sparkColor?: string;
  /** Teal dial + pulse dot: this number is changing right now. */
  live?: boolean;
  onClick?: () => void;
}

function Dial({ value, approx }: { value: number; approx?: boolean }) {
  const animated = useCountUp(value);
  const rounded = Math.round(animated);
  const text = value >= 10_000 ? formatCompact(rounded) : formatExact(rounded);
  return (
    <span title={formatExact(value)}>
      {approx ? '≈' : ''}
      {text}
    </span>
  );
}

export function StatTile({
  label,
  value,
  display,
  approx,
  delta,
  deltaDir,
  spark,
  sparkColor,
  live,
  onClick,
}: StatTileProps) {
  const body = (
    <>
      <span className="microlabel">
        {live && <span className="dot pulse" style={{ color: 'var(--teal)' }} />}
        {label}
      </span>
      <div className="dial-value">
        {display !== undefined ? (
          <span>{display}</span>
        ) : value == null ? (
          <span className="num">—</span>
        ) : (
          <Dial value={value} approx={approx} />
        )}
      </div>
      <div className="dial-meta">
        {delta != null && <span className={deltaDir ?? ''}>{delta}</span>}
      </div>
      {spark && spark.length > 1 && (
        <Sparkline data={spark} color={sparkColor ?? 'var(--teal)'} height={28} />
      )}
    </>
  );

  return onClick ? (
    <button type="button" className={`dial${live ? ' live' : ''}`} onClick={onClick}>
      {body}
    </button>
  ) : (
    <div className={`dial${live ? ' live' : ''}`}>{body}</div>
  );
}
