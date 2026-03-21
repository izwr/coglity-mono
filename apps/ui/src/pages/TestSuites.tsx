import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import type { Tag } from "@coglity/shared";
import { testSuiteService, type TestSuiteWithTags } from "../services/testSuiteService";
import { tagService } from "../services/tagService";

const testSuiteFormSchema = yup.object({
  name: yup.string().required("Name is required").max(255),
  description: yup.string().max(2000).default(""),
});

type FormValues = yup.InferType<typeof testSuiteFormSchema>;

export function TestSuites() {
  const [suites, setSuites] = useState<TestSuiteWithTags[]>([]);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

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

  const fetchSuites = async () => {
    try {
      const data = await testSuiteService.getAll();
      setSuites(Array.isArray(data) ? data : []);
    } catch {
      setSuites([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchTags = async () => {
    try {
      const data = await tagService.getAll();
      setAllTags(Array.isArray(data) ? data : []);
    } catch {
      setAllTags([]);
    }
  };

  useEffect(() => {
    fetchSuites();
    fetchTags();
  }, []);

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

  return (
    <div className="page-test-suites">
      <div className="page-header">
        <h1>Test Suites</h1>
        {!showForm && (
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>
            + New Test Suite
          </button>
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
            <button type="button" className="btn btn-ghost" onClick={closeForm}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={!isValid || isSubmitting}>
              {editingId ? "Update" : "Create"}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="ts-empty">Loading...</p>
      ) : suites.length === 0 && !showForm ? (
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
                <button
                  className="btn btn-icon"
                  title="Edit"
                  onClick={() => startEdit(suite)}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </button>
                {deleteConfirmId === suite.id ? (
                  <div className="ts-delete-confirm">
                    <button
                      className="btn btn-danger-sm"
                      onClick={() => handleDelete(suite.id)}
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
                    className="btn btn-icon btn-icon-danger"
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
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
