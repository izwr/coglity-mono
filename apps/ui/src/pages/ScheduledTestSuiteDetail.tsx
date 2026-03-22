import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { scheduledTestSuiteService, type ScheduledTestSuiteDetail as SuiteDetail } from "../services/scheduledTestSuiteService";
import { Button } from "../components/ui/Button";

const STATE_LABELS: Record<string, string> = {
  not_started: "Not Started",
  in_progress: "In Progress",
  passed: "Passed",
  failed: "Failed",
  blocked: "Blocked",
  skipped: "Skipped",
};

const STATE_COLORS: Record<string, string> = {
  not_started: "var(--color-text-tertiary)",
  in_progress: "#d97706",
  passed: "#059669",
  failed: "#dc2626",
  blocked: "#7c3aed",
  skipped: "#6b7280",
};

export function ScheduledTestSuiteDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [suite, setSuite] = useState<SuiteDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    scheduledTestSuiteService.getById(id).then(setSuite).catch(() => {
      navigate("/scheduled-test-suites");
    }).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="page-test-suites"><p className="ts-empty">Loading...</p></div>;
  if (!suite) return <div className="page-test-suites"><p className="ts-empty">Not found.</p></div>;

  const formatDate = (d: string) => new Date(d).toLocaleDateString();

  return (
    <div className="tc-detail">
      {/* Header */}
      <div className="tc-detail-header">
        <div className="tc-detail-header-left">
          <Button variant="ghost" className="tc-back-btn" onClick={() => navigate("/scheduled-test-suites")}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Back
          </Button>
          <h1 className="tc-detail-title">{suite.testSuiteName}</h1>
        </div>
      </div>

      {/* Meta */}
      <div className="tc-detail-meta">
        <div className="tc-detail-meta-text" style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
          <span className="bug-badge bug-type">{formatDate(suite.startDate)} → {formatDate(suite.endDate)}</span>
          <span className="bug-badge priority-low">{suite.passedCount}/{suite.caseCount} passed</span>
          {suite.failedCount > 0 && <span className="bug-badge priority-critical">{suite.failedCount} failed</span>}
          {suite.createdByName && <span>Created by {suite.createdByName}</span>}
        </div>
      </div>

      {/* Scheduled Cases — flat list */}
      <div style={{ marginTop: "24px" }}>
        <h2 style={{ fontSize: "15px", fontWeight: 600, marginBottom: "12px", color: "var(--color-text)" }}>
          Test Cases ({suite.scheduledCases.length})
        </h2>

        {suite.scheduledCases.length === 0 ? (
          <p className="ts-empty">No test cases in this suite.</p>
        ) : (
          <div className="ts-list">
            {suite.scheduledCases.map((sc) => {
              const stateColor = STATE_COLORS[sc.state] ?? "var(--color-text)";
              return (
                <div
                  key={sc.id}
                  className="ts-card"
                  style={{ cursor: "pointer" }}
                  onClick={() => navigate(`/scheduled-test-suites/${id}/cases/${sc.id}`)}
                >
                  <div className="ts-card-body">
                    <div className="ts-card-name">
                      {sc.title ?? "Unknown test case"}
                      <span className="status-badge" style={{ color: stateColor, background: `${stateColor}18` }}>
                        {STATE_LABELS[sc.state]}
                      </span>
                    </div>
                    <div className="ts-card-desc" style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                      {sc.assignedToName && <span className="bug-badge assigned">Assigned: {sc.assignedToName}</span>}
                      {sc.linkedBugs.length > 0 && (
                        <span className="bug-badge priority-critical">
                          {sc.linkedBugs.length} bug{sc.linkedBugs.length !== 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}