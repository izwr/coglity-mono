import { useState } from 'react';
import { useMeasuredWidth } from './useMeasuredWidth';
import { formatExact } from '../../lib/format';

interface HeatmapProps {
  rows: { id: string; label: string }[];
  cols: string[];
  /** values[rowIndex][colIndex] — e.g. failure counts per suite per day. */
  values: number[][];
  ramp?: 'heat' | 'seq';
  onCellClick?: (rowId: string, colIndex: number) => void;
}

const CELL = 14;
const GAP = 2;
const LABEL_W = 120;

function bucketFor(value: number, max: number): number {
  if (value <= 0 || max <= 0) return 0;
  return Math.min(5, Math.max(1, Math.ceil((value / max) * 5)));
}

/**
 * Density matrix (suite × day). Cell color buckets into the 5-step ramp;
 * zero stays paper. Click drills into that row's slice.
 */
export function Heatmap({ rows, cols, values, ramp = 'heat', onCellClick }: HeatmapProps) {
  const { ref, width } = useMeasuredWidth<HTMLDivElement>();
  const [tip, setTip] = useState<{ text: string; x: number; y: number } | null>(null);

  if (rows.length === 0) {
    return (
      <div ref={ref} className="empty--inline" style={{ minHeight: 80 }}>
        <span className="microlabel plain">No failures in range</span>
      </div>
    );
  }

  const max = Math.max(1, ...values.flat());
  const gridW = cols.length * (CELL + GAP);
  const labelW = Math.min(LABEL_W, Math.max(60, width - gridW - 8));
  const height = rows.length * (CELL + GAP) + 16;
  const rampVar = (b: number) => (b === 0 ? 'var(--heat-0)' : `var(--${ramp}-${b})`);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <svg width={width} height={height} style={{ display: 'block', maxWidth: '100%' }}>
        {rows.map((row, ri) => (
          <g key={row.id} transform={`translate(0, ${ri * (CELL + GAP)})`}>
            <text
              className="viz-axis-label"
              x={labelW - 6}
              y={CELL / 2 + 3.5}
              textAnchor="end"
            >
              {row.label.length > 16 ? `${row.label.slice(0, 15)}…` : row.label}
            </text>
            {cols.map((col, ci) => {
              const value = values[ri]?.[ci] ?? 0;
              return (
                <rect
                  key={ci}
                  className="heat-cell"
                  x={labelW + ci * (CELL + GAP)}
                  y={0}
                  width={CELL}
                  height={CELL}
                  rx={2.5}
                  fill={rampVar(bucketFor(value, max))}
                  onClick={onCellClick ? () => onCellClick(row.id, ci) : undefined}
                  onMouseMove={(e) =>
                    setTip({
                      text: `${row.label} · ${col} · ${formatExact(value)}`,
                      x: e.clientX,
                      y: e.clientY,
                    })
                  }
                  onMouseLeave={() => setTip(null)}
                />
              );
            })}
          </g>
        ))}
        {/* sparse column labels: first, middle, last */}
        {[0, Math.floor(cols.length / 2), cols.length - 1]
          .filter((v, i, arr) => arr.indexOf(v) === i)
          .map((ci) => (
            <text
              key={ci}
              className="viz-axis-label"
              x={labelW + ci * (CELL + GAP) + CELL / 2}
              y={height - 2}
              textAnchor="middle"
            >
              {cols[ci]}
            </text>
          ))}
      </svg>
      {tip && (
        <div className="viz-tip" style={{ left: tip.x + 12, top: tip.y + 12 }}>
          {tip.text}
        </div>
      )}
    </div>
  );
}
