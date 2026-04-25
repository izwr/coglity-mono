import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import ReactSelect from "react-select";
import { scheduledTestSuiteService, type ScheduledTestCaseDetailDTO } from "../services/scheduledTestSuiteService";
import { bugService, type BugWithDetails } from "../services/bugService";
import { userService, type UserOption } from "../services/userService";
import { Button } from "../components/ui/Button";
import { Select } from "../components/ui/Select";
import { useSetBreadcrumbs } from "../context/BreadcrumbsContext";
import { useCurrentOrg } from "../context/OrgContext";

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

const bugSelectStyles = {
  control: (base: any, state: any) => ({
    ...base,
    background: "var(--color-surface, #fff)",
    borderColor: state.isFocused ? "var(--color-accent)" : "var(--color-border)",
    borderRadius: 6, minHeight: 32, fontSize: 13,
    boxShadow: state.isFocused ? "0 0 0 1px var(--color-accent)" : "none",
    "&:hover": { borderColor: "var(--color-accent)" },
  }),
  valueContainer: (base: any) => ({ ...base, padding: "0 8px" }),
  input: (base: any) => ({ ...base, margin: 0, padding: 0 }),
  option: (base: any, state: any) => ({
    ...base,
    backgroundColor: state.isSelected ? "var(--color-accent)" : state.isFocused ? "var(--color-bg-muted)" : "transparent",
    color: state.isSelected ? "#fff" : "var(--color-text)",
    padding: "6px 10px", fontSize: 13,
  }),
  menu: (base: any) => ({ ...base, background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 6, zIndex: 20, fontSize: 13 }),
  multiValue: (base: any) => ({ ...base, backgroundColor: "var(--color-bg-muted)", borderRadius: 4, margin: "1px 2px" }),
  multiValueLabel: (base: any) => ({ ...base, color: "var(--color-text)", fontSize: 12, padding: "1px 4px" }),
  multiValueRemove: (base: any) => ({ ...base, padding: "0 2px" }),
  dropdownIndicator: (base: any) => ({ ...base, padding: "0 6px", color: "var(--color-text-tertiary)" }),
  clearIndicator: (base: any) => ({ ...base, padding: "0 4px", color: "var(--color-text-tertiary)" }),
  indicatorSeparator: () => ({ display: "none" }),
};

export function ScheduledTestCaseDetail() {
  const { id: suiteId, caseId, projectId } = useParams<{ id: string; caseId: string; projectId: string }>();
  const navigate = useNavigate();
  const { org } = useCurrentOrg();
  useSetBreadcrumbs([
    { label: "Runs", to: "/scheduled-test-suites" },
    { label: "Run", to: suiteId && projectId ? `/scheduled-test-suites/${projectId}/${suiteId}` : undefined },
    { label: "Case" },
  ]);

  const [sc, setSc] = useState<ScheduledTestCaseDetailDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [allUsers, setAllUsers] = useState<UserOption[]>([]);
  const [allBugs, setAllBugs] = useState<{ id: string; title: string }[]>([]);

  // Edit mode
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editState, setEditState] = useState("");
  const [editAssignedTo, setEditAssignedTo] = useState<string | null>(null);
  const [editActualResults, setEditActualResults] = useState("");
  const [editLinkedBugIds, setEditLinkedBugIds] = useState<string[]>([]);

  useEffect(() => {
    if (!suiteId || !caseId || !projectId || !org) return;
    Promise.all([
      scheduledTestSuiteService.getCase(org.organizationId, projectId, suiteId, caseId),
      userService.getAll(org.organizationId, projectId),
      bugService.getAll(org.organizationId, [projectId], { limit: 100 }),
    ]).then(([caseData, usersData, bugsRes]) => {
      setSc(caseData);
      setAllUsers(Array.isArray(usersData) ? usersData : []);
      setAllBugs((bugsRes.data ?? []).map((b: BugWithDetails) => ({ id: b.id, title: b.title })));
    }).catch(() => {
      navigate(`/scheduled-test-suites/${projectId}/${suiteId}`);
    }).finally(() => setLoading(false));
  }, [suiteId, caseId, projectId, org]);

  const populateEditFields = (data: ScheduledTestCaseDetailDTO) => {
    setEditState(data.state);
    setEditAssignedTo(data.assignedTo);
    setEditActualResults(data.actualResults);
    setEditLinkedBugIds([...(data.linkedBugIds as string[])]);
  };

  const startEdit = () => {
    if (sc) populateEditFields(sc);
    setEditing(true);
  };

  const cancelEdit = () => {
    if (sc) populateEditFields(sc);
    setEditing(false);
  };

  const handleSave = async () => {
    if (!suiteId || !caseId || !projectId || !org) return;
    setSaving(true);
    try {
      const updated = await scheduledTestSuiteService.updateCase(org.organizationId, projectId, suiteId, caseId, {
        state: editState,
        assignedTo: editAssignedTo,
        actualResults: editActualResults,
        linkedBugIds: editLinkedBugIds,
      });
      setSc((prev) => prev ? { ...prev, ...updated } : prev);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="page-test-suites"><p className="ts-empty">Loading...</p></div>;
  if (!sc) return <div className="page-test-suites"><p className="ts-empty">Scheduled test case not found.</p></div>;

  const stateColor = STATE_COLORS[editing ? editState : sc.state] ?? "var(--color-text)";
  const formatDate = (d: string | null) => d ? new Date(d).toLocaleDateString() : "";

  return (
    <div className="tc-detail">
      {/* Header */}
      <div className="tc-detail-header">
        <div className="tc-detail-header-left">
          <Button variant="ghost" className="tc-back-btn" onClick={() => navigate(`/scheduled-test-suites/${suiteId}`)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Back
          </Button>
          <h1 className="tc-detail-title">
            {sc.title ?? "Unknown test case"}
            <span className="status-badge" style={{ color: stateColor, background: `${stateColor}18` }}>
              {STATE_LABELS[editing ? editState : sc.state]}
            </span>
          </h1>
        </div>
        <div className="tc-detail-header-actions">
          {editing ? (
            <>
              <Button variant="ghost" onClick={cancelEdit}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? "Saving..." : "Save"}
              </Button>
            </>
          ) : (
            <Button onClick={startEdit}>Edit</Button>
          )}
        </div>
      </div>

      {/* Meta */}
      <div className="tc-detail-meta">
        <div className="tc-detail-meta-text">
          Suite: {sc.testSuiteName} · {formatDate(sc.startDate)} → {formatDate(sc.endDate)}
          {(editing ? editAssignedTo : sc.assignedTo) && (
            <> · Assigned to {allUsers.find((u) => u.id === (editing ? editAssignedTo : sc.assignedTo))?.displayName ?? sc.assignedToName}</>
          )}
        </div>
      </div>

      {/* Scheduled fields */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "16px", marginBottom: "24px" }}>
        <div className="tc-detail-section">
          <label className="tc-detail-label">State</label>
          {editing ? (
            <Select
              value={{ value: editState, label: STATE_LABELS[editState] }}
              onChange={(opt) => setEditState(opt?.value ?? "not_started")}
              options={Object.entries(STATE_LABELS).map(([val, label]) => ({ value: val, label }))}
            />
          ) : (
            <div className="tc-detail-content">
              <span className="status-badge" style={{ color: stateColor, background: `${stateColor}18`, marginLeft: 0 }}>
                {STATE_LABELS[sc.state]}
              </span>
            </div>
          )}
        </div>
        <div className="tc-detail-section">
          <label className="tc-detail-label">Assigned To</label>
          {editing ? (
            <Select
              value={editAssignedTo ? { value: editAssignedTo, label: allUsers.find((u) => u.id === editAssignedTo)?.displayName ?? "" } : null}
              onChange={(opt) => setEditAssignedTo(opt?.value ?? null)}
              options={allUsers.map((u) => ({ value: u.id, label: u.displayName }))}
              placeholder="Unassigned"
              isClearable
            />
          ) : (
            <div className="tc-detail-content">{sc.assignedToName ?? "Unassigned"}</div>
          )}
        </div>
        <div className="tc-detail-section">
          <label className="tc-detail-label">Linked Bugs</label>
          {editing ? (
            <ReactSelect
              isMulti
              value={editLinkedBugIds.map((bugId) => {
                const b = allBugs.find((x) => x.id === bugId);
                return { value: bugId, label: b?.title ?? bugId };
              })}
              onChange={(opts) => setEditLinkedBugIds(opts.map((o) => o.value))}
              options={allBugs.map((b) => ({ value: b.id, label: b.title }))}
              placeholder="Link bugs..."
              styles={bugSelectStyles as any}
              menuPortalTarget={document.body}
              menuPosition="fixed"
            />
          ) : (
            <div className="tc-detail-content">
              {sc.linkedBugs.length === 0 ? (
                "None"
              ) : (
                <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                  {sc.linkedBugs.map((b) => (
                    <span key={b.id} className="bug-badge priority-critical">{b.title}</span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Test case details read only */}
      <div className="tc-detail-section" style={{ marginBottom: "16px" }}>
        <label className="tc-detail-label">Pre Condition</label>
        <div className="tc-detail-content">
          {sc.preCondition || <span className="tc-detail-placeholder">No pre conditions defined.</span>}
        </div>
      </div>

      <div className="tc-detail-grid">
        <div className="tc-detail-left">
          <div className="tc-detail-section">
            <label className="tc-detail-label">Test Steps</label>
            <div className="tc-detail-content tc-detail-content-tall">
              {sc.testSteps || <span className="tc-detail-placeholder">No test steps defined.</span>}
            </div>
          </div>
        </div>
        <div className="tc-detail-right">
          <div className="tc-detail-section">
            <label className="tc-detail-label">Expected Results</label>
            <div className="tc-detail-content">
              {sc.expectedResults || <span className="tc-detail-placeholder">No expected results defined.</span>}
            </div>
          </div>
          <div className="tc-detail-section">
            <label className="tc-detail-label">Data</label>
            <div className="tc-detail-content">
              {sc.data || <span className="tc-detail-placeholder">No test data defined.</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Actual Results */}
      <div className="tc-detail-section" style={{ marginTop: "24px" }}>
        <label className="tc-detail-label">Actual Results</label>
        {editing ? (
          <textarea
            className="tc-detail-textarea tc-detail-textarea-tall"
            value={editActualResults}
            onChange={(e) => setEditActualResults(e.target.value)}
            placeholder="Enter actual results..."
          />
        ) : (
          <div className="tc-detail-content tc-detail-content-tall">
            {sc.actualResults || <span className="tc-detail-placeholder">No actual results recorded.</span>}
          </div>
        )}
      </div>
    </div>
  );
}