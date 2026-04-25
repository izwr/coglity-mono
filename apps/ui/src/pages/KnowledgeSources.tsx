import { useEffect, useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import { knowledgeSourceService, type KnowledgeSourceWithUser } from "../services/knowledgeSourceService";
import { Button } from "../components/ui/Button";
import { PageHead } from "../components/ui/PageHead";
import { Tabs } from "../components/ui/Tabs";
import { useSetBreadcrumbs } from "../context/BreadcrumbsContext";
import { ProjectFilter, useSelectedProjectIds } from "../components/ProjectFilter";
import { ProjectPickerField, useWritableProjects } from "../components/ProjectPickerField";
import { useCurrentOrg } from "../context/OrgContext";

const SOURCE_TYPES = [
  { value: "pdf", label: "PDF" },
  { value: "screen", label: "Screen" },
  { value: "figma", label: "Figma" },
  { value: "url", label: "URL" },
];

const SOURCE_TYPE_ICONS: Record<string, React.ReactElement> = {
  pdf: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18 }}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  ),
  screen: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18 }}>
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  ),
  figma: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18 }}>
      <path d="M5 5.5A3.5 3.5 0 0 1 8.5 2H12v7H8.5A3.5 3.5 0 0 1 5 5.5z" />
      <path d="M12 2h3.5a3.5 3.5 0 1 1 0 7H12V2z" />
      <path d="M12 12.5a3.5 3.5 0 1 1 7 0 3.5 3.5 0 1 1-7 0z" />
      <path d="M5 19.5A3.5 3.5 0 0 1 8.5 16H12v3.5a3.5 3.5 0 1 1-7 0z" />
      <path d="M5 12.5A3.5 3.5 0 0 1 8.5 9H12v7H8.5A3.5 3.5 0 0 1 5 12.5z" />
    </svg>
  ),
  url: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18 }}>
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  ),
};

const createSchema = yup.object({
  name: yup.string().required("Name is required").max(255),
  sourceType: yup.string().required("Source type is required"),
  url: yup.string().max(2000).default(""),
  description: yup.string().max(2000).default(""),
});

type FormValues = yup.InferType<typeof createSchema>;

const PAGE_SIZE = 10;

export function KnowledgeSources() {
  useSetBreadcrumbs([{ label: "Knowledge" }]);
  const { org } = useCurrentOrg();
  const projectIds = useSelectedProjectIds();
  const writable = useWritableProjects();
  const [formProjectId, setFormProjectId] = useState<string>("");
  const [sources, setSources] = useState<KnowledgeSourceWithUser[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [initialLoad, setInitialLoad] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [filterType, setFilterType] = useState("");

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting, isValid },
  } = useForm<FormValues>({
    resolver: yupResolver(createSchema),
    mode: "onChange",
    defaultValues: { name: "", sourceType: "", url: "", description: "" },
  });

  const selectedSourceType = watch("sourceType");
  const supportsUpload = selectedSourceType === "pdf" || selectedSourceType === "screen" || selectedSourceType === "figma";
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string>("");
  const [isDragging, setIsDragging] = useState(false);

  const ACCEPT_MAP: Record<string, string> = {
    pdf: ".pdf",
    screen: "image/*",
    figma: ".fig",
  };

  const handleFileSelect = (file: File) => {
    setUploadedFile(file);
    setUploadedFileName(file.name);
    setValue("url", file.name, { shouldValidate: true });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  const fetchSources = useCallback(async () => {
    if (!org) return;
    setLoading(true);
    try {
      const res = await knowledgeSourceService.getAll(org.organizationId, projectIds, {
        sourceType: filterType || undefined,
        page,
        limit: PAGE_SIZE,
      });
      setSources(res.data);
      setTotal(res.total);
    } catch {
      setSources([]);
      setTotal(0);
    } finally {
      setLoading(false);
      setInitialLoad(false);
    }
  }, [org, projectIds, filterType, page]);

  useEffect(() => {
    fetchSources();
  }, [fetchSources]);

  const closeForm = () => {
    reset({ name: "", sourceType: "", url: "", description: "" });
    setUploadedFile(null);
    setUploadedFileName("");
    setEditingId(null);
    setFormProjectId("");
    setShowForm(false);
  };

  const openCreate = () => {
    reset({ name: "", sourceType: "", url: "", description: "" });
    setUploadedFile(null);
    setUploadedFileName("");
    setEditingId(null);
    setFormProjectId(writable[0]?.projectId ?? "");
    setShowForm(true);
  };

  const startEdit = (src: KnowledgeSourceWithUser) => {
    setEditingId(src.id);
    setFormProjectId(src.projectId);
    setValue("name", src.name, { shouldValidate: true });
    setValue("sourceType", src.sourceType, { shouldValidate: true });
    setValue("url", src.url || "", { shouldValidate: true });
    setValue("description", src.description || "", { shouldValidate: true });
    setShowForm(true);
  };

  const onSubmit = async (data: FormValues) => {
    const payload = {
      name: data.name,
      sourceType: data.sourceType as "pdf" | "screen" | "figma" | "url",
      url: data.url || "",
      description: data.description || "",
      file: uploadedFile ?? undefined,
    };

    if (!org || !formProjectId) return;
    if (editingId) {
      await knowledgeSourceService.update(org.organizationId, formProjectId, editingId, payload);
    } else {
      await knowledgeSourceService.create(org.organizationId, formProjectId, payload);
    }
    closeForm();
    fetchSources();
  };

  const handleDelete = async (src: KnowledgeSourceWithUser) => {
    if (!org) return;
    await knowledgeSourceService.remove(org.organizationId, src.projectId, src.id);
    setDeleteConfirmId(null);
    fetchSources();
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const sourceTypeLabel = (t: string) => SOURCE_TYPES.find((x) => x.value === t)?.label ?? t;

  const urlPlaceholder = watch("sourceType") === "figma"
    ? "https://www.figma.com/file/..."
    : watch("sourceType") === "pdf"
      ? "https://example.com/document.pdf"
      : watch("sourceType") === "screen"
        ? "https://example.com/screen.png"
        : "https://example.com/resource";

  return (
    <div className="page">
      <PageHead
        title={<>Knowledge <em className="italic-teal">sources</em></>}
        subtitle="Reference documents, screens and URLs for your AI test author."
        actions={!showForm && (
          <Button
            variant="primary"
            disabled={writable.length === 0}
            title={writable.length === 0 ? "You don't have write access to any project in this organization" : undefined}
            onClick={openCreate}
          >
            <svg className="ico" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg>
            Add source
          </Button>
        )}
      />

      <div style={{ marginBottom: 16 }}>
        <ProjectFilter placeholder="Filter by project pick one or more…" />
      </div>

      {showForm && (
        <form className="ts-form" onSubmit={handleSubmit(onSubmit)}>
          <div className="ts-form-title">{editingId ? "Edit Knowledge Source" : "Add Knowledge Source"}</div>
          <div className="ts-form-field">
            <label htmlFor="ks-project">Project</label>
            <ProjectPickerField id="ks-project" value={formProjectId} onChange={setFormProjectId} disabled={!!editingId} required />
          </div>

          <div className="ts-form-field">
            <label htmlFor="ks-name">Name</label>
            <input id="ks-name" type="text" placeholder="e.g. Onboarding Flow Screens" autoFocus {...register("name")} />
            {errors.name && <span className="ts-form-error">{errors.name.message}</span>}
          </div>

          <div className="ts-form-field">
            <label>Source Type</label>
            <div className="tag-picker">
              {SOURCE_TYPES.map((st) => (
                <button
                  key={st.value}
                  type="button"
                  className={`chip-btn${watch("sourceType") === st.value ? " selected" : ""}`}
                  onClick={() => setValue("sourceType", st.value, { shouldValidate: true })}
                  style={{ gap: 6, display: "inline-flex", alignItems: "center" }}
                >
                  {SOURCE_TYPE_ICONS[st.value]}
                  {st.label}
                </button>
              ))}
            </div>
            {errors.sourceType && <span className="ts-form-error">{errors.sourceType.message}</span>}
          </div>

          {supportsUpload && (
            <div className="ts-form-field">
              <label>Upload File</label>
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                style={{
                  border: `2px dashed ${isDragging ? "var(--teal)" : "var(--line)"}`,
                  borderRadius: 10,
                  padding: "24px",
                  textAlign: "center",
                  background: isDragging ? "var(--teal-50)" : "var(--bg-2)",
                  transition: "border-color 160ms ease, background-color 160ms ease",
                  cursor: "pointer",
                }}
                onClick={() => document.getElementById("ks-file-input")?.click()}
              >
                <input
                  id="ks-file-input"
                  type="file"
                  accept={ACCEPT_MAP[selectedSourceType] || "*"}
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileSelect(file);
                  }}
                />
                {uploadedFileName ? (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                    <span style={{ color: "var(--muted)", display: "flex" }}>
                      {SOURCE_TYPE_ICONS[selectedSourceType]}
                    </span>
                    <span style={{ fontSize: 13, color: "var(--ink)" }}>{uploadedFileName}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setUploadedFile(null);
                        setUploadedFileName("");
                        setValue("url", "", { shouldValidate: true });
                      }}
                    >
                      Remove
                    </Button>
                  </div>
                ) : (
                  <>
                    <div style={{ marginBottom: 4 }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 28, height: 28, color: "var(--muted-2)" }}>
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="17 8 12 3 7 8" />
                        <line x1="12" y1="3" x2="12" y2="15" />
                      </svg>
                    </div>
                    <span style={{ fontSize: 13, color: "var(--muted)" }}>
                      Drag &amp; drop or click to upload
                    </span>
                  </>
                )}
              </div>
            </div>
          )}

          <div className="ts-form-field">
            <label htmlFor="ks-url">{supportsUpload ? "Or paste URL" : "URL"}</label>
            <input id="ks-url" type="text" placeholder={urlPlaceholder} {...register("url")} />
          </div>

          <div className="ts-form-field">
            <label htmlFor="ks-desc">Description</label>
            <textarea id="ks-desc" rows={2} placeholder="Optional description..." {...register("description")} />
          </div>

          <div className="ts-form-actions">
            <Button type="button" variant="ghost" onClick={closeForm}>Cancel</Button>
            <Button type="submit" disabled={!isValid || isSubmitting || !formProjectId}>
              {editingId ? "Save" : "Create"}
            </Button>
          </div>
        </form>
      )}

      {!showForm && (
        <div style={{ marginBottom: 16 }}>
          <Tabs
            variant="chip"
            value={filterType || "all"}
            onChange={(v) => { setFilterType(v === "all" ? "" : v); setPage(1); }}
            options={[
              { value: "all",    label: "All",    count: total, chipVariant: "teal", dotColor: "var(--teal)" },
              { value: "pdf",    label: "PDF",    count: sources.filter((s) => s.sourceType === "pdf").length,    chipVariant: "fail" },
              { value: "screen", label: "Screen", count: sources.filter((s) => s.sourceType === "screen").length, chipVariant: "info" },
              { value: "figma",  label: "Figma",  count: sources.filter((s) => s.sourceType === "figma").length,  chipVariant: "voice" },
              { value: "url",    label: "URL",    count: sources.filter((s) => s.sourceType === "url").length,    chipVariant: "agent" },
            ]}
          />
        </div>
      )}

      {initialLoad ? (
        <p className="ts-empty">Loading…</p>
      ) : total === 0 && !filterType && !showForm ? (
        <div className="empty">
          <div className="title">No knowledge <em className="italic-teal">sources</em> yet.</div>
          <div className="sub">Add PDFs, screens, Figma files or URLs. Coglity uses them as context when generating test cases.</div>
          <Button variant="primary" onClick={() => setShowForm(true)}>Add source</Button>
        </div>
      ) : (
        <>
          {loading ? (
            <p className="ts-empty">Loading...</p>
          ) : sources.length === 0 ? (
            <p className="ts-empty">No sources match your filter.</p>
          ) : (
            <div className="ts-list">
              {sources.map((src) => (
                <div key={src.id} className="ts-card">
                  <div className="ts-card-body">
                    <div className="ts-card-name" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ color: "var(--muted)", display: "flex" }}>
                        {SOURCE_TYPE_ICONS[src.sourceType]}
                      </span>
                      {src.name}
                      <span className="tag-badge">{sourceTypeLabel(src.sourceType)}</span>
                    </div>
                    {src.url && (
                      <div className="ts-card-desc" style={{ wordBreak: "break-all" }}>{src.url}</div>
                    )}
                    {src.description && (
                      <div className="ts-card-desc">{src.description}</div>
                    )}
                    <div className="ts-card-meta">
                      Created {new Date(src.createdAt).toLocaleDateString()}
                      {src.createdByName && ` by ${src.createdByName}`}
                    </div>
                  </div>
                  <div className="ts-card-actions">
                    <Button variant="ghost" size="sm" onClick={() => startEdit(src)}>Edit</Button>
                    {deleteConfirmId === src.id ? (
                      <div className="ts-delete-confirm">
                        <Button variant="danger" size="sm" onClick={() => handleDelete(src)}>Confirm</Button>
                        <Button variant="ghost" size="sm" onClick={() => setDeleteConfirmId(null)}>Cancel</Button>
                      </div>
                    ) : (
                      <Button variant="danger" size="sm" onClick={() => setDeleteConfirmId(src.id)}>Delete</Button>
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
