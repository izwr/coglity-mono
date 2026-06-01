import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHead } from '../components/ui/PageHead';
import { Chip, type ChipVariant } from '../components/ui/Chip';
import { Tabs } from '../components/ui/Tabs';
import { Pagination } from '../components/Pagination';
import { useSetBreadcrumbs } from '../context/BreadcrumbsContext';
import { testRunService, type TestRunWithUser } from '../services/testRunService';
import { ProjectFilter, useSelectedProjectIds } from '../components/ProjectFilter';
import { useCurrentOrg } from '../context/OrgContext';

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

const PAGE_SIZE = 20;

export function Reporting() {
  useSetBreadcrumbs([{ label: 'Reports' }]);
  const navigate = useNavigate();
  const { org } = useCurrentOrg();
  const projectIds = useSelectedProjectIds();
  const [runs, setRuns] = useState<TestRunWithUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  const fetchRuns = useCallback(async () => {
    if (!org || projectIds.length === 0) {
      setRuns([]);
      setTotal(0);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await testRunService.listAll(org.organizationId, projectIds, {
        state: filter || undefined,
        limit: PAGE_SIZE,
        page,
      });
      setRuns(res.data);
      setTotal(res.total);
    } catch {
      setRuns([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [org, projectIds, filter, page]);

  useEffect(() => {
    fetchRuns();
  }, [fetchRuns]);

  useEffect(() => {
    setPage(1);
  }, [filter, projectIds]);

  const terminalRuns = runs.filter((r) => ['passed', 'failed', 'errored'].includes(r.state));
  const passed = terminalRuns.filter((r) => r.state === 'passed').length;
  const passRate = terminalRuns.length > 0 ? Math.round((passed / terminalRuns.length) * 100) : 0;
  const pageCount = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="page wide">
      <PageHead
        title={
          <>
            <em className="italic-teal">Reports</em>
          </>
        }
        subtitle="Voice test run results, metrics, and quality scores."
      />

      <div style={{ marginBottom: 16 }}>
        <ProjectFilter placeholder="Filter by project…" />
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 16,
          marginBottom: 20,
        }}
      >
        {[
          { label: 'Total runs', value: total },
          { label: 'Passed', value: passed },
          { label: 'Failed', value: terminalRuns.filter((r) => r.state === 'failed').length },
          { label: 'Pass rate', value: `${passRate}%` },
        ].map((s) => (
          <div key={s.label} className="card stat">
            <div className="label">{s.label}</div>
            <div className="value">{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{ marginBottom: 16 }}>
        <Tabs
          variant="chip"
          value={filter || 'all'}
          onChange={(v) => setFilter(v === 'all' ? '' : v)}
          options={[
            { value: 'all', label: 'All', chipVariant: 'teal' },
            { value: 'passed', label: 'Passed', chipVariant: 'pass' },
            { value: 'failed', label: 'Failed', chipVariant: 'fail' },
            { value: 'errored', label: 'Errored', chipVariant: 'warn' },
          ]}
        />
      </div>

      {loading ? (
        <p className="ts-empty">Loading…</p>
      ) : runs.length === 0 ? (
        <div className="empty">
          <div className="title">
            No <em className="italic-teal">reports</em> yet.
          </div>
          <div className="sub">Run a voice test case to generate a report.</div>
        </div>
      ) : (
        <>
          <div className="card" style={{ overflow: 'hidden' }}>
            <table className="t">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Test case</th>
                  <th>Language</th>
                  <th>Environment</th>
                  <th>Turns</th>
                  <th>Duration</th>
                  <th>Score</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => {
                  const chip = STATE_CHIP[run.state] ?? STATE_CHIP.queued;
                  const props = (run.properties ?? {}) as Record<string, string | number>;
                  return (
                    <tr
                      key={run.id}
                      style={{ cursor: 'pointer' }}
                      onClick={() => navigate(`/reporting/${run.projectId}/${run.id}`)}
                    >
                      <td>
                        <Chip variant={chip.variant} dot>
                          {chip.label}
                        </Chip>
                      </td>
                      <td>
                        <div style={{ fontWeight: 500 }}>
                          {run.testCaseTitle ?? run.testCaseId.slice(0, 8)}
                        </div>
                        {run.createdByName && (
                          <div className="muted" style={{ fontSize: 11.5 }}>
                            {run.createdByName}
                          </div>
                        )}
                      </td>
                      <td className="mono" style={{ fontSize: 12 }}>
                        {run.language ?? '—'}
                      </td>
                      <td className="mono" style={{ fontSize: 12 }}>
                        {run.environment ?? '—'}
                      </td>
                      <td className="mono">{props.total_turns ?? '—'}</td>
                      <td className="mono">
                        {props.total_duration_ms != null
                          ? `${((props.total_duration_ms as number) / 1000).toFixed(1)}s`
                          : '—'}
                      </td>
                      <td>
                        {props.overall_experience != null ? (
                          <span
                            className="mono"
                            style={{
                              fontWeight: 600,
                              color: scoreColor(props.overall_experience as number),
                            }}
                          >
                            {props.overall_experience}/10
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="muted" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                        {new Date(run.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: 16 }}>
            <Pagination page={page} pageCount={pageCount} onPageChange={setPage} />
          </div>
        </>
      )}
    </div>
  );
}
