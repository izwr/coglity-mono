import { useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { ColumnDef } from '@tanstack/react-table';
import type { TimeseriesBucket } from '@coglity/shared';
import { Chip, type ChipVariant } from '../components/ui/Chip';
import { Button } from '../components/ui/Button';
import { Tabs } from '../components/ui/Tabs';
import { StatTile } from '../components/ui/StatTile';
import { DataTable } from '../components/data/DataTable';
import { TimeSeries } from '../components/viz/TimeSeries';
import { BreakdownBar } from '../components/viz/BreakdownBar';
import { StackedBar, type StackedSegment } from '../components/viz/StackedBar';
import { useSetBreadcrumbs } from '../context/BreadcrumbsContext';
import { ProjectFilter, useSelectedProjectIds } from '../components/ProjectFilter';
import { useCurrentOrg } from '../context/OrgContext';
import { useRunsOverview, useRunsTimeseries, useRunsBreakdown } from '../queries/stats';
import { useTestRunsInfinite } from '../queries/testRuns';
import type { TestRunListRow } from '../services/testRunService';
import { formatCount, formatDurationMs } from '../lib/format';
import type { StatsRunFilters } from '../services/statsService';

const STATE_CHIP: Record<string, { variant: ChipVariant; label: string }> = {
  passed: { variant: 'pass', label: 'Passed' },
  failed: { variant: 'fail', label: 'Failed' },
  errored: { variant: 'warn', label: 'Errored' },
  running: { variant: 'teal', label: 'Running' },
  queued: { variant: 'info', label: 'Queued' },
  cancelled: { variant: 'neutral', label: 'Cancelled' },
};

function scoreColor(score: number): string {
  if (score >= 8) return 'var(--green)';
  if (score >= 6) return '#84CC16';
  if (score >= 4) return 'var(--amber)';
  return 'var(--red)';
}

const RANGES = {
  '24h': { ms: 24 * 3_600_000, bucket: 'hour' as TimeseriesBucket, label: '24h' },
  '7d': { ms: 7 * 86_400_000, bucket: 'day' as TimeseriesBucket, label: '7d' },
  '30d': { ms: 30 * 86_400_000, bucket: 'day' as TimeseriesBucket, label: '30d' },
  '90d': { ms: 90 * 86_400_000, bucket: 'week' as TimeseriesBucket, label: '90d' },
};
type RangeKey = keyof typeof RANGES;

const STATE_COLORS: Record<string, string> = {
  passed: 'var(--viz-pass)',
  failed: 'var(--viz-fail)',
  errored: 'var(--viz-warn)',
  running: 'var(--viz-live)',
  queued: 'var(--viz-info)',
  cancelled: 'var(--viz-neutral)',
};

function Panel({
  title,
  error,
  onRetry,
  children,
}: {
  title: string;
  error?: boolean;
  onRetry?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="panel">
      <div className="panel-head">
        <span className="microlabel">{title}</span>
      </div>
      {error ? (
        <div className="panel-error">
          <span>failed to load</span>
          {onRetry && (
            <Button variant="ghost" size="sm" onClick={onRetry}>
              Retry
            </Button>
          )}
        </div>
      ) : (
        <div className="panel-body">{children}</div>
      )}
    </div>
  );
}

export function Reporting() {
  useSetBreadcrumbs([{ label: 'Reports' }]);
  const navigate = useNavigate();
  const { org } = useCurrentOrg();
  const orgId = org?.organizationId ?? '';
  const selectedProjectIds = useSelectedProjectIds();
  // No selection means "all projects I can read" — the backend scopes to
  // readable projects regardless.
  const projectIds = useMemo(
    () =>
      selectedProjectIds.length > 0
        ? selectedProjectIds
        : (org?.projects ?? []).map((p) => p.projectId),
    [selectedProjectIds, org?.projects],
  );
  const [params, setParams] = useSearchParams();

  // ── Drill scope, fully URL-encoded ──
  const rangeKey = (params.get('range') ?? '7d') as RangeKey;
  const range = RANGES[rangeKey] ?? RANGES['7d'];
  const state = params.get('state') ?? '';
  const suiteId = params.get('suite') ?? '';
  const suiteLabel = params.get('suiteLabel') ?? '';
  const environment = params.get('env') ?? '';

  const setParam = (key: string, value?: string, extra?: Record<string, string | undefined>) => {
    const next = new URLSearchParams(params);
    const entries = { [key]: value, ...extra };
    for (const [k, v] of Object.entries(entries)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    setParams(next, { replace: true });
  };

  const from = useMemo(
    () => new Date(Date.now() - range.ms).toISOString(),
    // re-derive when the range changes; "now" staleness within a render pass is fine
    [range.ms],
  );

  const baseFilters: StatsRunFilters = {
    from,
    ...(state ? { state } : {}),
    ...(suiteId ? { testSuiteId: suiteId } : {}),
    ...(environment ? { environment } : {}),
  };

  // Cross-filter principle: each panel omits its OWN dimension so you always
  // see the whole distribution with the active slice highlighted, while every
  // other panel narrows to the selection.
  const { [`testSuiteId` as const]: _s, ...filtersSansSuite } = baseFilters;
  const { state: _st, ...filtersSansState } = baseFilters;
  const { environment: _e, ...filtersSansEnv } = baseFilters;

  const overview = useRunsOverview(orgId, projectIds, baseFilters);
  const timeseries = useRunsTimeseries(orgId, projectIds, range.bucket, baseFilters);
  const bySuite = useRunsBreakdown(orgId, projectIds, 'testSuite', {
    ...filtersSansSuite,
    limit: 10,
  });
  const byEnv = useRunsBreakdown(orgId, projectIds, 'environment', {
    ...filtersSansEnv,
    limit: 10,
  });
  const byState = useRunsBreakdown(orgId, projectIds, 'state', { ...filtersSansState, limit: 10 });

  const hasDrill = Boolean(state || suiteId || environment);
  const runs = useTestRunsInfinite(orgId, hasDrill ? projectIds : [], {
    from,
    ...(state ? { state } : {}),
    ...(suiteId ? { testSuiteId: suiteId } : {}),
    ...(environment ? { environment } : {}),
    limit: 50,
  });

  const stateSegments: StackedSegment[] = (byState.data?.rows ?? []).map((row) => ({
    key: row.key,
    label: row.label,
    value: row.total,
    color: STATE_COLORS[row.key] ?? 'var(--viz-neutral)',
  }));

  const ov = overview.data;
  const passRatePct = ov?.passRate != null ? `${Math.round(ov.passRate * 100)}%` : undefined;

  const columns = useMemo<ColumnDef<TestRunListRow, unknown>[]>(
    () => [
      {
        id: 'state',
        header: 'Status',
        size: 110,
        cell: ({ row }) => {
          const chip = STATE_CHIP[row.original.state] ?? STATE_CHIP.queued;
          return (
            <Chip variant={chip.variant} size="sm" dot pulse={row.original.state === 'running'}>
              {chip.label}
            </Chip>
          );
        },
      },
      {
        id: 'testCase',
        header: 'Test case',
        size: 240,
        meta: { flex: true },
        cell: ({ row }) => (
          <>
            <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {row.original.testCaseTitle ?? row.original.testCaseId.slice(0, 8)}
            </div>
            {row.original.createdByName && (
              <div className="cell-sub">{row.original.createdByName}</div>
            )}
          </>
        ),
      },
      {
        id: 'language',
        header: 'Lang',
        size: 80,
        cell: ({ row }) => <span className="num">{row.original.language ?? '—'}</span>,
      },
      {
        id: 'environment',
        header: 'Env',
        size: 90,
        cell: ({ row }) => <span className="num">{row.original.environment ?? '—'}</span>,
      },
      {
        id: 'turns',
        header: 'Turns',
        size: 64,
        cell: ({ row }) => (
          <span className="num">{(row.original.properties?.total_turns as number) ?? '—'}</span>
        ),
      },
      {
        id: 'duration',
        header: 'Duration',
        size: 84,
        cell: ({ row }) => (
          <span className="num">
            {formatDurationMs(row.original.properties?.total_duration_ms as number)}
          </span>
        ),
      },
      {
        id: 'score',
        header: 'Score',
        size: 70,
        cell: ({ row }) => {
          const score = row.original.properties?.overall_experience as number | undefined;
          return score != null ? (
            <span className="num" style={{ fontWeight: 600, color: scoreColor(score) }}>
              {score}/10
            </span>
          ) : (
            <span className="num">—</span>
          );
        },
      },
      {
        id: 'createdAt',
        header: 'Created',
        size: 150,
        cell: ({ row }) => (
          <span className="num">{new Date(row.original.createdAt).toLocaleString()}</span>
        ),
      },
    ],
    [],
  );

  return (
    <div className="page wide">
      <div className="page-head--console">
        <h1>
          <em className="italic-teal">Reports</em>
          <span className="head-count" title="Total runs in range">
            {ov ? formatCount(ov.total) : '—'} runs
          </span>
        </h1>
        <span className="status-line">
          {(ov?.byState.running ?? 0) > 0 && (
            <>
              <span className="dot pulse" /> {ov!.byState.running} running ·{' '}
            </>
          )}
          last {range.label}
        </span>
      </div>

      <div style={{ marginBottom: 12 }}>
        <ProjectFilter placeholder="Filter by project…" />
      </div>

      {/* ── Scope bar: range + active drill chips ── */}
      <div className="scope-bar">
        <Tabs
          variant="segmented"
          value={rangeKey}
          onChange={(v) => setParam('range', v === '7d' ? undefined : v)}
          options={Object.entries(RANGES).map(([key, r]) => ({ value: key, label: r.label }))}
        />
        <div className="scope-chips">
          {state && (
            <button className="chip-btn selected" onClick={() => setParam('state', undefined)}>
              state: {state} ×
            </button>
          )}
          {suiteId && (
            <button
              className="chip-btn selected"
              onClick={() => setParam('suite', undefined, { suiteLabel: undefined })}
            >
              suite: {suiteLabel || suiteId.slice(0, 8)} ×
            </button>
          )}
          {environment && (
            <button className="chip-btn selected" onClick={() => setParam('env', undefined)}>
              env: {environment} ×
            </button>
          )}
          {hasDrill && (
            <button
              className="chip-btn"
              onClick={() =>
                setParam('state', undefined, { suite: undefined, suiteLabel: undefined, env: undefined })
              }
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* ── Dial row ── */}
      <div className="dial-row stagger" style={{ marginBottom: 16 }}>
        <StatTile
          label="Runs"
          value={ov?.total.value ?? null}
          approx={ov?.total.isEstimate}
          delta={`last ${range.label}`}
        />
        <StatTile label="Pass rate" display={passRatePct ?? '—'} />
        <StatTile
          label="Failed"
          value={ov?.byState.failed ?? null}
          delta={ov ? `${ov.byState.errored} errored` : undefined}
          deltaDir={ov && ov.byState.failed > 0 ? 'down' : undefined}
          sparkColor="var(--viz-fail)"
        />
        <StatTile
          label="Active"
          value={ov ? ov.byState.running + ov.byState.queued : null}
          live={(ov?.byState.running ?? 0) > 0}
          delta={ov ? `${ov.byState.queued} queued` : undefined}
        />
        <StatTile label="Avg duration" display={formatDurationMs(ov?.avgDurationMs)} />
      </div>

      {/* ── Aggregate canvas ── */}
      <div
        className="stagger"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: 14,
          marginBottom: 18,
        }}
      >
        <Panel
          title="Executions over time"
          error={timeseries.isError}
          onRetry={() => timeseries.refetch()}
        >
          {timeseries.isLoading ? (
            <div className="skel" style={{ height: 180 }} />
          ) : (
            <TimeSeries points={timeseries.data?.points ?? []} bucket={range.bucket} height={180} />
          )}
        </Panel>
        <Panel title="By state" error={byState.isError} onRetry={() => byState.refetch()}>
          {byState.isLoading ? (
            <div className="skel" style={{ height: 60 }} />
          ) : (
            <StackedBar
              segments={stateSegments}
              activeKey={state || null}
              onSegmentClick={(segment) =>
                setParam('state', state === segment.key ? undefined : segment.key)
              }
            />
          )}
        </Panel>
        <Panel title="By suite" error={bySuite.isError} onRetry={() => bySuite.refetch()}>
          {bySuite.isLoading ? (
            <div className="skel" style={{ height: 140 }} />
          ) : (
            <BreakdownBar
              rows={bySuite.data?.rows ?? []}
              activeKey={suiteId || null}
              onRowClick={(row) =>
                setParam('suite', suiteId === row.key ? undefined : row.key, {
                  suiteLabel: suiteId === row.key ? undefined : row.label,
                })
              }
            />
          )}
        </Panel>
        <Panel title="By environment" error={byEnv.isError} onRetry={() => byEnv.refetch()}>
          {byEnv.isLoading ? (
            <div className="skel" style={{ height: 140 }} />
          ) : (
            <BreakdownBar
              rows={byEnv.data?.rows ?? []}
              activeKey={environment || null}
              onRowClick={(row) =>
                setParam('env', environment === row.key ? undefined : row.key)
              }
            />
          )}
        </Panel>
      </div>

      {/* ── Run list: only after a drill-down slice is selected ── */}
      {!hasDrill ? (
        <div className="panel">
          <div className="empty--inline" style={{ minHeight: 140 }}>
            <span className="microlabel">Select a slice</span>
            <div className="sub">
              Drill into a state, suite or environment above to inspect individual runs —{' '}
              {ov ? formatCount(ov.total) : '—'} in range.
            </div>
          </div>
        </div>
      ) : (
        <DataTable<TestRunListRow>
          columns={columns}
          data={runs.rows}
          getRowId={(row) => row.id}
          totalCount={runs.totalCount}
          hasNextPage={runs.hasNextPage}
          isFetchingNextPage={runs.isFetchingNextPage}
          fetchNextPage={() => runs.fetchNextPage()}
          isLoading={runs.isLoading}
          onRowClick={(row) => navigate(`/reporting/${row.projectId}/${row.id}`)}
          height="calc(100vh - 280px)"
        />
      )}
    </div>
  );
}
