import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import type { Tag } from "@coglity/shared";
import { bugService, type BugWithDetails } from "../services/bugService";
import { tagService } from "../services/tagService";
import { userService, type UserOption } from "../services/userService";
import { Button } from "../components/ui/Button";
import { Select } from "../components/ui/Select";
import { useSetBreadcrumbs } from "../context/BreadcrumbsContext";
import { useCurrentOrg } from "../context/OrgContext";

const bugFormSchema = yup.object({
  title: yup.string().required("Title is required").max(255),
  description: yup.string().max(50000).default(""),
  bugType: yup.string().required(),
  priority: yup.string().required(),
  severity: yup.string().required(),
  state: yup.string().required(),
  resolution: yup.string().required(),
  reproducibility: yup.string().required(),
});

type FormValues = yup.InferType<typeof bugFormSchema>;

const PRIORITY_LABELS: Record<string, string> = { critical: "Critical", high: "High", medium: "Medium", low: "Low" };
const SEVERITY_LABELS: Record<string, string> = { blocker: "Blocker", critical: "Critical", major: "Major", minor: "Minor", trivial: "Trivial" };
const BUG_TYPE_LABELS: Record<string, string> = { functional: "Functional", performance: "Performance", security: "Security", usability: "Usability", compatibility: "Compatibility", regression: "Regression", other: "Other" };
const STATE_LABELS: Record<string, string> = { new: "New", open: "Open", in_progress: "In Progress", resolved: "Resolved", closed: "Closed", reopened: "Reopened" };
const RESOLUTION_LABELS: Record<string, string> = { unresolved: "Unresolved", fixed: "Fixed", wont_fix: "Won't Fix", duplicate: "Duplicate", cannot_reproduce: "Cannot Reproduce", by_design: "By Design" };
const REPRODUCIBILITY_LABELS: Record<string, string> = { always: "Always", sometimes: "Sometimes", rare: "Rare", unable: "Unable" };

export function BugDetail() {
  const { id, projectId } = useParams<{ id: string; projectId: string }>();
  const navigate = useNavigate();
  const { org } = useCurrentOrg();
  useSetBreadcrumbs([{ label: "Bugs", to: "/bugs" }, { label: "Bug detail" }]);

  const [bug, setBug] = useState<BugWithDetails | null>(null);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [allUsers, setAllUsers] = useState<UserOption[]>([]);
  const [assignedTo, setAssignedTo] = useState<string>("");
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [addingComment, setAddingComment] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting, isValid },
  } = useForm<FormValues>({
    resolver: yupResolver(bugFormSchema),
    mode: "onChange",
  });

  useEffect(() => {
    if (!id || !projectId || !org) return;
    Promise.all([
      bugService.getById(org.organizationId, projectId, id),
      tagService.getAll(org.organizationId, [projectId]),
      userService.getAll(org.organizationId, projectId),
    ]).then(([bugData, tagsData, usersData]) => {
      setBug(bugData);
      setAllTags(Array.isArray(tagsData) ? tagsData : []);
      setAllUsers(Array.isArray(usersData) ? usersData : []);
      populateFields(bugData);
    }).catch(() => {
      navigate("/bugs");
    }).finally(() => {
      setLoading(false);
    });
  }, [id, projectId, org]);

  const populateFields = (d: BugWithDetails) => {
    reset({
      title: d.title,
      description: d.description,
      bugType: d.bugType,
      priority: d.priority,
      severity: d.severity,
      state: d.state,
      resolution: d.resolution,
      reproducibility: d.reproducibility,
    });
    setSelectedTagIds((d.tags ?? []).map((t) => t.id));
    setAssignedTo(d.assignedTo ?? "");
  };

  const startEdit = () => {
    if (bug) populateFields(bug);
    setEditing(true);
  };

  const cancelEdit = () => {
    if (bug) populateFields(bug);
    setEditing(false);
  };

  const onSubmit = async (formData: FormValues) => {
    if (!id) return;
    if (!projectId || !org) return;
    const updated = await bugService.update(org.organizationId, projectId, id, {
      ...formData,
      assignedTo: assignedTo || null,
      tagIds: selectedTagIds,
    });
    setBug(updated);
    setEditing(false);
  };

  const handleDelete = async () => {
    if (!id) return;
    if (!projectId || !org) return;
    await bugService.remove(org.organizationId, projectId, id);
    navigate("/bugs");
  };

  const handleAddComment = async () => {
    if (!id || !commentText.trim()) return;
    setAddingComment(true);
    try {
      if (!projectId || !org) return;
      const updated = await bugService.addComment(org.organizationId, projectId, id, commentText.trim());
      setBug(updated);
      setCommentText("");
    } finally {
      setAddingComment(false);
    }
  };

  const toggleTag = (tagId: string) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((i) => i !== tagId) : [...prev, tagId],
    );
  };

  if (loading) return <div className="page-test-suites"><p className="ts-empty">Loading...</p></div>;
  if (!bug) return <div className="page-test-suites"><p className="ts-empty">Bug not found.</p></div>;

  return (
    <div className="tc-detail">
      {/* Header */}
      <div className="tc-detail-header">
        <div className="tc-detail-header-left">
          <Button variant="ghost" className="tc-back-btn" onClick={() => navigate("/bugs")}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Back
          </Button>
          {editing ? (
            <input className="tc-detail-title-input" type="text" autoFocus {...register("title")} />
          ) : (
            <h1 className="tc-detail-title">
              {bug.title}
              <span className={`status-badge status-${bug.state}`}>{STATE_LABELS[bug.state] ?? bug.state}</span>
            </h1>
          )}
          {errors.title && <span className="ts-form-error">{errors.title.message}</span>}
        </div>
        <div className="tc-detail-header-actions">
          {deleteConfirm ? (
            <div className="ts-delete-confirm">
              <Button variant="danger" size="sm" onClick={handleDelete}>Confirm</Button>
              <Button variant="ghost" size="sm" onClick={() => setDeleteConfirm(false)}>Cancel</Button>
            </div>
          ) : (
            <Button variant="danger" onClick={() => setDeleteConfirm(true)}>Delete</Button>
          )}
          {editing ? (
            <>
              <Button variant="ghost" onClick={cancelEdit}>Cancel</Button>
              <Button onClick={handleSubmit(onSubmit)} disabled={isSubmitting || !isValid}>
                {isSubmitting ? "Saving..." : "Save"}
              </Button>
            </>
          ) : (
            <Button onClick={startEdit}>Edit</Button>
          )}
        </div>
      </div>

      {/* Metadata badges */}
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
          (bug.tags?.length ?? 0) > 0 && (
            <div className="ts-card-tags">
              {(bug.tags ?? []).map((tag) => (
                <span key={tag.id} className="tag-badge">{tag.name}</span>
              ))}
            </div>
          )
        )}
        <div className="tc-detail-meta-text">
          Created {new Date(bug.createdAt).toLocaleDateString()}
          {bug.createdByName && ` by ${bug.createdByName}`}
          {bug.assignedToName && <> · Assigned to {bug.assignedToName}</>}
        </div>
      </div>

      {/* Properties grid */}
      <div className="bug-detail-props" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "16px", marginBottom: "24px" }}>
        <div className="tc-detail-section">
          <label className="tc-detail-label">Bug Type</label>
          {editing ? (
            <Select
              value={{ value: watch("bugType"), label: BUG_TYPE_LABELS[watch("bugType")] ?? "" }}
              onChange={(opt) => setValue("bugType", opt?.value ?? "functional", { shouldValidate: true })}
              options={Object.entries(BUG_TYPE_LABELS).map(([val, label]) => ({ value: val, label }))}
            />
          ) : (
            <div className="tc-detail-content"><span className={`bug-badge bug-type`}>{BUG_TYPE_LABELS[bug.bugType] ?? bug.bugType}</span></div>
          )}
        </div>
        <div className="tc-detail-section">
          <label className="tc-detail-label">Priority</label>
          {editing ? (
            <Select
              value={{ value: watch("priority"), label: PRIORITY_LABELS[watch("priority")] ?? "" }}
              onChange={(opt) => setValue("priority", opt?.value ?? "medium", { shouldValidate: true })}
              options={Object.entries(PRIORITY_LABELS).map(([val, label]) => ({ value: val, label }))}
            />
          ) : (
            <div className="tc-detail-content"><span className={`bug-badge priority-${bug.priority}`}>{PRIORITY_LABELS[bug.priority] ?? bug.priority}</span></div>
          )}
        </div>
        <div className="tc-detail-section">
          <label className="tc-detail-label">Severity</label>
          {editing ? (
            <Select
              value={{ value: watch("severity"), label: SEVERITY_LABELS[watch("severity")] ?? "" }}
              onChange={(opt) => setValue("severity", opt?.value ?? "major", { shouldValidate: true })}
              options={Object.entries(SEVERITY_LABELS).map(([val, label]) => ({ value: val, label }))}
            />
          ) : (
            <div className="tc-detail-content"><span className={`bug-badge severity-${bug.severity}`}>{SEVERITY_LABELS[bug.severity] ?? bug.severity}</span></div>
          )}
        </div>
        <div className="tc-detail-section">
          <label className="tc-detail-label">State</label>
          {editing ? (
            <Select
              value={{ value: watch("state"), label: STATE_LABELS[watch("state")] ?? "" }}
              onChange={(opt) => setValue("state", opt?.value ?? "new", { shouldValidate: true })}
              options={Object.entries(STATE_LABELS).map(([val, label]) => ({ value: val, label }))}
            />
          ) : (
            <div className="tc-detail-content"><span className={`status-badge status-${bug.state}`}>{STATE_LABELS[bug.state] ?? bug.state}</span></div>
          )}
        </div>
        <div className="tc-detail-section">
          <label className="tc-detail-label">Resolution</label>
          {editing ? (
            <Select
              value={{ value: watch("resolution"), label: RESOLUTION_LABELS[watch("resolution")] ?? "" }}
              onChange={(opt) => setValue("resolution", opt?.value ?? "unresolved", { shouldValidate: true })}
              options={Object.entries(RESOLUTION_LABELS).map(([val, label]) => ({ value: val, label }))}
            />
          ) : (
            <div className="tc-detail-content">{RESOLUTION_LABELS[bug.resolution] ?? bug.resolution}</div>
          )}
        </div>
        <div className="tc-detail-section">
          <label className="tc-detail-label">Reproducibility</label>
          {editing ? (
            <Select
              value={{ value: watch("reproducibility"), label: REPRODUCIBILITY_LABELS[watch("reproducibility")] ?? "" }}
              onChange={(opt) => setValue("reproducibility", opt?.value ?? "always", { shouldValidate: true })}
              options={Object.entries(REPRODUCIBILITY_LABELS).map(([val, label]) => ({ value: val, label }))}
            />
          ) : (
            <div className="tc-detail-content">{REPRODUCIBILITY_LABELS[bug.reproducibility] ?? bug.reproducibility}</div>
          )}
        </div>
        <div className="tc-detail-section">
          <label className="tc-detail-label">Assigned To</label>
          {editing ? (
            <Select
              value={assignedTo ? { value: assignedTo, label: allUsers.find((u) => u.id === assignedTo)?.displayName ?? "" } : null}
              onChange={(opt) => setAssignedTo(opt?.value ?? "")}
              options={allUsers.map((u) => ({ value: u.id, label: u.displayName }))}
              placeholder="Unassigned"
              isClearable
            />
          ) : (
            <div className="tc-detail-content">{bug.assignedToName ?? "Unassigned"}</div>
          )}
        </div>
      </div>

      {/* Description */}
      <div className="tc-detail-section" style={{ marginBottom: "24px" }}>
        <label className="tc-detail-label">Description</label>
        {editing ? (
          <textarea
            className="tc-detail-textarea tc-detail-textarea-tall"
            placeholder="Describe the bug..."
            {...register("description")}
          />
        ) : (
          <div className="tc-detail-content tc-detail-content-tall">
            {bug.description || <span className="tc-detail-placeholder">No description provided.</span>}
          </div>
        )}
        {errors.description && <span className="ts-form-error">{errors.description.message}</span>}
      </div>

      {/* Comments */}
      <div className="tc-detail-section">
        <label className="tc-detail-label">Comments ({bug.comments?.length ?? 0})</label>
        <div className="bug-comments" style={{ marginBottom: "12px" }}>
          {(!bug.comments || bug.comments.length === 0) ? (
            <div className="tc-detail-content">
              <span className="tc-detail-placeholder">No comments yet.</span>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {bug.comments.map((comment) => (
                <div key={comment.id} className="bug-comment" style={{
                  padding: "12px",
                  borderRadius: "8px",
                  background: "var(--color-surface-2, #f5f5f5)",
                  border: "1px solid var(--color-border, #e0e0e0)",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px", fontSize: "12px", color: "var(--color-text-secondary, #666)" }}>
                    <span style={{ fontWeight: 600 }}>{comment.createdByName ?? "Unknown"}</span>
                    <span>{new Date(comment.createdAt).toLocaleString()}</span>
                  </div>
                  <div style={{ whiteSpace: "pre-wrap" }}>{comment.text}</div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <textarea
            className="tc-detail-textarea"
            placeholder="Add a comment..."
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            style={{ flex: 1, minHeight: "60px" }}
          />
          <Button
            style={{ alignSelf: "flex-end" }}
            onClick={handleAddComment}
            disabled={addingComment || !commentText.trim()}
          >
            {addingComment ? "Posting..." : "Post"}
          </Button>
        </div>
      </div>
    </div>
  );
}