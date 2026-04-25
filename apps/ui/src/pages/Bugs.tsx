import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import type { Tag } from "@coglity/shared";
import { bugService, type BugWithDetails } from "../services/bugService";
import { tagService } from "../services/tagService";
import { userService, type UserOption } from "../services/userService";
import { ProjectFilter, useSelectedProjectIds } from "../components/ProjectFilter";
import { ProjectPickerField, useWritableProjects } from "../components/ProjectPickerField";
import { useCurrentOrg } from "../context/OrgContext";
import { ListToolbar, type AppliedFilters } from "../components/ListToolbar";
import { Button } from "../components/ui/Button";
import { Select } from "../components/ui/Select";
import { PageHead } from "../components/ui/PageHead";
import { useSetBreadcrumbs } from "../context/BreadcrumbsContext";

const createBugSchema = yup.object({
  title: yup.string().required("Title is required").max(255),
  bugType: yup.string().required("Bug type is required"),
  priority: yup.string().required("Priority is required"),
  severity: yup.string().required("Severity is required"),
});

type CreateFormValues = yup.InferType<typeof createBugSchema>;

const PAGE_SIZE = 10;

const SORT_OPTIONS = [
  { label: "Newest first", field: "createdAt", dir: "desc" as const },
  { label: "Oldest first", field: "createdAt", dir: "asc" as const },
  { label: "Title A-Z", field: "title", dir: "asc" as const },
  { label: "Title Z-A", field: "title", dir: "desc" as const },
  { label: "Recently updated", field: "updatedAt", dir: "desc" as const },
  { label: "Priority", field: "priority", dir: "asc" as const },
  { label: "Severity", field: "severity", dir: "asc" as const },
];

const STATE_TOGGLE = {
  options: [
    { value: "new", label: "New", activeClass: "state-new-selected" },
    { value: "open", label: "Open", activeClass: "state-open-selected" },
    { value: "in_progress", label: "In Progress", activeClass: "state-progress-selected" },
    { value: "resolved", label: "Resolved", activeClass: "state-resolved-selected" },
    { value: "closed", label: "Closed", activeClass: "state-closed-selected" },
  ],
};

const PRIORITY_LABELS: Record<string, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

const SEVERITY_LABELS: Record<string, string> = {
  blocker: "Blocker",
  critical: "Critical",
  major: "Major",
  minor: "Minor",
  trivial: "Trivial",
};

const BUG_TYPE_LABELS: Record<string, string> = {
  functional: "Functional",
  performance: "Performance",
  security: "Security",
  usability: "Usability",
  compatibility: "Compatibility",
  regression: "Regression",
  other: "Other",
};

const STATE_LABELS: Record<string, string> = {
  new: "New",
  open: "Open",
  in_progress: "In Progress",
  resolved: "Resolved",
  closed: "Closed",
  reopened: "Reopened",
};

export function Bugs() {
  useSetBreadcrumbs([{ label: "Bugs" }]);
  const navigate = useNavigate();
  const { org } = useCurrentOrg();
  const projectIds = useSelectedProjectIds();
  const writable = useWritableProjects();
  const [formProjectId, setFormProjectId] = useState<string>("");
  const [bugsList, setBugsList] = useState<BugWithDetails[]>([]);
  const [total, setTotal] = useState(0);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [allUsers, setAllUsers] = useState<UserOption[]>([]);
  const [assignedTo, setAssignedTo] = useState<string>("");
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [initialLoad, setInitialLoad] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const [filters, setFilters] = useState<AppliedFilters>({
    search: "", tagId: "", sortBy: "createdAt", sortDir: "desc", status: "",
  });
  const [page, setPage] = useState(1);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting, isValid },
  } = useForm<CreateFormValues>({
    resolver: yupResolver(createBugSchema),
    mode: "onChange",
    defaultValues: { title: "", bugType: "functional", priority: "medium", severity: "major" },
  });

  const fetchBugs = useCallback(async () => {
    if (!org) return;
    setLoading(true);
    try {
      const res = await bugService.getAll(org.organizationId, projectIds, {
        search: filters.search || undefined,
        state: filters.status || undefined,
        sortBy: filters.sortBy,
        sortDir: filters.sortDir,
        page,
        limit: PAGE_SIZE,
      });
      setBugsList(res.data);
      setTotal(res.total);
    } catch {
      setBugsList([]);
      setTotal(0);
    } finally {
      setLoading(false);
      setInitialLoad(false);
    }
  }, [org, projectIds, filters, page]);

  useEffect(() => {
    if (!org) return;
    tagService.getAll(org.organizationId, projectIds).then((data) => setAllTags(Array.isArray(data) ? data : [])).catch(() => setAllTags([]));
    if (formProjectId) {
      userService.getAll(org.organizationId, formProjectId).then((data) => setAllUsers(Array.isArray(data) ? data : [])).catch(() => setAllUsers([]));
    } else {
      setAllUsers([]);
    }
  }, [org, projectIds, formProjectId]);

  useEffect(() => {
    fetchBugs();
  }, [fetchBugs]);

  const handleApplyFilters = (applied: AppliedFilters) => {
    setFilters(applied);
    setPage(1);
  };

  const closeForm = () => {
    reset({ title: "", bugType: "functional", priority: "medium", severity: "major" });
    setSelectedTagIds([]);
    setAssignedTo("");
    setFormProjectId("");
    setShowForm(false);
  };

  const openCreate = () => {
    reset({ title: "", bugType: "functional", priority: "medium", severity: "major" });
    setSelectedTagIds([]);
    setAssignedTo("");
    setFormProjectId(writable[0]?.projectId ?? "");
    setShowForm(true);
  };

  const onSubmit = async (data: CreateFormValues) => {
    if (!org || !formProjectId) return;
    const created = await bugService.create(org.organizationId, formProjectId, {
      title: data.title,
      bugType: data.bugType,
      priority: data.priority,
      severity: data.severity,
      assignedTo: assignedTo || undefined,
      tagIds: selectedTagIds,
    });
    closeForm();
    navigate(`/bugs/${formProjectId}/${created.id}`);
  };

  const handleDelete = async (bug: BugWithDetails) => {
    if (!org) return;
    await bugService.remove(org.organizationId, bug.projectId, bug.id);
    setDeleteConfirmId(null);
    fetchBugs();
  };

  const toggleTag = (tagId: string) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((i) => i !== tagId) : [...prev, tagId],
    );
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasFilters = !!(filters.search || filters.tagId || filters.status);

  return (
    <div className="page wide">
      <PageHead
        title={<>Bug <em className="italic-teal">tracker</em></>}
        subtitle={<>{total} bug{total !== 1 ? "s" : ""} · triage, assign and close</>}
        actions={!showForm && (
          <Button
            variant="primary"
            disabled={writable.length === 0}
            title={writable.length === 0 ? "You don't have write access to any project in this organization" : undefined}
            onClick={openCreate}
          >
            <svg className="ico" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg>
            Report bug
          </Button>
        )}
      />

      <div style={{ marginBottom: 16 }}>
        <ProjectFilter placeholder="Filter by project pick one or more…" />
      </div>

      {showForm && (
        <form className="ts-form" onSubmit={handleSubmit(onSubmit)}>
          <div className="ts-form-title">Report Bug</div>
          <div className="ts-form-field">
            <label htmlFor="bug-project">Project</label>
            <ProjectPickerField id="bug-project" value={formProjectId} onChange={setFormProjectId} required />
          </div>
          <div className="ts-form-field">
            <label htmlFor="bug-title">Title</label>
            <input id="bug-title" type="text" placeholder="Enter bug title" autoFocus {...register("title")} />
            {errors.title && <span className="ts-form-error">{errors.title.message}</span>}
          </div>
          <div className="ts-form-row" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
            <div className="ts-form-field">
              <label htmlFor="bug-type">Bug Type</label>
              <Select
                value={{ value: watch("bugType"), label: BUG_TYPE_LABELS[watch("bugType")] ?? "" }}
                onChange={(opt) => setValue("bugType", opt?.value ?? "functional", { shouldValidate: true })}
                options={Object.entries(BUG_TYPE_LABELS).map(([val, label]) => ({ value: val, label }))}
                placeholder="Bug Type"
              />
            </div>
            <div className="ts-form-field">
              <label htmlFor="bug-priority">Priority</label>
              <Select
                value={{ value: watch("priority"), label: PRIORITY_LABELS[watch("priority")] ?? "" }}
                onChange={(opt) => setValue("priority", opt?.value ?? "medium", { shouldValidate: true })}
                options={Object.entries(PRIORITY_LABELS).map(([val, label]) => ({ value: val, label }))}
                placeholder="Priority"
              />
            </div>
            <div className="ts-form-field">
              <label htmlFor="bug-severity">Severity</label>
              <Select
                value={{ value: watch("severity"), label: SEVERITY_LABELS[watch("severity")] ?? "" }}
                onChange={(opt) => setValue("severity", opt?.value ?? "major", { shouldValidate: true })}
                options={Object.entries(SEVERITY_LABELS).map(([val, label]) => ({ value: val, label }))}
                placeholder="Severity"
              />
            </div>
          </div>
          <div className="ts-form-field">
            <label>Assigned To</label>
            <Select
              value={assignedTo ? { value: assignedTo, label: allUsers.find((u) => u.id === assignedTo)?.displayName ?? "" } : null}
              onChange={(opt) => setAssignedTo(opt?.value ?? "")}
              options={allUsers.map((u) => ({ value: u.id, label: u.displayName }))}
              placeholder="Unassigned"
              isClearable
            />
          </div>
          <div className="ts-form-field">
            <label>Tags</label>
            {allTags.length === 0 ? (
              <p className="ts-form-hint">No tags available.</p>
            ) : (
              <div className="tag-picker">
                {allTags.map((tag) => (
                  <button
                    key={tag.id}
                    type="button"
                    className={`chip-btn${selectedTagIds.includes(tag.id) ? " selected" : ""}`}
                    onClick={() => toggleTag(tag.id)}
                  >
                    {tag.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="ts-form-actions">
            <Button type="button" variant="ghost" onClick={closeForm}>Cancel</Button>
            <Button type="submit" disabled={!isValid || isSubmitting || !formProjectId}>Create</Button>
          </div>
        </form>
      )}

      {initialLoad ? (
        <p className="ts-empty">Loading…</p>
      ) : total === 0 && !hasFilters && !showForm ? (
        <div className="empty">
          <div className="title">No bugs reported <em className="italic-teal">yet</em>.</div>
          <div className="sub">File bugs as you triage failing test runs to keep work moving.</div>
          <Button variant="primary" onClick={() => setShowForm(true)}>Report bug</Button>
        </div>
      ) : (
        <>
          <ListToolbar
            searchPlaceholder="Search bugs..."
            tags={allTags}
            sortOptions={SORT_OPTIONS}
            onApply={handleApplyFilters}
            statusToggle={STATE_TOGGLE}
          />

          {loading ? (
            <p className="ts-empty">Loading...</p>
          ) : bugsList.length === 0 ? (
            <p className="ts-empty">No bugs match your filters.</p>
          ) : (
            <div className="ts-list">
              {bugsList.map((bug) => (
                <div
                  key={bug.id}
                  className="ts-card"
                  style={{ cursor: "pointer" }}
                  onClick={() => navigate(`/bugs/${bug.projectId}/${bug.id}`)}
                >
                  <div className="ts-card-body">
                    <div className="ts-card-name">
                      {bug.title}
                      <span className={`status-badge status-${bug.state}`}>{STATE_LABELS[bug.state] ?? bug.state}</span>
                    </div>
                    <div className="ts-card-desc" style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                      <span className={`bug-badge priority-${bug.priority}`}>{PRIORITY_LABELS[bug.priority] ?? bug.priority}</span>
                      <span className={`bug-badge severity-${bug.severity}`}>{SEVERITY_LABELS[bug.severity] ?? bug.severity}</span>
                      <span className="bug-badge bug-type">{BUG_TYPE_LABELS[bug.bugType] ?? bug.bugType}</span>
                      {bug.assignedToName && <span className="bug-badge assigned">Assigned: {bug.assignedToName}</span>}
                    </div>
                    {(bug.tags?.length ?? 0) > 0 && (
                      <div className="ts-card-tags">
                        {(bug.tags ?? []).map((tag) => (
                          <span key={tag.id} className="tag-badge">{tag.name}</span>
                        ))}
                      </div>
                    )}
                    <div className="ts-card-meta">
                      Created {new Date(bug.createdAt).toLocaleDateString()}
                      {bug.createdByName && ` by ${bug.createdByName}`}
                    </div>
                  </div>
                  <div className="ts-card-actions" onClick={(e) => e.stopPropagation()}>
                    {deleteConfirmId === bug.id ? (
                      <div className="ts-delete-confirm">
                        <Button variant="danger" size="sm" onClick={() => handleDelete(bug)}>Confirm</Button>
                        <Button variant="ghost" size="sm" onClick={() => setDeleteConfirmId(null)}>Cancel</Button>
                      </div>
                    ) : (
                      <Button variant="danger" title="Delete" onClick={() => setDeleteConfirmId(bug.id)}>Delete</Button>
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