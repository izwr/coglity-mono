import { useEffect, useState, useCallback } from "react";
import { PageHead } from "../components/ui/PageHead";
import { Chip, type ChipVariant } from "../components/ui/Chip";
import { Button } from "../components/ui/Button";
import { Tabs } from "../components/ui/Tabs";
import { useSetBreadcrumbs } from "../context/BreadcrumbsContext";
import { testRunService, type TestRunWithUser } from "../services/testRunService";
import { ProjectFilter, useSelectedProjectIds } from "../components/ProjectFilter";
import { useCurrentOrg } from "../context/OrgContext";

const STATE_CHIP: Record<string, { variant: ChipVariant; label: string }> = {
  passed: { variant: "pass", label: "Passed" },
  failed: { variant: "fail", label: "Failed" },
  errored: { variant: "warn", label: "Errored" },
  running: { variant: "teal", label: "Running" },
  queued: { variant: "info", label: "Queued" },
  cancelled: { variant: "neutral", label: "Cancelled" },
};

const RULE_METRICS = [
  { key: "total_duration_ms", label: "Duration", fmt: (v: number) => `${(v / 1000).toFixed(1)}s` },
  { key: "total_turns", label: "Turns", fmt: (v: number) => String(v) },
  { key: "avg_bot_latency_ms", label: "Avg bot latency", fmt: (v: number) => `${v}ms` },
  { key: "avg_tester_pipeline_ms", label: "Avg tester pipeline", fmt: (v: number) => `${v}ms` },
  { key: "avg_bot_speaking_rate_wps", label: "Bot WPS", fmt: (v: number) => `${v}` },
  { key: "silence_percentage", label: "Silence %", fmt: (v: number) => `${v}%` },
];

const LLM_METRICS = [
  "greeting_quality", "comprehension", "accuracy", "helpfulness",
  "tone_professionalism", "task_completion", "error_handling",
  "response_coherence", "conversation_flow", "overall_experience",
];

function scoreColor(score: number): string {
  if (score >= 8) return "var(--green)";
  if (score >= 6) return "#84CC16";
  if (score >= 4) return "var(--amber)";
  return "var(--red)";
}

export function Reporting() {
  useSetBreadcrumbs([{ label: "Reports" }]);
  const { org } = useCurrentOrg();
  const projectIds = useSelectedProjectIds();
  const [runs, setRuns] = useState<TestRunWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchRuns = useCallback(async () => {
    if (!org || projectIds.length === 0) { setRuns([]); setLoading(false); return; }
    setLoading(true);
    try {
      const { data } = await testRunService.listAll(org.organizationId, projectIds, { state: filter || undefined, limit: 50 });
      setRuns(data);
    } catch { setRuns([]); }
    finally { setLoading(false); }
  }, [org, projectIds, filter]);

  useEffect(() => { fetchRuns(); }, [fetchRuns]);

  const terminalRuns = runs.filter((r) => ["passed", "failed", "errored"].includes(r.state));
  const passed = terminalRuns.filter((r) => r.state === "passed").length;
  const passRate = terminalRuns.length > 0 ? Math.round((passed / terminalRuns.length) * 100) : 0;

  return (
    <div className="page wide">
      <PageHead
        title={<><em className="italic-teal">Reports</em></>}
        subtitle="Voice test run results, metrics, and quality scores."
      />

      <div style={{ marginBottom: 16 }}>
        <ProjectFilter placeholder="Filter by project…" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 20 }}>
        {[
          { label: "Total runs", value: runs.length },
          { label: "Passed", value: passed },
          { label: "Failed", value: terminalRuns.filter((r) => r.state === "failed").length },
          { label: "Pass rate", value: `${passRate}%` },
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
          value={filter || "all"}
          onChange={(v) => setFilter(v === "all" ? "" : v)}
          options={[
            { value: "all", label: "All", chipVariant: "teal" },
            { value: "passed", label: "Passed", chipVariant: "pass" },
            { value: "failed", label: "Failed", chipVariant: "fail" },
            { value: "errored", label: "Errored", chipVariant: "warn" },
          ]}
        />
      </div>

      {loading ? (
        <p className="ts-empty">Loading…</p>
      ) : runs.length === 0 ? (
        <div className="empty">
          <div className="title">No <em className="italic-teal">reports</em> yet.</div>
          <div className="sub">Run a voice test case to generate a report.</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {runs.map((run) => {
            const chip = STATE_CHIP[run.state] ?? STATE_CHIP.queued;
            const props = (run.properties ?? {}) as Record<string, string | number>;
            const expanded = expandedId === run.id;

            return (
              <div key={run.id} className="card" style={{ overflow: "hidden" }}>
                <button
                  type="button"
                  onClick={() => setExpandedId(expanded ? null : run.id)}
                  style={{
                    display: "flex", alignItems: "center", gap: 12, padding: "14px 16px",
                    width: "100%", border: "none", background: "none", cursor: "pointer", textAlign: "left",
                  }}
                >
                  <Chip variant={chip.variant} dot>{chip.label}</Chip>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: "var(--ink)" }}>
                      {run.testCaseTitle ?? run.testCaseId.slice(0, 8)}
                    </div>
                    <div className="muted" style={{ fontSize: 11.5, marginTop: 2 }}>
                      {new Date(run.createdAt).toLocaleString()}
                      {run.createdByName && ` · ${run.createdByName}`}
                    </div>
                  </div>
                  {props.total_turns != null && (
                    <span className="mono muted" style={{ fontSize: 11.5 }}>{props.total_turns} turns</span>
                  )}
                  {props.total_duration_ms != null && (
                    <span className="mono muted" style={{ fontSize: 11.5 }}>{((props.total_duration_ms as number) / 1000).toFixed(1)}s</span>
                  )}
                  {props.overall_experience != null && (
                    <span className="mono" style={{ fontSize: 11.5, color: scoreColor(props.overall_experience as number) }}>
                      {props.overall_experience}/10
                    </span>
                  )}
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: expanded ? "rotate(180deg)" : undefined, transition: "transform 0.15s" }}>
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>

                {expanded && (
                  <div style={{ padding: "0 16px 16px", borderTop: "1px solid var(--line)" }}>
                    {run.verdict && (
                      <div style={{ padding: "10px 12px", borderRadius: 8, background: "var(--bg-2)", border: "1px solid var(--line)", margin: "12px 0", fontSize: 13 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", marginBottom: 4 }}>Verdict</div>
                        <div style={{ whiteSpace: "pre-wrap" }}>{run.verdict}</div>
                      </div>
                    )}

                    {/* Downloads */}
                    {org && (
                      <div style={{ display: "flex", gap: 8, margin: "12px 0" }}>
                        {run.recordingBlobName && (
                          <Button
                            variant="ghost" size="sm"
                            onClick={() => {
                              const url = testRunService.downloadRecordingUrl(org.organizationId, run.projectId, run.id);
                              window.open(url, "_blank");
                            }}
                          >
                            Download recording
                          </Button>
                        )}
                        {run.transcript.length > 0 && (
                          <Button
                            variant="ghost" size="sm"
                            onClick={() => {
                              const url = testRunService.downloadTranscriptUrl(org.organizationId, run.projectId, run.id);
                              window.open(url, "_blank");
                            }}
                          >
                            Download transcript
                          </Button>
                        )}
                      </div>
                    )}

                    {/* Rule-based metrics */}
                    {Object.keys(props).length > 0 && (
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", marginBottom: 8 }}>Performance metrics</div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                          {RULE_METRICS.map((m) => {
                            const val = props[m.key];
                            if (val == null) return null;
                            return (
                              <div key={m.key} style={{ padding: "6px 10px", border: "1px solid var(--line)", borderRadius: 8, background: "var(--bg-1)" }}>
                                <div className="muted" style={{ fontSize: 10.5 }}>{m.label}</div>
                                <div className="mono" style={{ fontSize: 14, fontWeight: 600 }}>{m.fmt(val as number)}</div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* LLM quality scores */}
                    {LLM_METRICS.some((k) => props[k] != null) && (
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", marginBottom: 8 }}>Quality scores (AI evaluated)</div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6 }}>
                          {LLM_METRICS.map((key) => {
                            const val = props[key];
                            if (val == null) return null;
                            const score = Number(val);
                            const label = key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
                            return (
                              <div key={key} style={{ padding: "8px 10px", border: "1px solid var(--line)", borderRadius: 8, background: "var(--bg-1)", textAlign: "center" }}>
                                <div style={{ fontSize: 20, fontWeight: 700, fontFamily: "var(--serif)", color: scoreColor(score) }}>{score}</div>
                                <div className="muted" style={{ fontSize: 10, marginTop: 2 }}>{label}</div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Transcript */}
                    {run.transcript.length > 0 && (
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", marginBottom: 8 }}>Transcript</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 300, overflowY: "auto" }}>
                          {run.transcript.map((turn, i) => (
                            <div
                              key={i}
                              style={{
                                alignSelf: turn.role === "tester" ? "flex-end" : "flex-start",
                                maxWidth: "80%", background: turn.role === "tester" ? "var(--teal-bg)" : "var(--bg-2)",
                                color: "var(--ink)", border: "1px solid var(--line)", borderRadius: 10,
                                padding: "6px 10px", fontSize: 12.5,
                              }}
                            >
                              <div style={{ fontSize: 10, fontWeight: 600, color: "var(--muted)", marginBottom: 2 }}>
                                {turn.role === "tester" ? "Tester" : "Bot"}
                              </div>
                              {turn.text}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {run.error && (
                      <div style={{ padding: "8px 12px", borderRadius: 8, background: "var(--red-bg)", color: "var(--red)", marginTop: 12, fontSize: 12 }}>
                        {run.error}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
