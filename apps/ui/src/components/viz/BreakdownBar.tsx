import type { BreakdownRow } from '@coglity/shared';
import { formatCompact } from '../../lib/format';

interface BreakdownBarProps {
  rows: BreakdownRow[];
  /** When set, rows whose key differs are dimmed (cross-filter highlight). */
  activeKey?: string | null;
  onRowClick?: (row: BreakdownRow) => void;
}

/**
 * Top-N horizontal breakdown: label · stacked pass/fail track · mono count.
 * Clicking a row drills the dashboard scope into that segment.
 */
export function BreakdownBar({ rows, activeKey, onRowClick }: BreakdownBarProps) {
  if (rows.length === 0) {
    return (
      <div className="empty--inline" style={{ minHeight: 80 }}>
        <span className="microlabel plain">No runs in range</span>
      </div>
    );
  }
  const max = Math.max(1, ...rows.map((r) => r.total));

  return (
    <div>
      {rows.map((row) => {
        const widthPct = (row.total / max) * 100;
        const errored = Math.max(0, row.total - row.passed - row.failed);
        const dimmed = activeKey != null && activeKey !== row.key;
        const Row = onRowClick ? 'button' : 'div';
        return (
          <Row
            key={row.key}
            type={onRowClick ? 'button' : undefined}
            className={`bd-row${dimmed ? ' dimmed' : ''}`}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
            title={row.label}
          >
            <span className="bd-label">{row.label}</span>
            <span className="bd-track" style={{ width: `${widthPct}%`, minWidth: 4 }}>
              <span
                className="bd-fill"
                style={{ width: `${(row.passed / Math.max(1, row.total)) * 100}%`, background: 'var(--viz-pass)' }}
              />
              <span
                className="bd-fill"
                style={{ width: `${(row.failed / Math.max(1, row.total)) * 100}%`, background: 'var(--viz-fail)' }}
              />
              <span
                className="bd-fill"
                style={{ width: `${(errored / Math.max(1, row.total)) * 100}%`, background: 'var(--viz-warn)' }}
              />
            </span>
            <span className="bd-count">
              {formatCompact(row.total)}
              {row.passRate != null && ` · ${Math.round(row.passRate * 100)}%`}
            </span>
          </Row>
        );
      })}
    </div>
  );
}
