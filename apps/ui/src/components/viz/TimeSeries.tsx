import { useMemo, useState } from 'react';
import type { TimeseriesPoint, TimeseriesBucket } from '@coglity/shared';
import { useMeasuredWidth } from './useMeasuredWidth';
import { formatExact } from '../../lib/format';

interface TimeSeriesProps {
  points: TimeseriesPoint[];
  bucket: TimeseriesBucket;
  height?: number;
}

const PAD_LEFT = 8;
const PAD_RIGHT = 8;
const PAD_TOP = 10;
const PAD_BOTTOM = 22;

const SERIES = [
  { key: 'passed', color: 'var(--viz-pass)' },
  { key: 'failed', color: 'var(--viz-fail)' },
  { key: 'errored', color: 'var(--viz-warn)' },
] as const;

function tsLabel(ts: string, bucket: TimeseriesBucket): string {
  const d = new Date(ts);
  if (bucket === 'hour')
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/**
 * Stacked area chart of run outcomes over time: passed on the baseline,
 * failed and errored stacked above, hover crosshair with per-bucket counts.
 */
export function TimeSeries({ points, bucket, height = 180 }: TimeSeriesProps) {
  const { ref, width } = useMeasuredWidth<HTMLDivElement>();
  const [hover, setHover] = useState<{ index: number; x: number; y: number } | null>(null);

  const plotW = Math.max(40, width - PAD_LEFT - PAD_RIGHT);
  const plotH = height - PAD_TOP - PAD_BOTTOM;

  const { stacks, maxY } = useMemo(() => {
    const stacked = points.map((p) => {
      const passed = p.passed;
      const failed = passed + p.failed;
      const errored = failed + p.errored;
      return { passed, failed, errored };
    });
    const max = Math.max(1, ...stacked.map((s) => s.errored));
    return { stacks: stacked, maxY: max };
  }, [points]);

  const x = (i: number) =>
    PAD_LEFT + (points.length <= 1 ? plotW / 2 : (i / (points.length - 1)) * plotW);
  const y = (v: number) => PAD_TOP + plotH - (v / maxY) * plotH;

  const areaPath = (upper: number[], lower: number[]) => {
    if (points.length === 0) return '';
    const top = upper.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`);
    const bottom = lower
      .map((_, i) => `L${x(lower.length - 1 - i).toFixed(1)} ${y(lower[lower.length - 1 - i]).toFixed(1)}`)
      .join(' ');
    return `${top.join(' ')} ${bottom} Z`;
  };

  const zeros = points.map(() => 0);
  const passedTop = stacks.map((s) => s.passed);
  const failedTop = stacks.map((s) => s.failed);
  const erroredTop = stacks.map((s) => s.errored);

  const linePath = erroredTop
    .map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`)
    .join(' ');

  const handleMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (points.length === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = e.clientX - rect.left - PAD_LEFT;
    const index = Math.max(
      0,
      Math.min(points.length - 1, Math.round((relX / plotW) * (points.length - 1))),
    );
    setHover({ index, x: e.clientX, y: e.clientY });
  };

  const tickIndexes =
    points.length <= 3 ? points.map((_, i) => i) : [0, Math.floor(points.length / 2), points.length - 1];

  if (points.length === 0) {
    return (
      <div ref={ref} className="empty--inline" style={{ minHeight: height }}>
        <span className="microlabel plain">No runs in range</span>
      </div>
    );
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <svg
        width={width}
        height={height}
        onMouseMove={handleMove}
        onMouseLeave={() => setHover(null)}
        style={{ display: 'block', maxWidth: '100%' }}
      >
        {/* hairline grid */}
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <line
            key={f}
            x1={PAD_LEFT}
            x2={PAD_LEFT + plotW}
            y1={y(maxY * f)}
            y2={y(maxY * f)}
            stroke="var(--viz-grid)"
            strokeWidth="1"
          />
        ))}
        {/* stacked areas: passed, then failed, then errored */}
        <path d={areaPath(passedTop, zeros)} fill="var(--viz-pass)" opacity="0.16" />
        <path d={areaPath(failedTop, passedTop)} fill="var(--viz-fail)" opacity="0.22" />
        <path d={areaPath(erroredTop, failedTop)} fill="var(--viz-warn)" opacity="0.22" />
        {/* total outline with draw-in */}
        <path
          d={linePath}
          fill="none"
          stroke="var(--teal)"
          strokeWidth="1.75"
          strokeLinejoin="round"
          pathLength={1000}
          strokeDasharray={1000}
          strokeDashoffset={0}
          style={{ ['--draw-len' as string]: 1000, animation: 'draw-line var(--dur-draw) var(--ease-out)' }}
        />
        {/* crosshair */}
        {hover && (
          <line
            x1={x(hover.index)}
            x2={x(hover.index)}
            y1={PAD_TOP}
            y2={PAD_TOP + plotH}
            stroke="var(--muted-2)"
            strokeWidth="1"
            strokeDasharray="2 3"
          />
        )}
        {/* x ticks */}
        {tickIndexes.map((i) => (
          <text key={i} className="viz-axis-label" x={x(i)} y={height - 6} textAnchor="middle">
            {tsLabel(points[i].ts, bucket)}
          </text>
        ))}
        {/* y max tick */}
        <text className="viz-axis-label" x={PAD_LEFT + 2} y={PAD_TOP + 4}>
          {formatExact(maxY)}
        </text>
      </svg>
      {hover && (
        <div className="viz-tip" style={{ left: hover.x + 12, top: hover.y + 12 }}>
          <div className="tip-title">{tsLabel(points[hover.index].ts, bucket)}</div>
          {SERIES.map((s) => (
            <div key={s.key} className="tip-row">
              <span className="tip-swatch" style={{ background: s.color }} />
              {s.key} {formatExact(points[hover.index][s.key])}
            </div>
          ))}
          <div className="tip-row">total {formatExact(points[hover.index].total)}</div>
        </div>
      )}
    </div>
  );
}
