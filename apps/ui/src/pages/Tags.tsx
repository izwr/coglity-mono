import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import { tagService, type TagWithUsers } from "../services/tagService";
import { Button } from "../components/ui/Button";
import { PageHead } from "../components/ui/PageHead";
import { useSetBreadcrumbs } from "../context/BreadcrumbsContext";
import { ProjectFilter, useSelectedProjectIds } from "../components/ProjectFilter";
import { ProjectPickerField, useWritableProjects } from "../components/ProjectPickerField";
import { useCurrentOrg } from "../context/OrgContext";

const tagFormSchema = yup.object({
  name: yup.string().required("Name is required").max(255),
  description: yup.string().max(2000).default(""),
});

type FormValues = yup.InferType<typeof tagFormSchema>;

export function Tags() {
  useSetBreadcrumbs([{ label: "Tags" }]);
  const { org } = useCurrentOrg();
  const projectIds = useSelectedProjectIds();
  const writable = useWritableProjects();

  const [tags, setTags] = useState<TagWithUsers[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formProjectId, setFormProjectId] = useState<string>("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isValid },
  } = useForm<FormValues>({
    resolver: yupResolver(tagFormSchema),
    mode: "onChange",
    defaultValues: { name: "", description: "" },
  });

  const fetchTags = useCallback(async () => {
    if (!org) return;
    setLoading(true);
    try {
      const data = await tagService.getAll(org.organizationId, projectIds);
      setTags(Array.isArray(data) ? data : []);
    } catch {
      setTags([]);
    } finally {
      setLoading(false);
    }
  }, [org, projectIds]);

  useEffect(() => {
    fetchTags();
  }, [fetchTags]);

  const closeForm = () => {
    reset({ name: "", description: "" });
    setEditingId(null);
    setFormProjectId("");
    setShowForm(false);
  };

  const openCreate = () => {
    reset({ name: "", description: "" });
    setEditingId(null);
    setFormProjectId(writable[0]?.projectId ?? "");
    setShowForm(true);
  };

  const onSubmit = async (data: FormValues) => {
    if (!org || !formProjectId) return;
    if (editingId) {
      await tagService.update(org.organizationId, formProjectId, editingId, data);
    } else {
      await tagService.create(org.organizationId, formProjectId, data);
    }
    closeForm();
    fetchTags();
  };

  const startEdit = (tag: TagWithUsers) => {
    reset({ name: tag.name, description: tag.description });
    setEditingId(tag.id);
    setFormProjectId(tag.projectId);
    setShowForm(true);
  };

  const handleDelete = async (tag: TagWithUsers) => {
    if (!org) return;
    await tagService.remove(org.organizationId, tag.projectId, tag.id);
    setDeleteConfirmId(null);
    fetchTags();
  };

  const canCreate = writable.length > 0;

  return (
    <div className="page">
      <PageHead
        title={<><em className="italic-teal">Tags</em></>}
        subtitle="Organise cases, suites and bugs with shared tags."
        actions={!showForm && (
          <Button
            variant="primary"
            disabled={!canCreate}
            title={canCreate ? undefined : "You don't have write access to any project in this organization"}
            onClick={openCreate}
          >
            <svg className="ico" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg>
            New tag
          </Button>
        )}
      />

      <div style={{ marginBottom: 16 }}>
        <ProjectFilter placeholder="Filter by project pick one or more…" />
      </div>

      {showForm && (
        <form className="ts-form" onSubmit={handleSubmit(onSubmit)}>
          <div className="ts-form-title">
            {editingId ? "Edit Tag" : "Create Tag"}
          </div>
          <div className="ts-form-field">
            <label htmlFor="tag-project">Project</label>
            <ProjectPickerField
              id="tag-project"
              value={formProjectId}
              onChange={setFormProjectId}
              disabled={!!editingId}
              required
            />
          </div>
          <div className="ts-form-field">
            <label htmlFor="tag-name">Name</label>
            <input
              id="tag-name"
              type="text"
              placeholder="Enter tag name"
              autoFocus
              {...register("name")}
            />
            {errors.name && <span className="ts-form-error">{errors.name.message}</span>}
          </div>
          <div className="ts-form-field">
            <label htmlFor="tag-desc">Description</label>
            <textarea
              id="tag-desc"
              placeholder="Enter description (optional)"
              rows={3}
              {...register("description")}
            />
            {errors.description && <span className="ts-form-error">{errors.description.message}</span>}
          </div>
          <div className="ts-form-actions">
            <Button type="button" variant="ghost" onClick={closeForm}>Cancel</Button>
            <Button type="submit" disabled={!isValid || isSubmitting || !formProjectId}>
              {editingId ? "Update" : "Create"}
            </Button>
          </div>
        </form>
      )}

      {projectIds.length === 0 ? (
        <div className="empty">
          <div className="title">Pick a <em className="italic-teal">project</em> to see tags.</div>
          <div className="sub">Use the filter above to select one or more projects.</div>
        </div>
      ) : loading ? (
        <p className="ts-empty">Loading…</p>
      ) : tags.length === 0 && !showForm ? (
        <div className="empty">
          <div className="title">No <em className="italic-teal">tags</em> in the selected projects.</div>
          <div className="sub">{canCreate ? "Create the first one." : "You don't have write access to any project in this organization."}</div>
          {canCreate && <Button variant="primary" onClick={openCreate}>New tag</Button>}
        </div>
      ) : (
        <div className="ts-list">
          {tags.map((tag) => (
            <div key={tag.id} className="ts-card">
              <div className="ts-card-body">
                <div className="ts-card-name">{tag.name}</div>
                {tag.description && (
                  <div className="ts-card-desc">{tag.description}</div>
                )}
                <div className="ts-card-meta">
                  {tag.projectName && <>{tag.projectName} · </>}
                  Created {new Date(tag.createdAt).toLocaleDateString()}
                  {tag.createdByName && ` by ${tag.createdByName}`}
                  {tag.updatedByName && tag.updatedBy !== tag.createdBy && (
                    <> · Updated {new Date(tag.updatedAt).toLocaleDateString()} by {tag.updatedByName}</>
                  )}
                </div>
              </div>
              <div className="ts-card-actions">
                <Button variant="icon" title="Edit" onClick={() => startEdit(tag)}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </Button>
                {deleteConfirmId === tag.id ? (
                  <div className="ts-delete-confirm">
                    <Button variant="danger" size="sm" onClick={() => handleDelete(tag)}>Confirm</Button>
                    <Button variant="ghost" size="sm" onClick={() => setDeleteConfirmId(null)}>Cancel</Button>
                  </div>
                ) : (
                  <Button variant="icon-danger" title="Delete" onClick={() => setDeleteConfirmId(tag.id)}>
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
    </div>
  );
}
