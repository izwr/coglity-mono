import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { TimeseriesBucket } from '@coglity/shared';
import { useAuth } from '../context/AuthContext';
import { Chip, type ChipVariant } from '../components/ui/Chip';
import { Button } from '../components/ui/Button';
import { Tabs } from '../components/ui/Tabs';
import { StatTile } from '../components/ui/StatTile';
import { TimeSeries } from '../components/viz/TimeSeries';
import { Heatmap } from '../components/viz/Heatmap';
import { useSetBreadcrumbs } from '../context/BreadcrumbsContext';
import { testCaseService } from '../services/testCaseService';
import { bugService } from '../services/bugService';
import { botConnectionService } from '../services/botConnectionService';
import { useCurrentOrg } from '../context/OrgContext';
import { useRunsOverview, useRunsTimeseries, useRunsHeatmap } from '../queries/stats';
import { useTestRunsInfinite } from '../queries/testRuns';
import { queryKeys } from '../lib/queryKeys';
import { formatRelative } from '../lib/format';

function greeting(hour: number) {
  if (hour < 5) return 'Good evening';
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

const TS_RANGES = {
  '24h': { ms: 24 * 3_600_000, bucket: 'hour' as TimeseriesBucket },
  '7d': { ms: 7 * 86_400_000, bucket: 'day' as TimeseriesBucket },
  '30d': { ms: 30 * 86_400_000, bucket: 'day' as TimeseriesBucket },
};
type TsRange = keyof typeof TS_RANGES;

export function Dashboard() {
  const { user } = useAuth();
  const { org } = useCurrentOrg();
  const navigate = useNavigate();
  useSetBreadcrumbs([{ label: 'Dashboard' }]);

  const orgId = org?.organizationId ?? '';
  const projectIds = useMemo(
    () => (org?.projects ?? []).map((p) => p.projectId),
    [org?.projects],
  );

  const [tsRange, setTsRange] = useState<TsRange>('7d');

  // Time anchors are memoized so query keys stay stable across renders.
  const from24h = useMemo(() => new Date(Date.now() - TS_RANGES['24h'].ms).toISOString(), []);
  const from7d = useMemo(() => new Date(Date.now() - TS_RANGES['7d'].ms).toISOString(), []);
  const tsFrom = useMemo(
    () => new Date(Date.now() - TS_RANGES[tsRange].ms).toISOString(),
    [tsRange],
  );

  // Dials — counts come from cursor-list first pages (estimated when large)
  // and the stats overview, never from client-side math over a page of rows.
  const caseCount = useQuery({
    queryKey: queryKeys.testCases.list(orgId, { projectIds, countOnly: true }),
    queryFn: () => testCaseService.listCursor(orgId, projectIds, { limit: 1 }),
    enabled: Boolean(orgId) && projectIds.length > 0,
    select: (page) => page.totalCount,
  });
  const bugCount = useQuery({
    queryKey: ['orgs', orgId, 'bugs', 'count', { projectIds: [...projectIds].sort() }],
    queryFn: () => bugService.getAll(orgId, projectIds, { limit: 1, page: 1 }),
    enabled: Boolean(orgId) && projectIds.length > 0,
    select: (r) => r.total,
  });
  const overview24h = useRunsOverview(orgId, projectIds, { from: from24h });
  const overview7d = useRunsOverview(orgId, projectIds, { from: from7d });
  const timeseries = useRunsTimeseries(orgId, projectIds, TS_RANGES[tsRange].bucket, {
    from: tsFrom,
  });
  const heatmap = useRunsHeatmap(orgId, projectIds, { days: 14, limit: 8 });
  const recentFailures = useTestRunsInfinite(orgId, projectIds, { state: 'failed', limit: 8 });
  const bots = useQuery({
    queryKey: ['orgs', orgId, 'bot-connections', 'top', { projectIds: [...projectIds].sort() }],
    queryFn: () => botConnectionService.getAll(orgId, projectIds, { limit: 5, page: 1 }),
    enabled: Boolean(orgId) && projectIds.length > 0,
    select: (r) => r.data,
  });

  const firstName = user?.displayName?.split(' ')[0] ?? 'there';
  const ov24 = overview24h.data;
  const ov7 = overview7d.data;
  const running = ov24?.byState.running ?? 0;
  const lastFailure = recentFailures.rows[0]?.createdAt;
  const passRate7d = ov7?.passRate != null ? `${Math.round(ov7.passRate * 100)}%` : '—';
  const sparkFromTs = (timeseries.data?.points ?? []).map((p) => p.total);

  return (
    <div className="page wide">
      <div className="page-head--console">
        <h1>
          {greeting(new Date().getHours())}, <em className="italic-teal">{firstName}</em>.
        </h1>
        <span className="status-line">
          {running > 0 && (
            <>
              <span className="dot pulse" />
              {running} running ·{' '}
            </>
          )}
          {lastFailure ? `last failure ${formatRelative(lastFailure)}` : 'no recent failures'}
        </span>
      </div>

      <div className="row gap-lg" style={{ marginBottom: 18 }}>
        <Button variant="teal" onClick={() => navigate('/test-cases/generate')}>
          <svg className="ico" viewBox="0 0 24 24">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
          Ask Coglity
        </Button>
        <Button onClick={() => navigate('/test-cases')}>
          <svg className="ico" viewBox="0 0 24 24">
            <path d="M12 5v14M5 12h14" />
          </svg>
          New test case
        </Button>
        <Button variant="primary" onClick={() => navigate('/scheduled-test-suites')}>
          <svg className="ico" viewBox="0 0 24 24">
            <path d="M5 3l14 9-14 9V3z" />
          </svg>
          Run suite
        </Button>
      </div>

      {/* ── Dial row ── */}
      <div className="dial-row stagger" style={{ marginBottom: 16 }}>
        <StatTile
          label="Test cases"
          value={caseCount.data?.value ?? null}
          approx={caseCount.data?.isEstimate}
          delta="across projects"
        />
        <StatTile
          label="Executions 24h"
          value={ov24?.total.value ?? null}
          approx={ov24?.total.isEstimate}
          delta={ov24 ? `${ov24.byState.failed} failed` : undefined}
          deltaDir={ov24 && ov24.byState.failed > 0 ? 'down' : undefined}
        />
        <StatTile
          label="Pass rate 7d"
          display={passRate7d}
          delta={ov7 ? `${ov7.byState.passed} passed` : undefined}
          deltaDir="up"
          spark={sparkFromTs.length > 1 ? sparkFromTs : undefined}
        />
        <StatTile
          label="Active runs"
          value={ov24 ? ov24.byState.running + ov24.byState.queued : null}
          live={running > 0}
          delta={ov24 ? `${ov24.byState.queued} queued` : undefined}
          onClick={() => navigate('/reporting')}
        />
        <StatTile
          label="Open bugs"
          value={bugCount.data ?? null}
          delta="tracker"
          onClick={() => navigate('/bugs')}
        />
      </div>

      {/* ── Main split: telemetry | density + failures ── */}
      <div
        className="stagger"
        style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 14, alignItems: 'start' }}
      >
        <div className="col" style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
          <div className="panel">
            <div className="panel-head">
              <span className="microlabel">Executions over time</span>
              <Tabs
                variant="segmented"
                size="sm"
                value={tsRange}
                onChange={(v) => setTsRange(v as TsRange)}
                options={Object.keys(TS_RANGES).map((key) => ({ value: key, label: key }))}
              />
            </div>
            <div className="panel-body">
              {timeseries.isLoading ? (
                <div className="skel" style={{ height: 200 }} />
              ) : (
                <TimeSeries
                  points={timeseries.data?.points ?? []}
                  bucket={TS_RANGES[tsRange].bucket}
                  height={200}
                />
              )}
            </div>
          </div>

          <div className="panel">
            <div className="panel-head">
              <span className="microlabel">Recent failures</span>
              <Button variant="ghost" size="sm" onClick={() => navigate('/reporting?state=failed')}>
                Open reports
              </Button>
            </div>
            <div>
              {recentFailures.isLoading ? (
                <div className="panel-body">
                  <div className="skel" style={{ height: 120 }} />
                </div>
              ) : recentFailures.rows.length === 0 ? (
                <div className="empty--inline" style={{ minHeight: 100 }}>
                  <span className="microlabel plain">All clear</span>
                  <div className="sub">No failed runs across your projects.</div>
                </div>
              ) : (
                recentFailures.rows.slice(0, 8).map((run) => (
                  <button
                    key={run.id}
                    type="button"
                    onClick={() => navigate(`/reporting/${run.projectId}/${run.id}`)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      width: '100%',
                      textAlign: 'left',
                      padding: '0 16px',
                      height: 'var(--row-h)',
                      borderTop: '1px solid var(--hairline)',
                      cursor: 'pointer',
                      fontSize: 'var(--fs-cell)',
                    }}
                  >
                    <Chip variant="fail" size="sm" dot>
                      failed
                    </Chip>
                    <span
                      style={{
                        color: 'var(--ink)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        minWidth: 0,
                        flex: 1,
                      }}
                    >
                      {run.testCaseTitle ?? run.testCaseId.slice(0, 8)}
                    </span>
                    <span className="num">{run.environment}</span>
                    <span className="num" style={{ color: 'var(--muted-2)' }}>
                      {formatRelative(run.createdAt)}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="col" style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
          <div className="panel">
            <div className="panel-head">
              <span className="microlabel">Failure density · 14d</span>
              <span className="heat-legend" title="failures per suite per day">
                {[1, 2, 3, 4, 5].map((b) => (
                  <i key={b} style={{ background: `var(--heat-${b})` }} />
                ))}
              </span>
            </div>
            <div className="panel-body">
              {heatmap.isLoading ? (
                <div className="skel" style={{ height: 140 }} />
              ) : (
                <Heatmap
                  rows={(heatmap.data?.rows ?? []).map((r) => ({ id: r.suiteId, label: r.suiteName }))}
                  cols={(heatmap.data?.cols ?? []).map((c) =>
                    new Date(c).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
                  )}
                  values={(heatmap.data?.rows ?? []).map((r) => r.cells)}
                  onCellClick={(suiteId) => {
                    const suite = heatmap.data?.rows.find((r) => r.suiteId === suiteId);
                    navigate(
                      `/reporting?suite=${suiteId}&suiteLabel=${encodeURIComponent(suite?.suiteName ?? '')}&state=failed`,
                    );
                  }}
                />
              )}
            </div>
          </div>

          <div className="panel">
            <div className="panel-head">
              <span className="microlabel">Systems under test</span>
              <Button variant="ghost" size="sm" onClick={() => navigate('/bot-connections')}>
                Manage
              </Button>
            </div>
            <div className="panel-body" style={{ paddingTop: 6 }}>
              {(bots.data ?? []).length === 0 ? (
                <div className="muted" style={{ fontSize: 13 }}>
                  No bots connected yet.
                </div>
              ) : (
                (bots.data ?? []).map((b) => (
                  <div
                    key={b.id}
                    className="row"
                    style={{ padding: '8px 0', borderBottom: '1px solid var(--hairline)' }}
                  >
                    <Chip variant={(b.botType as ChipVariant) || 'neutral'} size="sm" dot pulse>
                      {b.botType}
                    </Chip>
                    <div
                      style={{
                        fontSize: 13,
                        color: 'var(--ink)',
                        minWidth: 0,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {b.name}
                    </div>
                    <span className="num" style={{ marginLeft: 'auto' }}>
                      {b.provider}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
