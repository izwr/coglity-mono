import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PageHead } from '../components/ui/PageHead';
import { Chip, type ChipVariant } from '../components/ui/Chip';
import { Button } from '../components/ui/Button';
import { useSetBreadcrumbs } from '../context/BreadcrumbsContext';
import { testRunService, type TestRunWithUser } from '../services/testRunService';
import { useCurrentOrg } from '../context/OrgContext';

const STATE_CHIP: Record<string, { variant: ChipVariant; label: string }> = {
  passed: { variant: 'pass', label: 'Passed' },
  failed: { variant: 'fail', label: 'Failed' },
  errored: { variant: 'warn', label: 'Errored' },
  running: { variant: 'teal', label: 'Running' },
  queued: { variant: 'info', label: 'Queued' },
  cancelled: { variant: 'neutral', label: 'Cancelled' },
};

const RULE_METRICS = [
  { key: 'total_duration_ms', label: 'Duration', fmt: (v: number) => `${(v / 1000).toFixed(1)}s` },
  { key: 'total_turns', label: 'Turns', fmt: (v: number) => String(v) },
  { key: 'avg_bot_latency_ms', label: 'Avg bot latency', fmt: (v: number) => `${v}ms` },
  { key: 'avg_tester_pipeline_ms', label: 'Avg tester pipeline', fmt: (v: number) => `${v}ms` },
  { key: 'avg_bot_speaking_rate_wps', label: 'Bot WPS', fmt: (v: number) => `${v}` },
  { key: 'silence_percentage', label: 'Silence %', fmt: (v: number) => `${v}%` },
];

const LLM_METRICS = [
  'greeting_quality',
  'comprehension',
  'accuracy',
  'helpfulness',
  'tone_professionalism',
  'task_completion',
  'error_handling',
  'response_coherence',
  'conversation_flow',
  'overall_experience',
];

function scoreColor(score: number): string {
  if (score >= 8) return 'var(--green)';
  if (score >= 6) return '#84CC16';
  if (score >= 4) return 'var(--amber)';
  return 'var(--red)';
}

function RunCard({
  run,
  orgId,
  isBatchSibling,
}: {
  run: TestRunWithUser;
  orgId: string;
  isBatchSibling?: boolean;
}) {
  const chip = STATE_CHIP[run.state] ?? STATE_CHIP.queued;
  const props = (run.properties ?? {}) as Record<string, string | number>;

  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <Chip variant={chip.variant} dot>
          {chip.label}
        </Chip>
        <div style={{ flex: 1 }}>
          {isBatchSibling && (
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)' }}>
              {run.language ?? 'en-US'} · {run.environment ?? 'quiet'}
            </div>
          )}
          <div className="muted" style={{ fontSize: 11.5, marginTop: isBatchSibling ? 2 : 0 }}>
            {new Date(run.createdAt).toLocaleString()}
            {run.createdByName && ` · ${run.createdByName}`}
          </div>
        </div>
        {props.overall_experience != null && (
          <span
            className="mono"
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: scoreColor(props.overall_experience as number),
            }}
          >
            {props.overall_experience}/10
          </span>
        )}
      </div>

      <div style={{ padding: '0 16px 16px', borderTop: '1px solid var(--line)' }}>
        {/* Verdict */}
        {run.verdict && (
          <div
            style={{
              padding: '10px 12px',
              borderRadius: 8,
              background: 'var(--bg-2)',
              border: '1px solid var(--line)',
              margin: '12px 0',
              fontSize: 13,
            }}
          >
            <div
              style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 4 }}
            >
              Verdict
            </div>
            <div style={{ whiteSpace: 'pre-wrap' }}>{run.verdict}</div>
          </div>
        )}

        {/* Downloads */}
        <div style={{ display: 'flex', gap: 8, margin: '12px 0' }}>
          {run.recordingBlobName && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                const url = testRunService.downloadRecordingUrl(orgId, run.projectId, run.id);
                window.open(url, '_blank');
              }}
            >
              Download recording
            </Button>
          )}
          {run.transcript.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                const url = testRunService.downloadTranscriptUrl(orgId, run.projectId, run.id);
                window.open(url, '_blank');
              }}
            >
              Download transcript
            </Button>
          )}
        </div>

        {/* Rule-based metrics */}
        {Object.keys(props).length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div
              style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 8 }}
            >
              Performance metrics
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {RULE_METRICS.map((m) => {
                const val = props[m.key];
                if (val == null) return null;
                return (
                  <div
                    key={m.key}
                    style={{
                      padding: '6px 10px',
                      border: '1px solid var(--line)',
                      borderRadius: 8,
                      background: 'var(--bg-1)',
                    }}
                  >
                    <div className="muted" style={{ fontSize: 10.5 }}>
                      {m.label}
                    </div>
                    <div className="mono" style={{ fontSize: 14, fontWeight: 600 }}>
                      {m.fmt(val as number)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* LLM quality scores */}
        {LLM_METRICS.some((k) => props[k] != null) && (
          <div style={{ marginBottom: 12 }}>
            <div
              style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 8 }}
            >
              Quality scores (AI evaluated)
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
              {LLM_METRICS.map((key) => {
                const val = props[key];
                if (val == null) return null;
                const score = Number(val);
                const label = key
                  .replace(/_/g, ' ')
                  .replace(/\b\w/g, (c) => c.toUpperCase());
                return (
                  <div
                    key={key}
                    style={{
                      padding: '8px 10px',
                      border: '1px solid var(--line)',
                      borderRadius: 8,
                      background: 'var(--bg-1)',
                      textAlign: 'center',
                    }}
                  >
                    <div
                      style={{
                        fontSize: 20,
                        fontWeight: 700,
                        fontFamily: 'var(--serif)',
                        color: scoreColor(score),
                      }}
                    >
                      {score}
                    </div>
                    <div className="muted" style={{ fontSize: 10, marginTop: 2 }}>
                      {label}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Transcript */}
        {run.transcript.length > 0 && (
          <div>
            <div
              style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 8 }}
            >
              Transcript
            </div>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                maxHeight: 300,
                overflowY: 'auto',
              }}
            >
              {run.transcript.map((turn, i) => (
                <div
                  key={i}
                  style={{
                    alignSelf: turn.role === 'tester' ? 'flex-end' : 'flex-start',
                    maxWidth: '80%',
                    background: turn.role === 'tester' ? 'var(--teal-bg)' : 'var(--bg-2)',
                    color: 'var(--ink)',
                    border: '1px solid var(--line)',
                    borderRadius: 10,
                    padding: '6px 10px',
                    fontSize: 12.5,
                  }}
                >
                  <div
                    style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', marginBottom: 2 }}
                  >
                    {turn.role === 'tester' ? 'Tester' : 'Bot'}
                  </div>
                  {turn.text}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Error */}
        {run.error && (
          <div
            style={{
              padding: '8px 12px',
              borderRadius: 8,
              background: 'var(--red-bg)',
              color: 'var(--red)',
              marginTop: 12,
              fontSize: 12,
            }}
          >
            {run.error}
          </div>
        )}
      </div>
    </div>
  );
}

export function ReportDetail() {
  const { id, projectId } = useParams<{ id: string; projectId: string }>();
  const navigate = useNavigate();
  const { org } = useCurrentOrg();
  useSetBreadcrumbs([{ label: 'Reports', to: '/reporting' }, { label: 'Run detail' }]);

  const [run, setRun] = useState<TestRunWithUser | null>(null);
  const [batchRuns, setBatchRuns] = useState<TestRunWithUser[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRun = useCallback(async () => {
    if (!org || !projectId || !id) return;
    setLoading(true);
    try {
      const data = await testRunService.getById(org.organizationId, projectId, id);
      setRun(data);

      if (data.batchId) {
        const siblings = await testRunService.listByBatch(org.organizationId, projectId, data.batchId);
        setBatchRuns(siblings);
      } else {
        setBatchRuns([]);
      }
    } catch {
      setRun(null);
    } finally {
      setLoading(false);
    }
  }, [org, projectId, id]);

  useEffect(() => {
    fetchRun();
  }, [fetchRun]);

  if (loading) return <p className="ts-empty">Loading…</p>;
  if (!run || !org) {
    return (
      <div className="page">
        <div className="empty">
          <div className="title">Run not found</div>
          <Button variant="ghost" onClick={() => navigate('/reporting')}>
            Back to reports
          </Button>
        </div>
      </div>
    );
  }

  const isBatch = batchRuns.length > 1;
  const batchPassed = batchRuns.filter((r) => r.state === 'passed').length;
  const batchFailed = batchRuns.filter((r) => r.state === 'failed').length;
  const batchErrored = batchRuns.filter((r) => r.state === 'errored').length;

  return (
    <div className="page wide">
      <PageHead
        title={
          <>
            <em className="italic-teal">{run.testCaseTitle ?? 'Test run'}</em>
          </>
        }
        subtitle={
          isBatch
            ? `Batch of ${batchRuns.length} runs · ${batchPassed} passed · ${batchFailed} failed${batchErrored ? ` · ${batchErrored} errored` : ''}`
            : `Single run · ${new Date(run.createdAt).toLocaleString()}`
        }
      />

      <div style={{ marginBottom: 16 }}>
        <Button variant="ghost" size="sm" onClick={() => navigate('/reporting')}>
          ← Back to reports
        </Button>
      </div>

      {isBatch ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {batchRuns.map((r) => (
            <RunCard key={r.id} run={r} orgId={org.organizationId} isBatchSibling />
          ))}
        </div>
      ) : (
        <RunCard run={run} orgId={org.organizationId} />
      )}
    </div>
  );
}
