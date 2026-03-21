import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import { tagService, type TagWithUsers } from "../services/tagService";

const tagFormSchema = yup.object({
  name: yup.string().required("Name is required").max(255),
  description: yup.string().max(2000).default(""),
});

type FormValues = yup.InferType<typeof tagFormSchema>;

export function Tags() {
  const [tags, setTags] = useState<TagWithUsers[]>([]);
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
    resolver: yupResolver(tagFormSchema),
    mode: "onChange",
    defaultValues: { name: "", description: "" },
  });

  const fetchTags = async () => {
    try {
      const data = await tagService.getAll();
      setTags(Array.isArray(data) ? data : []);
    } catch {
      setTags([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTags();
  }, []);

  const closeForm = () => {
    reset({ name: "", description: "" });
    setEditingId(null);
    setShowForm(false);
  };

  const onSubmit = async (data: FormValues) => {
    if (editingId) {
      await tagService.update(editingId, data);
    } else {
      await tagService.create(data);
    }
    closeForm();
    fetchTags();
  };

  const startEdit = (tag: TagWithUsers) => {
    reset({ name: tag.name, description: tag.description });
    setEditingId(tag.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    await tagService.remove(id);
    setDeleteConfirmId(null);
    fetchTags();
  };

  return (
    <div className="page-test-suites">
      <div className="page-header">
        <h1>Tags</h1>
        {!showForm && (
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>
            + New Tag
          </button>
        )}
      </div>

      {showForm && (
        <form className="ts-form" onSubmit={handleSubmit(onSubmit)}>
          <div className="ts-form-title">
            {editingId ? "Edit Tag" : "Create Tag"}
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
      ) : tags.length === 0 && !showForm ? (
        <div className="ts-empty-state">
          <div className="ts-empty-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
              <line x1="7" y1="7" x2="7.01" y2="7" />
            </svg>
          </div>
          <p>No tags yet</p>
          <span>Create your first tag to get started</span>
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
                  Created {new Date(tag.createdAt).toLocaleDateString()}
                  {tag.createdByName && ` by ${tag.createdByName}`}
                  {tag.updatedByName && tag.updatedBy !== tag.createdBy && (
                    <> · Updated {new Date(tag.updatedAt).toLocaleDateString()} by {tag.updatedByName}</>
                  )}
                </div>
              </div>
              <div className="ts-card-actions">
                <button
                  className="btn btn-icon"
                  title="Edit"
                  onClick={() => startEdit(tag)}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </button>
                {deleteConfirmId === tag.id ? (
                  <div className="ts-delete-confirm">
                    <button
                      className="btn btn-danger-sm"
                      onClick={() => handleDelete(tag.id)}
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
                    onClick={() => setDeleteConfirmId(tag.id)}
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
