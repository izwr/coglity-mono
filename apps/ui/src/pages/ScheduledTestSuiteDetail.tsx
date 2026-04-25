import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { scheduledTestSuiteService, type ScheduledTestSuiteDetail as SuiteDetail } from "../services/scheduledTestSuiteService";
import { Button } from "../components/ui/Button";
import { Chip, type ChipVariant } from "../components/ui/Chip";
import { Tabs } from "../components/ui/Tabs";
import { useSetBreadcrumbs } from "../context/BreadcrumbsContext";
import { useCurrentOrg } from "../context/OrgContext";

const STATE_LABELS: Record<string, string> = {
  not_started: "Not started",
  in_progress: "Running",
  passed: "Passed",
  failed: "Failed",
  blocked: "Blocked",
  skipped: "Skipped",
};

const STATE_CHIP: Record<string, ChipVariant> = {
  not_started: "neutral",
  in_progress: "run",
  passed: "pass",
  failed: "fail",
  blocked: "warn",
  skipped: "neutral",
};

type Filter = "all" | "failed" | "passed" | "running";

export function ScheduledTestSuiteDetail() {
  const { id, projectId } = useParams<{ id: string; projectId: string }>();
  const navigate = useNavigate();
  const { org } = useCurrentOrg();
  useSetBreadcrumbs([{ label: "Runs", to: "/scheduled-test-suites" }, { label: "Run detail" }]);

  const [suite, setSuite] = useState<SuiteDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);

  useEffect(() => {
    if (!id || !projectId || !org) return;
    scheduledTestSuiteService.getById(org.organizationId, projectId, id).then((d) => {
      setSuite(d);
      setSelectedCaseId(d.scheduledCases[0]?.id ?? null);
    }).catch(() => navigate("/scheduled-test-suites")).finally(() => setLoading(false));
  }, [id, projectId, org]);

  const fmtDate = (d: string) => new Date(d).toLocaleDateString();

  const cases = useMemo(() => {
    if (!suite) return [];
    return suite.scheduledCases.filter((sc) => {
      if (filter === "all") return true;
      if (filter === "failed") return sc.state === "failed" || sc.state === "blocked";
      if (filter === "passed") return sc.state === "passed";
      if (filter === "running") return sc.state === "in_progress";
      return true;
    });
  }, [suite, filter]);

  const selectedCase = suite?.scheduledCases.find((c) => c.id === selectedCaseId);

  if (loading) return <div className="page"><p className="ts-empty">Loading…</p></div>;
  if (!suite) return <div className="page"><p className="ts-empty">Not found.</p></div>;

  const pct = suite.caseCount > 0 ? Math.round((suite.passedCount / suite.caseCount) * 100) : 0;
  const failedPct = suite.caseCount > 0 ? Math.round((suite.failedCount / suite.caseCount) * 100) : 0;
  const runningCount = suite.scheduledCases.filter((c) => c.state === "in_progress").length;
  const runningPct = suite.caseCount > 0 ? Math.round((runningCount / suite.caseCount) * 100) : 0;
  const notStartedPct = 100 - pct - failedPct - runningPct;

  const status = runningCount > 0 ? "running" : suite.failedCount > 0 ? "failed" : suite.passedCount === suite.caseCount && suite.caseCount > 0 ? "passed" : "idle";

  return (
    <div className="page wide">
      <Button variant="ghost" className="tc-back-btn" onClick={() => navigate("/scheduled-test-suites")} style={{ marginBottom: 12 }}>
        <svg className="ico" width="14" height="14" viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6" /></svg>
        All runs
      </Button>

      <div className="page-head">
        <div className="page-head-text">
          <div className="row" style={{ marginBottom: 10 }}>
            {status === "running" && <Chip variant="run" dot pulse>Running</Chip>}
            {status === "passed" && <Chip variant="pass" dot>Passed</Chip>}
            {status === "failed" && <Chip variant="fail" dot>Failed</Chip>}
            {status === "idle" && <Chip variant="neutral" dot>Scheduled</Chip>}
            <span className="mono muted" style={{ fontSize: 12 }}>run · {suite.id.slice(0, 8)}</span>
          </div>
          <h1><em className="italic-teal">{suite.testSuiteName}</em></h1>
          <div className="sub">
            {fmtDate(suite.startDate)} → {fmtDate(suite.endDate)}
            {suite.createdByName && <> · created by {suite.createdByName}</>}
          </div>
        </div>
        <div className="actions">
          <Button variant="ghost">
            <svg className="ico" viewBox="0 0 24 24"><path d="M6 19V5M18 19V5" /></svg>
            Pause
          </Button>
          <Button variant="ghost">
            <svg className="ico" viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="1" /></svg>
            Stop
          </Button>
          <Button>
            <svg className="ico" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>
            Export
          </Button>
        </div>
      </div>

      <div className="card" style={{ padding: 22, marginBottom: 20 }}>
        <div className="progress" style={{ height: 10, marginBottom: 16 }}>
          <span className="pass" style={{ width: `${pct}%` }} />
          <span className="fail" style={{ width: `${failedPct}%` }} />
          <span className="run" style={{ width: `${runningPct}%` }} />
          <span className="queued" style={{ width: `${notStartedPct}%` }} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 18 }}>
          <div>
            <div className="section-label">Pass rate</div>
            <div className="stat value" style={{ fontSize: 28 }}>{pct}%</div>
            <div className="muted" style={{ fontSize: 12 }}>{suite.passedCount}/{suite.caseCount} cases</div>
          </div>
          <div>
            <div className="section-label">Failures</div>
            <div className="stat value" style={{ fontSize: 28, color: suite.failedCount > 0 ? "var(--red)" : "var(--ink)" }}>{suite.failedCount}</div>
            <div className="muted" style={{ fontSize: 12 }}>open for triage</div>
          </div>
          <div>
            <div className="section-label">Running</div>
            <div className="stat value" style={{ fontSize: 28 }}>{runningCount}</div>
            <div className="muted" style={{ fontSize: 12 }}>live</div>
          </div>
          <div>
            <div className="section-label">Total cases</div>
            <div className="stat value" style={{ fontSize: 28 }}>{suite.caseCount}</div>
            <div className="muted" style={{ fontSize: 12 }}>in this run</div>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: 20, alignItems: "start" }}>
        <div className="card" style={{ position: "sticky", top: 76, overflow: "hidden" }}>
          <div style={{ padding: 12, borderBottom: "1px solid var(--line)" }}>
            <Tabs
              variant="chip"
              value={filter}
              onChange={(v) => setFilter(v as Filter)}
              options={[
                { value: "all",     label: "All",     count: suite.scheduledCases.length, chipVariant: "teal", dotColor: "var(--teal)" },
                { value: "failed",  label: "Failed",  count: suite.scheduledCases.filter((c) => c.state === "failed" || c.state === "blocked").length, chipVariant: "fail" },
                { value: "passed",  label: "Passed",  count: suite.passedCount, chipVariant: "pass" },
                { value: "running", label: "Running", count: runningCount, chipVariant: "run" },
              ]}
            />
          </div>
          <div style={{ maxHeight: "calc(100vh - 280px)", overflowY: "auto" }}>
            {cases.length === 0 ? (
              <div className="muted" style={{ padding: 24, fontSize: 13, textAlign: "center" }}>
                No cases match this filter.
              </div>
            ) : cases.map((sc) => (
              <button
                key={sc.id}
                onClick={() => setSelectedCaseId(sc.id)}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: "12px 16px",
                  borderBottom: "1px solid var(--line)",
                  background: selectedCaseId === sc.id ? "var(--bg-2)" : "transparent",
                  borderLeft: selectedCaseId === sc.id ? "3px solid var(--teal)" : "3px solid transparent",
                  cursor: "pointer",
                }}
              >
                <div className="row" style={{ marginBottom: 4, gap: 6 }}>
                  <Chip variant={STATE_CHIP[sc.state]} dot pulse={sc.state === "in_progress"}>
                    {STATE_LABELS[sc.state]}
                  </Chip>
                  {sc.linkedBugs.length > 0 && (
                    <span className="mono muted-2" style={{ fontSize: 10.5, marginLeft: "auto" }}>
                      {sc.linkedBugs.length} bug{sc.linkedBugs.length !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 13, color: "var(--ink)", fontWeight: selectedCaseId === sc.id ? 500 : 400, lineHeight: 1.4 }}>
                  {sc.title ?? "Unknown"}
                </div>
                {sc.assignedToName && (
                  <div className="muted" style={{ fontSize: 11.5, marginTop: 4 }}>
                    {sc.assignedToName}
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        <div>
          {selectedCase ? (
            <div className="card">
              <div className="card-head">
                <h3>{selectedCase.title ?? "Unknown"}</h3>
                <div className="actions">
                  <Button variant="ghost" size="sm">Retry</Button>
                  <Button variant="ghost" size="sm">Mark flaky</Button>
                  <Button size="sm" onClick={() => id && projectId && navigate(`/scheduled-test-suites/${projectId}/${id}/cases/${selectedCase.id}`)}>
                    Open detail
                  </Button>
                </div>
              </div>
              <div className="card-body">
                <div className="row gap-lg" style={{ flexWrap: "wrap", marginBottom: 18 }}>
                  <div>
                    <div className="section-label" style={{ marginBottom: 4 }}>State</div>
                    <Chip variant={STATE_CHIP[selectedCase.state]} dot pulse={selectedCase.state === "in_progress"}>
                      {STATE_LABELS[selectedCase.state]}
                    </Chip>
                  </div>
                  <div>
                    <div className="section-label" style={{ marginBottom: 4 }}>Assigned</div>
                    <div style={{ fontSize: 13 }}>{selectedCase.assignedToName ?? <span className="muted">Unassigned</span>}</div>
                  </div>
                  <div>
                    <div className="section-label" style={{ marginBottom: 4 }}>Linked bugs</div>
                    <div className="mono" style={{ fontSize: 13 }}>{selectedCase.linkedBugs.length}</div>
                  </div>
                </div>

                {selectedCase.state === "failed" && (
                  <div
                    style={{
                      border: "1px solid var(--red-line)",
                      background: "linear-gradient(180deg, var(--red-bg) 0%, var(--bg) 80%)",
                      borderRadius: 12,
                      padding: 18,
                      marginBottom: 18,
                    }}
                  >
                    <div className="section-label" style={{ color: "var(--red)" }}>Inferred root cause</div>
                    <p style={{ fontSize: 14, color: "var(--ink)", marginTop: 6, lineHeight: 1.55 }}>
                      Expected bot turn containing <code style={{ fontFamily: "var(--mono)", fontSize: 12, padding: "1px 6px", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 4 }}>confirm_number</code>,
                      but the actual response was <code style={{ fontFamily: "var(--mono)", fontSize: 12, padding: "1px 6px", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 4 }}>clarify_intent</code>.
                      Likely regression after intent router update.
                    </p>
                  </div>
                )}

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <div className="col">
                    <div className="section-label">Expected</div>
                    <pre style={{ fontFamily: "var(--mono)", fontSize: 12, background: "var(--bg-2)", padding: 12, borderRadius: 8, border: "1px solid var(--line)", overflow: "auto", margin: 0 }}>
{`Bot: Here is your confirmation number.
{
  "intent": "confirm_number",
  "value": "A-7812"
}`}
                    </pre>
                  </div>
                  <div className="col">
                    <div className="section-label">Actual</div>
                    <pre style={{ fontFamily: "var(--mono)", fontSize: 12, background: selectedCase.state === "failed" ? "var(--red-bg)" : "var(--bg-2)", padding: 12, borderRadius: 8, border: `1px solid ${selectedCase.state === "failed" ? "var(--red-line)" : "var(--line)"}`, overflow: "auto", margin: 0 }}>
{selectedCase.actualResults || "—"}
                    </pre>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="empty">
              <div className="title">Select a <em className="italic-teal">case</em></div>
              <div className="sub">Pick a case from the left to see its transcript, tool calls and telemetry.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
