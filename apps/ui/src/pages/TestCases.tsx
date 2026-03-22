import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import type { Tag } from "@coglity/shared";
import { testCaseService, type TestCaseWithTags } from "../services/testCaseService";
import { testSuiteService, type TestSuiteWithTags } from "../services/testSuiteService";
import { tagService } from "../services/tagService";
import { ListToolbar, type AppliedFilters } from "../components/ListToolbar";

const createTestCaseSchema = yup.object({
  title: yup.string().required("Title is required").max(255),
  testSuiteId: yup.string().required("Test suite is required"),
});

type CreateFormValues = yup.InferType<typeof createTestCaseSchema>;

const PAGE_SIZE = 10;

const SORT_OPTIONS = [
  { label: "Newest first", field: "createdAt", dir: "desc" as const },
  { label: "Oldest first", field: "createdAt", dir: "asc" as const },
  { label: "Title A-Z", field: "title", dir: "asc" as const },
  { label: "Title Z-A", field: "title", dir: "desc" as const },
  { label: "Recently updated", field: "updatedAt", dir: "desc" as const },
];

const STATUS_TOGGLE = {
  options: [
    { value: "active", label: "Active", activeClass: "active-selected" },
    { value: "draft", label: "Draft", activeClass: "draft-selected" },
  ],
};

export function TestCases() {
  const navigate = useNavigate();
  const [cases, setCases] = useState<TestCaseWithTags[]>([]);
  const [total, setTotal] = useState(0);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [allSuites, setAllSuites] = useState<TestSuiteWithTags[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [initialLoad, setInitialLoad] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Applied filters
  const [filters, setFilters] = useState<AppliedFilters>({
    search: "", tagId: "", sortBy: "createdAt", sortDir: "desc", suiteId: "", status: "",
  });
  const [page, setPage] = useState(1);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isValid },
  } = useForm<CreateFormValues>({
    resolver: yupResolver(createTestCaseSchema),
    mode: "onChange",
    defaultValues: { title: "", testSuiteId: "" },
  });

  const fetchCases = useCallback(async () => {
    setLoading(true);
    try {
      const res = await testCaseService.getAll({
        search: filters.search || undefined,
        testSuiteId: filters.suiteId || undefined,
        status: filters.status || undefined,
        tagId: filters.tagId || undefined,
        sortBy: filters.sortBy,
        sortDir: filters.sortDir,
        page,
        limit: PAGE_SIZE,
      });
      setCases(res.data);
      setTotal(res.total);
    } catch {
      setCases([]);
      setTotal(0);
    } finally {
      setLoading(false);
      setInitialLoad(false);
    }
  }, [filters, page]);

  const fetchTags = async () => {
    try {
      const data = await tagService.getAll();
      setAllTags(Array.isArray(data) ? data : []);
    } catch {
      setAllTags([]);
    }
  };

  const fetchSuites = async () => {
    try {
      const data = await testSuiteService.getAll({ limit: 100 });
      setAllSuites(Array.isArray(data.data) ? data.data : []);
    } catch {
      setAllSuites([]);
    }
  };

  useEffect(() => {
    fetchTags();
    fetchSuites();
  }, []);

  useEffect(() => {
    fetchCases();
  }, [fetchCases]);

  const handleApplyFilters = (applied: AppliedFilters) => {
    setFilters(applied);
    setPage(1);
  };

  const closeForm = () => {
    reset({ title: "", testSuiteId: "" });
    setSelectedTagIds([]);
    setShowForm(false);
  };

  const onSubmit = async (data: CreateFormValues) => {
    const created = await testCaseService.create({
      title: data.title,
      testSuiteId: data.testSuiteId,
      preCondition: "",
      testSteps: "",
      data: "",
      expectedResults: "",
      tagIds: selectedTagIds,
    });
    closeForm();
    navigate(`/test-cases/${created.id}`);
  };

  const handleDelete = async (id: string) => {
    await testCaseService.remove(id);
    setDeleteConfirmId(null);
    fetchCases();
  };

  const toggleTag = (tagId: string) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((i) => i !== tagId) : [...prev, tagId],
    );
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasFilters = !!(filters.search || filters.tagId || filters.suiteId || filters.status);

  return (
    <div className="page-test-suites">
      <div className="page-header">
        <h1>Test Cases</h1>
        {!showForm && (
          <div style={{ display: "flex", gap: "8px" }}>
            <button className="btn btn-primary" onClick={() => setShowForm(true)}>
              + Add Test Case
            </button>
            <button
              className="btn btn-primary ai-generate-btn"
              onClick={() => navigate("/test-cases/generate")}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: "6px" }}>
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
              Generate with AI
            </button>
          </div>
        )}
      </div>

      {showForm && (
        <form className="ts-form" onSubmit={handleSubmit(onSubmit)}>
          <div className="ts-form-title">Create Test Case</div>
          <div className="ts-form-field">
            <label htmlFor="tc-title">Title</label>
            <input
              id="tc-title"
              type="text"
              placeholder="Enter test case title"
              autoFocus
              {...register("title")}
            />
            {errors.title && <span className="ts-form-error">{errors.title.message}</span>}
          </div>
          <div className="ts-form-field">
            <label htmlFor="tc-suite">Test Suite</label>
            {allSuites.length === 0 ? (
              <p className="ts-form-hint">No test suites available. Create a test suite first.</p>
            ) : (
              <select id="tc-suite" {...register("testSuiteId")}>
                <option value="">Select a test suite</option>
                {allSuites.map((suite) => (
                  <option key={suite.id} value={suite.id}>{suite.name}</option>
                ))}
              </select>
            )}
            {errors.testSuiteId && <span className="ts-form-error">{errors.testSuiteId.message}</span>}
          </div>
          <div className="ts-form-field">
            <label>Tags</label>
            {allTags.length === 0 ? (
              <p className="ts-form-hint">No tags available. Create tags first.</p>
            ) : (
              <div className="tag-picker">
                {allTags.map((tag) => (
                  <button
                    key={tag.id}
                    type="button"
                    className={`tag-chip${selectedTagIds.includes(tag.id) ? " selected" : ""}`}
                    onClick={() => toggleTag(tag.id)}
                  >
                    {tag.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="ts-form-actions">
            <button type="button" className="btn btn-ghost" onClick={closeForm}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={!isValid || isSubmitting}>
              Create
            </button>
          </div>
        </form>
      )}

      {initialLoad ? (
        <p className="ts-empty">Loading...</p>
      ) : total === 0 && !hasFilters && !showForm ? (
        <div className="ts-empty-state">
          <div className="ts-empty-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
          </div>
          <p>No test cases yet</p>
          <span>Create your first test case to get started</span>
        </div>
      ) : (
        <>
          <ListToolbar
            searchPlaceholder="Search test cases..."
            tags={allTags}
            sortOptions={SORT_OPTIONS}
            onApply={handleApplyFilters}
            suites={allSuites}
            statusToggle={STATUS_TOGGLE}
          />

          {loading ? (
            <p className="ts-empty">Loading...</p>
          ) : cases.length === 0 ? (
            <p className="ts-empty">No test cases match your filters.</p>
          ) : (
          <div className="ts-list">
          {cases.map((tc) => (
            <div
              key={tc.id}
              className="ts-card"
              style={{ cursor: "pointer" }}
              onClick={() => navigate(`/test-cases/${tc.id}`)}
            >
              <div className="ts-card-body">
                <div className="ts-card-name">
                  {tc.title}
                  {tc.status === "draft" && (
                    <span className="status-badge status-draft">Draft</span>
                  )}
                  {tc.status === "active" && (
                    <span className="status-badge status-active">Active</span>
                  )}
                </div>
                <div className="ts-card-desc">{tc.testSuiteName}</div>
                {tc.tags.length > 0 && (
                  <div className="ts-card-tags">
                    {tc.tags.map((tag) => (
                      <span key={tag.id} className="tag-badge">{tag.name}</span>
                    ))}
                  </div>
                )}
                <div className="ts-card-meta">
                  Created {new Date(tc.createdAt).toLocaleDateString()}
                  {tc.createdByName && ` by ${tc.createdByName}`}
                  {tc.updatedByName && tc.updatedBy !== tc.createdBy && (
                    <> · Updated {new Date(tc.updatedAt).toLocaleDateString()} by {tc.updatedByName}</>
                  )}
                </div>
              </div>
              <div className="ts-card-actions" onClick={(e) => e.stopPropagation()}>
                {deleteConfirmId === tc.id ? (
                  <div className="ts-delete-confirm">
                    <button
                      className="btn btn-danger-sm"
                      onClick={() => handleDelete(tc.id)}
                    >
                      Confirm
                    </button>
                    <button
                      className="btn btn-ghost-sm"
                      onClick={() => setDeleteConfirmId(null)}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    className="btn btn-danger"
                    title="Delete"
                    onClick={() => setDeleteConfirmId(tc.id)}
                  >
                    Delete
                  </button>
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