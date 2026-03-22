import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { testSuiteService, type TestSuiteWithTags } from "../services/testSuiteService";
import { scheduledTestSuiteService, type ScheduledTestSuiteListItem } from "../services/scheduledTestSuiteService";
import { Button } from "../components/ui/Button";
import { Select } from "../components/ui/Select";

const PAGE_SIZE = 10;

export function ScheduledTestSuites() {
  const navigate = useNavigate();
  const [items, setItems] = useState<ScheduledTestSuiteListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [initialLoad, setInitialLoad] = useState(true);
  const [page, setPage] = useState(1);

  // Create form
  const [showForm, setShowForm] = useState(false);
  const [allSuites, setAllSuites] = useState<TestSuiteWithTags[]>([]);
  const [selectedSuiteId, setSelectedSuiteId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [creating, setCreating] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await scheduledTestSuiteService.getAll({ page, limit: PAGE_SIZE, sortBy: "createdAt", sortDir: "desc" });
      setItems(res.data);
      setTotal(res.total);
    } catch {
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
      setInitialLoad(false);
    }
  }, [page]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  useEffect(() => {
    testSuiteService.getAll({ limit: 100 }).then((res) => {
      setAllSuites(Array.isArray(res.data) ? res.data : []);
    }).catch(() => setAllSuites([]));
  }, []);

  const closeForm = () => {
    setSelectedSuiteId("");
    setStartDate("");
    setEndDate("");
    setShowForm(false);
  };

  const handleCreate = async () => {
    if (!selectedSuiteId || !startDate || !endDate) return;
    setCreating(true);
    try {
      const created = await scheduledTestSuiteService.create({
        testSuiteId: selectedSuiteId,
        startDate: new Date(startDate).toISOString(),
        endDate: new Date(endDate).toISOString(),
      });
      closeForm();
      navigate(`/scheduled-test-suites/${created.id}`);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    await scheduledTestSuiteService.remove(id);
    setDeleteConfirmId(null);
    fetchItems();
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const formatDate = (d: string) => new Date(d).toLocaleDateString();

  const isFormValid = selectedSuiteId && startDate && endDate && new Date(endDate) >= new Date(startDate);

  return (
    <div className="page-test-suites">
      <div className="page-header">
        <h1>Scheduled Test Suites</h1>
        {!showForm && (
          <Button onClick={() => setShowForm(true)}>+ Schedule Suite</Button>
        )}
      </div>

      {showForm && (
        <div className="ts-form">
          <div className="ts-form-title">Schedule a Test Suite</div>
          <div className="ts-form-field">
            <label>Test Suite</label>
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
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div className="ts-form-field">
              <label>Start Date</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="ts-form-field">
              <label>End Date</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>
          <div className="ts-form-actions">
            <Button variant="ghost" onClick={closeForm}>Cancel</Button>
            <Button onClick={handleCreate} disabled={!isFormValid || creating}>
              {creating ? "Creating..." : "Create"}
            </Button>
          </div>
        </div>
      )}

      {initialLoad ? (
        <p className="ts-empty">Loading...</p>
      ) : total === 0 && !showForm ? (
        <div className="ts-empty-state">
          <div className="ts-empty-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <p>No scheduled test suites yet</p>
          <span>Schedule your first test suite to get started</span>
        </div>
      ) : (
        <>
          {loading ? (
            <p className="ts-empty">Loading...</p>
          ) : (
            <div className="ts-list">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="ts-card"
                  style={{ cursor: "pointer" }}
                  onClick={() => navigate(`/scheduled-test-suites/${item.id}`)}
                >
                  <div className="ts-card-body">
                    <div className="ts-card-name">{item.testSuiteName}</div>
                    <div className="ts-card-desc" style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                      <span className="bug-badge bug-type">{formatDate(item.startDate)} → {formatDate(item.endDate)}</span>
                      <span className="bug-badge priority-low">{item.passedCount}/{item.caseCount} passed</span>
                      {item.failedCount > 0 && <span className="bug-badge priority-critical">{item.failedCount} failed</span>}
                    </div>
                    <div className="ts-card-meta">
                      Created {formatDate(item.createdAt)}
                      {item.createdByName && ` by ${item.createdByName}`}
                    </div>
                  </div>
                  <div className="ts-card-actions" onClick={(e) => e.stopPropagation()}>
                    {deleteConfirmId === item.id ? (
                      <div className="ts-delete-confirm">
                        <Button variant="danger" size="sm" onClick={() => handleDelete(item.id)}>Confirm</Button>
                        <Button variant="ghost" size="sm" onClick={() => setDeleteConfirmId(null)}>Cancel</Button>
                      </div>
                    ) : (
                      <Button variant="danger" onClick={() => setDeleteConfirmId(item.id)}>Delete</Button>
                    )}
                  </div>
                </div>
              ))}
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