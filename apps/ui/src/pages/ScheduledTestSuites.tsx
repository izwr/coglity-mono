import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { testSuiteService, type TestSuiteWithTags } from "../services/testSuiteService";
import { scheduledTestSuiteService, type ScheduledTestSuiteListItem } from "../services/scheduledTestSuiteService";
import { Button } from "../components/ui/Button";
import { Select } from "../components/ui/Select";
import { Chip } from "../components/ui/Chip";
import { PageHead } from "../components/ui/PageHead";
import { useSetBreadcrumbs } from "../context/BreadcrumbsContext";
import { ProjectFilter, useSelectedProjectIds } from "../components/ProjectFilter";
import { ProjectPickerField, useWritableProjects } from "../components/ProjectPickerField";
import { useCurrentOrg } from "../context/OrgContext";

const PAGE_SIZE = 10;

export function ScheduledTestSuites() {
  useSetBreadcrumbs([{ label: "Runs" }]);
  const navigate = useNavigate();
  const { org } = useCurrentOrg();
  const projectIds = useSelectedProjectIds();
  const writable = useWritableProjects();
  const [formProjectId, setFormProjectId] = useState<string>("");
  const [items, setItems] = useState<ScheduledTestSuiteListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [initialLoad, setInitialLoad] = useState(true);
  const [page, setPage] = useState(1);

  const [showForm, setShowForm] = useState(false);
  const [allSuites, setAllSuites] = useState<TestSuiteWithTags[]>([]);
  const [selectedSuiteId, setSelectedSuiteId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [creating, setCreating] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const fetchItems = useCallback(async () => {
    if (!org) return;
    setLoading(true);
    try {
      const res = await scheduledTestSuiteService.getAll(org.organizationId, projectIds, { page, limit: PAGE_SIZE, sortBy: "createdAt", sortDir: "desc" });
      setItems(res.data);
      setTotal(res.total);
    } catch {
      setItems([]); setTotal(0);
    } finally {
      setLoading(false);
      setInitialLoad(false);
    }
  }, [org, projectIds, page]);

  useEffect(() => { fetchItems(); }, [fetchItems]);
  useEffect(() => {
    if (!org) return;
    testSuiteService.getAll(org.organizationId, projectIds, { limit: 100 }).then((res) => setAllSuites(res.data)).catch(() => setAllSuites([]));
  }, [org, projectIds]);

  const closeForm = () => {
    setSelectedSuiteId("");
    setStartDate("");
    setEndDate("");
    setFormProjectId("");
    setShowForm(false);
  };

  const openCreate = () => {
    setSelectedSuiteId("");
    setStartDate("");
    setEndDate("");
    setFormProjectId(writable[0]?.projectId ?? "");
    setShowForm(true);
  };

  const handleCreate = async () => {
    if (!org || !formProjectId || !selectedSuiteId || !startDate || !endDate) return;
    setCreating(true);
    try {
      const created = await scheduledTestSuiteService.create(org.organizationId, formProjectId, {
        testSuiteId: selectedSuiteId,
        startDate: new Date(startDate).toISOString(),
        endDate: new Date(endDate).toISOString(),
      });
      closeForm();
      navigate(`/scheduled-test-suites/${formProjectId}/${created.id}`);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (item: ScheduledTestSuiteListItem) => {
    if (!org) return;
    await scheduledTestSuiteService.remove(org.organizationId, item.projectId, item.id);
    setDeleteConfirmId(null);
    fetchItems();
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const fmtDate = (d: string) => new Date(d).toLocaleDateString();
  const isFormValid = selectedSuiteId && startDate && endDate && new Date(endDate) >= new Date(startDate);

  // Activity chart (last 10 items)
  const chartData = items.slice(0, 24).reverse();

  return (
    <div className="page wide">
      <PageHead
        title={<><em className="italic-teal">Runs</em> history</>}
        subtitle={<>{total} scheduled runs · triage and compare results</>}
        actions={!showForm && (
          <Button
            variant="primary"
            disabled={writable.length === 0}
            title={writable.length === 0 ? "You don't have write access to any project in this organization" : undefined}
            onClick={openCreate}
          >
            <svg className="ico" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg>
            Schedule run
          </Button>
        )}
      />

      <div style={{ marginBottom: 16 }}>
        <ProjectFilter placeholder="Filter by project pick one or more…" />
      </div>

      {showForm && (
        <div className="ts-form">
          <div className="ts-form-title">Schedule a suite run</div>
          <div className="ts-form-field">
            <label htmlFor="sched-project">Project</label>
            <ProjectPickerField id="sched-project" value={formProjectId} onChange={setFormProjectId} required />
          </div>
          <div className="ts-form-field">
            <label>Test suite</label>
            {allSuites.length === 0 ? (
              <p className="ts-form-hint">No test suites available. Create one first.</p>
            ) : (
              <Select
                value={selectedSuiteId ? { value: selectedSuiteId, label: allSuites.find((s) => s.id === selectedSuiteId)?.name ?? "" } : null}
                onChange={(opt) => setSelectedSuiteId(opt?.value ?? "")}
                options={allSuites.map((s) => ({ value: s.id, label: s.name }))}
                placeholder="Select a test suite"
              />
            )}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div className="ts-form-field">
              <label>Start date</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="ts-form-field">
              <label>End date</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>
          <div className="ts-form-actions">
            <Button variant="ghost" onClick={closeForm}>Cancel</Button>
            <Button variant="primary" onClick={handleCreate} disabled={!isFormValid || creating || !formProjectId}>
              {creating ? "Creating…" : "Schedule"}
            </Button>
          </div>
        </div>
      )}

      {initialLoad ? (
        <p className="ts-empty">Loading…</p>
      ) : total === 0 && !showForm ? (
        <div className="empty">
          <div className="title">No <em className="italic-teal">runs</em> yet.</div>
          <div className="sub">Schedule a suite to see pass rates and triage failures here.</div>
          <Button variant="primary" onClick={() => setShowForm(true)}>Schedule run</Button>
        </div>
      ) : (
        <>
          {chartData.length > 0 && (
            <div className="card" style={{ padding: 20, marginBottom: 16 }}>
              <div className="row" style={{ marginBottom: 14 }}>
                <div className="section-label">Recent activity</div>
                <div className="muted" style={{ marginLeft: "auto", fontSize: 12.5 }}>Last {chartData.length} runs</div>
              </div>
              <div className="sbar" style={{ height: 60 }}>
                {chartData.map((item) => {
                  const pct = item.caseCount > 0 ? Math.round((item.passedCount / item.caseCount) * 100) : 0;
                  const cls = pct >= 95 ? "" : pct >= 85 ? "amber" : item.caseCount === 0 ? "muted" : "red";
                  return <span key={item.id} className={cls} style={{ height: `${Math.max(10, pct)}%` }} title={`${item.testSuiteName} · ${pct}%`} />;
                })}
              </div>
            </div>
          )}

          {loading ? (
            <p className="ts-empty">Loading…</p>
          ) : (
            <div className="card" style={{ overflow: "hidden" }}>
              <div className="table-scroll">
                <table className="t">
                  <thead>
                    <tr>
                      <th>Run ID</th>
                      <th>Suite</th>
                      <th>Window</th>
                      <th>Cases</th>
                      <th>Pass rate</th>
                      <th>Status</th>
                      <th>Created</th>
                      <th style={{ textAlign: "right" }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => {
                      const pct = item.caseCount > 0 ? Math.round((item.passedCount / item.caseCount) * 100) : 0;
                      const status = item.failedCount === 0 && item.passedCount === item.caseCount && item.caseCount > 0
                        ? "passed"
                        : item.failedCount > 0 ? "failed" : "running";
                      return (
                        <tr key={item.id} onClick={() => navigate(`/scheduled-test-suites/${item.projectId}/${item.id}`)} style={{ cursor: "pointer" }}>
                          <td className="mono">{item.id.slice(0, 8)}</td>
                          <td style={{ color: "var(--ink)" }}>{item.testSuiteName}</td>
                          <td className="mono muted">{fmtDate(item.startDate)} → {fmtDate(item.endDate)}</td>
                          <td className="mono">{item.passedCount}/{item.caseCount}</td>
                          <td style={{ minWidth: 140 }}>
                            <div className="row" style={{ gap: 8 }}>
                              <div className="progress" style={{ flex: 1, maxWidth: 120 }}>
                                <span className="pass" style={{ width: `${pct}%` }} />
                                <span className="fail" style={{ width: `${item.failedCount && item.caseCount ? (item.failedCount / item.caseCount) * 100 : 0}%` }} />
                              </div>
                              <span className="mono" style={{ fontSize: 12 }}>{pct}%</span>
                            </div>
                          </td>
                          <td>
                            {status === "passed" && <Chip variant="pass" dot>passed</Chip>}
                            {status === "failed" && <Chip variant="fail" dot>failed</Chip>}
                            {status === "running" && <Chip variant="run" dot pulse>running</Chip>}
                          </td>
                          <td className="mono muted">{fmtDate(item.createdAt)}</td>
                          <td onClick={(e) => e.stopPropagation()} style={{ textAlign: "right" }}>
                            {deleteConfirmId === item.id ? (
                              <div className="row" style={{ justifyContent: "flex-end", gap: 4 }}>
                                <Button variant="danger" size="sm" onClick={() => handleDelete(item)}>Confirm</Button>
                                <Button variant="ghost" size="sm" onClick={() => setDeleteConfirmId(null)}>Cancel</Button>
                              </div>
                            ) : (
                              <Button variant="ghost" size="sm" onClick={() => setDeleteConfirmId(item.id)}>Delete</Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {totalPages > 1 && (
            <div className="pagination">
              <button className="pagination-btn" disabled={page <= 1} onClick={() => setPage(page - 1)}>Prev</button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button key={p} className={`pagination-btn${p === page ? " active" : ""}`} onClick={() => setPage(p)}>{p}</button>
              ))}
              <button className="pagination-btn" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next</button>
              <span className="pagination-info">{total} result{total !== 1 ? "s" : ""}</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
