import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import type { Tag } from "@coglity/shared";
import { testCaseService, type TestCaseWithTags } from "../services/testCaseService";
import { tagService } from "../services/tagService";

const testCaseFormSchema = yup.object({
  title: yup.string().required("Title is required").max(255),
  preCondition: yup.string().max(10000).default(""),
  testSteps: yup.string().max(10000).default(""),
  expectedResults: yup.string().max(10000).default(""),
  data: yup.string().max(10000).default(""),
});

type FormValues = yup.InferType<typeof testCaseFormSchema>;

export function TestCaseDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [tc, setTc] = useState<TestCaseWithTags | null>(null);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isValid },
  } = useForm<FormValues>({
    resolver: yupResolver(testCaseFormSchema),
    mode: "onChange",
    defaultValues: { title: "", preCondition: "", testSteps: "", expectedResults: "", data: "" },
  });

  useEffect(() => {
    if (!id) return;
    Promise.all([
      testCaseService.getById(id),
      tagService.getAll(),
    ]).then(([tcData, tagsData]) => {
      setTc(tcData);
      setAllTags(Array.isArray(tagsData) ? tagsData : []);
      populateFields(tcData);
    }).catch(() => {
      navigate("/test-cases");
    }).finally(() => {
      setLoading(false);
    });
  }, [id]);

  const populateFields = (d: TestCaseWithTags) => {
    reset({
      title: d.title,
      preCondition: d.preCondition,
      testSteps: d.testSteps,
      expectedResults: d.expectedResults,
      data: d.data,
    });
    setSelectedTagIds(d.tags.map((t) => t.id));
  };

  const startEdit = () => {
    if (tc) populateFields(tc);
    setEditing(true);
  };

  const cancelEdit = () => {
    if (tc) populateFields(tc);
    setEditing(false);
  };

  const onSubmit = async (formData: FormValues) => {
    if (!id) return;
    const updated = await testCaseService.update(id, {
      title: formData.title,
      preCondition: formData.preCondition,
      testSteps: formData.testSteps,
      data: formData.data,
      expectedResults: formData.expectedResults,
      tagIds: selectedTagIds,
    });
    setTc(updated);
    setEditing(false);
  };

  const handleDelete = async () => {
    if (!id) return;
    await testCaseService.remove(id);
    navigate("/test-cases");
  };

  const toggleTag = (tagId: string) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((i) => i !== tagId) : [...prev, tagId],
    );
  };

  if (loading) {
    return <div className="page-test-suites"><p className="ts-empty">Loading...</p></div>;
  }

  if (!tc) {
    return <div className="page-test-suites"><p className="ts-empty">Test case not found.</p></div>;
  }

  return (
    <div className="tc-detail">
      {/* Header */}
      <div className="tc-detail-header">
        <div className="tc-detail-header-left">
          <button className="btn btn-ghost tc-back-btn" onClick={() => navigate("/test-cases")}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Back
          </button>
          {editing ? (
            <input
              className="tc-detail-title-input"
              type="text"
              autoFocus
              {...register("title")}
            />
          ) : (
            <h1 className="tc-detail-title">
              {tc.title}
              {tc.status === "draft" && <span className="status-badge status-draft">Draft</span>}
              {tc.status === "active" && <span className="status-badge status-active">Active</span>}
            </h1>
          )}
          {errors.title && <span className="ts-form-error">{errors.title.message}</span>}
        </div>
        <div className="tc-detail-header-actions">
          {deleteConfirm ? (
            <div className="ts-delete-confirm">
              <button className="btn btn-danger-sm" onClick={handleDelete}>Confirm</button>
              <button className="btn btn-ghost-sm" onClick={() => setDeleteConfirm(false)}>Cancel</button>
            </div>
          ) : (
            <button className="btn btn-danger" onClick={() => setDeleteConfirm(true)}>Delete</button>
          )}
          {tc.status === "draft" && !editing && (
            <button
              className="btn btn-primary"
              style={{ background: "#059669" }}
              onClick={async () => {
                if (!id) return;
                const updated = await testCaseService.update(id, {
                  title: tc.title,
                  preCondition: tc.preCondition,
                  testSteps: tc.testSteps,
                  data: tc.data,
                  expectedResults: tc.expectedResults,
                  tagIds: selectedTagIds,
                  status: "active",
                });
                setTc(updated);
              }}
            >
              Mark Active
            </button>
          )}
          {editing ? (
            <>
              <button className="btn btn-ghost" onClick={cancelEdit}>Cancel</button>
              <button
                className="btn btn-primary"
                onClick={handleSubmit(onSubmit)}
                disabled={isSubmitting || !isValid}
              >
                {isSubmitting ? "Saving..." : "Save"}
              </button>
            </>
          ) : (
            <button className="btn btn-primary" onClick={startEdit}>Edit</button>
          )}
        </div>
      </div>

      {/* Metadata */}
      <div className="tc-detail-meta">
        {editing ? (
          <div className="tc-detail-tag-picker">
            {allTags.length === 0 ? (
              <span className="ts-form-hint">No tags available.</span>
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
        ) : (
          tc.tags.length > 0 && (
            <div className="ts-card-tags">
              {tc.tags.map((tag) => (
                <span key={tag.id} className="tag-badge">{tag.name}</span>
              ))}
            </div>
          )
        )}
        <div className="tc-detail-meta-text">
          Suite: {tc.testSuiteName} · Created {new Date(tc.createdAt).toLocaleDateString()}
          {tc.createdByName && ` by ${tc.createdByName}`}
          {tc.updatedByName && (
            <> · Updated {new Date(tc.updatedAt).toLocaleDateString()} by {tc.updatedByName}</>
          )}
        </div>
      </div>

      {/* Pre Condition */}
      <div className="tc-detail-section" style={{ marginBottom: "16px" }}>
        <label className="tc-detail-label">Pre Condition</label>
        {editing ? (
          <textarea
            className="tc-detail-textarea"
            placeholder="Enter pre conditions..."
            {...register("preCondition")}
          />
        ) : (
          <div className="tc-detail-content">
            {tc.preCondition || <span className="tc-detail-placeholder">No pre conditions defined.</span>}
          </div>
        )}
        {errors.preCondition && <span className="ts-form-error">{errors.preCondition.message}</span>}
      </div>

      {/* Content grid: Test Steps (left tall), Expected Results + Data (right stacked) */}
      <div className="tc-detail-grid">
        <div className="tc-detail-left">
          <div className="tc-detail-section">
            <label className="tc-detail-label">Test Steps</label>
            {editing ? (
              <textarea
                className="tc-detail-textarea tc-detail-textarea-tall"
                placeholder="Enter test steps..."
                {...register("testSteps")}
              />
            ) : (
              <div className="tc-detail-content tc-detail-content-tall">
                {tc.testSteps || <span className="tc-detail-placeholder">No test steps defined.</span>}
              </div>
            )}
            {errors.testSteps && <span className="ts-form-error">{errors.testSteps.message}</span>}
          </div>
        </div>
        <div className="tc-detail-right">
          <div className="tc-detail-section">
            <label className="tc-detail-label">Expected Results</label>
            {editing ? (
              <textarea
                className="tc-detail-textarea"
                placeholder="Enter expected results..."
                {...register("expectedResults")}
              />
            ) : (
              <div className="tc-detail-content">
                {tc.expectedResults || <span className="tc-detail-placeholder">No expected results defined.</span>}
              </div>
            )}
            {errors.expectedResults && <span className="ts-form-error">{errors.expectedResults.message}</span>}
          </div>
          <div className="tc-detail-section">
            <label className="tc-detail-label">Data</label>
            {editing ? (
              <textarea
                className="tc-detail-textarea"
                placeholder="Enter test data..."
                {...register("data")}
              />
            ) : (
              <div className="tc-detail-content">
                {tc.data || <span className="tc-detail-placeholder">No test data defined.</span>}
              </div>
            )}
            {errors.data && <span className="ts-form-error">{errors.data.message}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}