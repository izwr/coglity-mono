import { useEffect, useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import type { Tag } from "@coglity/shared";
import { testSuiteService, type TestSuiteWithTags } from "../services/testSuiteService";
import { tagService } from "../services/tagService";
import { ListToolbar, type AppliedFilters } from "../components/ListToolbar";
import { Button } from "../components/ui/Button";

const testSuiteFormSchema = yup.object({
  name: yup.string().required("Name is required").max(255),
  description: yup.string().max(2000).default(""),
});

type FormValues = yup.InferType<typeof testSuiteFormSchema>;

const PAGE_SIZE = 10;

const SORT_OPTIONS = [
  { label: "Newest first", field: "createdAt", dir: "desc" as const },
  { label: "Oldest first", field: "createdAt", dir: "asc" as const },
  { label: "Name A-Z", field: "name", dir: "asc" as const },
  { label: "Name Z-A", field: "name", dir: "desc" as const },
  { label: "Recently updated", field: "updatedAt", dir: "desc" as const },
];

export function TestSuites() {
  const [suites, setSuites] = useState<TestSuiteWithTags[]>([]);
  const [total, setTotal] = useState(0);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [initialLoad, setInitialLoad] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Applied filters
  const [filters, setFilters] = useState<AppliedFilters>({
    search: "", tagId: "", sortBy: "createdAt", sortDir: "desc",
  });
  const [page, setPage] = useState(1);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isValid },
  } = useForm<FormValues>({
    resolver: yupResolver(testSuiteFormSchema),
    mode: "onChange",
    defaultValues: { name: "", description: "" },
  });

  const fetchSuites = useCallback(async () => {
    setLoading(true);
    try {
      const res = await testSuiteService.getAll({
        search: filters.search || undefined,
        tagId: filters.tagId || undefined,
        sortBy: filters.sortBy,
        sortDir: filters.sortDir,
        page,
        limit: PAGE_SIZE,
      });
      setSuites(res.data);
      setTotal(res.total);
    } catch {
      setSuites([]);
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

  useEffect(() => {
    fetchTags();
  }, []);

  useEffect(() => {
    fetchSuites();
  }, [fetchSuites]);

  const handleApplyFilters = (applied: AppliedFilters) => {
    setFilters(applied);
    setPage(1);
  };

  const closeForm = () => {
    reset({ name: "", description: "" });
    setSelectedTagIds([]);
    setEditingId(null);
    setShowForm(false);
  };

  const onSubmit = async (data: FormValues) => {
    if (editingId) {
      await testSuiteService.update(editingId, { ...data, tagIds: selectedTagIds });
    } else {
      await testSuiteService.create({ ...data, tagIds: selectedTagIds });
    }
    closeForm();
    fetchSuites();
  };

  const startEdit = (suite: TestSuiteWithTags) => {
    reset({ name: suite.name, description: suite.description });
    setSelectedTagIds(suite.tags.map((t) => t.id));
    setEditingId(suite.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    await testSuiteService.remove(id);
    setDeleteConfirmId(null);
    fetchSuites();
  };

  const toggleTag = (tagId: string) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId],
    );
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasFilters = !!(filters.search || filters.tagId);

  return (
    <div className="page-test-suites">
      <div className="page-header">
        <h1>Test Suites</h1>
        {!showForm && (
          <Button onClick={() => setShowForm(true)}>
            + New Test Suite
          </Button>
        )}
      </div>

      {showForm && (
        <form className="ts-form" onSubmit={handleSubmit(onSubmit)}>
          <div className="ts-form-title">
            {editingId ? "Edit Test Suite" : "Create Test Suite"}
          </div>
          <div className="ts-form-field">
            <label htmlFor="ts-name">Name</label>
            <input
              id="ts-name"
              type="text"
              placeholder="Enter test suite name"
              autoFocus
              {...register("name")}
            />
            {errors.name && <span className="ts-form-error">{errors.name.message}</span>}
          </div>
          <div className="ts-form-field">
            <label htmlFor="ts-desc">Description</label>
            <textarea
              id="ts-desc"
              placeholder="Enter description (optional)"
              rows={3}
              {...register("description")}
            />
            {errors.description && <span className="ts-form-error">{errors.description.message}</span>}
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
            <Button type="button" variant="ghost" onClick={closeForm}>
              Cancel
            </Button>
            <Button type="submit" disabled={!isValid || isSubmitting}>
              {editingId ? "Update" : "Create"}
            </Button>
          </div>
        </form>
      )}

      {initialLoad ? (
        <p className="ts-empty">Loading...</p>
      ) : total === 0 && !hasFilters && !showForm ? (
        <div className="ts-empty-state">
          <div className="ts-empty-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <p>No test suites yet</p>
          <span>Create your first test suite to get started</span>
        </div>
      ) : (
        <>
          <ListToolbar
            searchPlaceholder="Search test suites..."
            tags={allTags}
            sortOptions={SORT_OPTIONS}
            onApply={handleApplyFilters}
          />

          {loading ? (
            <p className="ts-empty">Loading...</p>
          ) : suites.length === 0 ? (
            <p className="ts-empty">No test suites match your filters.</p>
          ) : (
          <div className="ts-list">
          {suites.map((suite) => (
            <div key={suite.id} className="ts-card">
              <div className="ts-card-body">
                <div className="ts-card-name">{suite.name}</div>
                {suite.description && (
                  <div className="ts-card-desc">{suite.description}</div>
                )}
                {suite.tags.length > 0 && (
                  <div className="ts-card-tags">
                    {suite.tags.map((tag) => (
                      <span key={tag.id} className="tag-badge">{tag.name}</span>
                    ))}
                  </div>
                )}
                <div className="ts-card-meta">
                  Created {new Date(suite.createdAt).toLocaleDateString()}
                  {suite.createdByName && ` by ${suite.createdByName}`}
                  {suite.updatedByName && suite.updatedBy !== suite.createdBy && (
                    <> · Updated {new Date(suite.updatedAt).toLocaleDateString()} by {suite.updatedByName}</>
                  )}
                </div>
              </div>
              <div className="ts-card-actions">
                <Button
                  variant="icon"
                  title="Edit"
                  onClick={() => startEdit(suite)}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </Button>
                {deleteConfirmId === suite.id ? (
                  <div className="ts-delete-confirm">
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => handleDelete(suite.id)}
                    >
                      Confirm
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteConfirmId(null)}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="icon-danger"
                    title="Delete"
                    onClick={() => setDeleteConfirmId(suite.id)}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                      <path d="M10 11v6" />
                      <path d="M14 11v6" />
                      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                    </svg>
                  </Button>
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