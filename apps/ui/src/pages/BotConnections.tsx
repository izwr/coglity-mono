import { useEffect, useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import Editor from "@monaco-editor/react";
import { botConnectionService, type BotConnectionWithUser } from "../services/botConnectionService";
import { Button } from "../components/ui/Button";
import { Select } from "../components/ui/Select";
import { Chip } from "../components/ui/Chip";
import { PageHead } from "../components/ui/PageHead";
import { Tabs } from "../components/ui/Tabs";
import { useTheme } from "../theme/ThemeContext";
import { useSetBreadcrumbs } from "../context/BreadcrumbsContext";
import { ProjectFilter, useSelectedProjectIds } from "../components/ProjectFilter";
import { ProjectPickerField, useWritableProjects } from "../components/ProjectPickerField";
import { useCurrentOrg } from "../context/OrgContext";

const BOT_TYPES = [
  { value: "voice", label: "Voice Bot" },
  { value: "chat", label: "Chat Bot" },
];

const VOICE_PROVIDERS = [
  { value: "dialin", label: "Dial-in" },
  { value: "websocket", label: "WebSocket" },
];

const CHAT_PROVIDERS = [
  { value: "http", label: "HTTP" },
  { value: "websocket", label: "WebSocket" },
];

const ALL_PROVIDERS = [
  { value: "dialin", label: "Dial-in" },
  { value: "websocket", label: "WebSocket" },
  { value: "http", label: "HTTP" },
];

const PROVIDER_CONFIG_FIELDS: Record<string, { key: string; label: string; placeholder: string }[]> = {
  dialin: [
    { key: "phoneNumber", label: "Phone Number", placeholder: "+1234567890" },
  ],
  websocket: [
    { key: "url", label: "WebSocket URL", placeholder: "wss://your-bot.example.com/ws" },
  ],
  http: [
    { key: "url", label: "Endpoint URL", placeholder: "https://your-bot.example.com/api/chat" },
  ],
};

const AUDIO_ENCODING_OPTIONS = [
  { value: "pcm16", label: "PCM 16-bit" },
  { value: "mulaw", label: "mu-law" },
  { value: "alaw", label: "A-law" },
];

const AUDIO_SCHEMA_FIELDS = {
  inputAudioField: { label: "Input Audio Field Path", placeholder: "media.payload" },
  outputAudioField: { label: "Output Audio Field Path", placeholder: "media.payload" },
  outputTemplate: { label: "Output JSON Template (optional)", placeholder: '{"event":"media","media":{"payload":""}}' },
  encoding: { label: "Audio Encoding", placeholder: "pcm16" },
  sampleRate: { label: "Sample Rate (Hz)", placeholder: "16000" },
  channels: { label: "Channels", placeholder: "1" },
};

const createSchema = yup.object({
  name: yup.string().required("Name is required").max(255),
  botType: yup.string().required("Bot type is required"),
  provider: yup.string().required("Provider is required"),
  description: yup.string().max(2000).default(""),
});

type FormValues = yup.InferType<typeof createSchema>;

const PAGE_SIZE = 10;

export function BotConnections() {
  useSetBreadcrumbs([{ label: "Bots & agents" }]);
  const { theme } = useTheme();
  const { org } = useCurrentOrg();
  const projectIds = useSelectedProjectIds();
  const writable = useWritableProjects();
  const [formProjectId, setFormProjectId] = useState<string>("");
  const [connections, setConnections] = useState<BotConnectionWithUser[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [initialLoad, setInitialLoad] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [configValues, setConfigValues] = useState<Record<string, string>>({});
  const [authHeaders, setAuthHeaders] = useState<{ key: string; value: string }[]>([]);
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
    defaultValues: { name: "", botType: "", provider: "", description: "" },
  });

  const selectedProvider = watch("provider");
  const selectedBotType = watch("botType");
  const providerOptions = selectedBotType === "voice" ? VOICE_PROVIDERS : selectedBotType === "chat" ? CHAT_PROVIDERS : [];
  const showAuthHeaders = selectedBotType === "chat" || selectedBotType === "voice";

  const fetchConnections = useCallback(async () => {
    if (!org) return;
    setLoading(true);
    try {
      const res = await botConnectionService.getAll(org.organizationId, projectIds, {
        botType: filterType || undefined,
        page,
        limit: PAGE_SIZE,
      });
      setConnections(res.data);
      setTotal(res.total);
    } catch {
      setConnections([]);
      setTotal(0);
    } finally {
      setLoading(false);
      setInitialLoad(false);
    }
  }, [org, projectIds, filterType, page]);

  useEffect(() => {
    fetchConnections();
  }, [fetchConnections]);

  const closeForm = () => {
    reset({ name: "", botType: "", provider: "", description: "" });
    setConfigValues({});
    setAuthHeaders([]);
    setEditingId(null);
    setFormProjectId("");
    setShowForm(false);
  };

  const openCreate = () => {
    reset({ name: "", botType: "", provider: "", description: "" });
    setConfigValues({});
    setAuthHeaders([]);
    setEditingId(null);
    setFormProjectId(writable[0]?.projectId ?? "");
    setShowForm(true);
  };

  const startEdit = (conn: BotConnectionWithUser) => {
    setEditingId(conn.id);
    setFormProjectId(conn.projectId);
    setValue("name", conn.name, { shouldValidate: true });
    setValue("botType", conn.botType, { shouldValidate: true });
    setValue("provider", conn.provider, { shouldValidate: true });
    setValue("description", conn.description || "", { shouldValidate: true });
    const cfg = (conn.config ?? {}) as Record<string, unknown>;
    const { authHeaders: savedHeaders, ...rest } = cfg;
    setConfigValues(rest as Record<string, string>);
    setAuthHeaders(
      Array.isArray(savedHeaders)
        ? (savedHeaders as { key: string; value: string }[])
        : [],
    );
    setShowForm(true);
  };

  const onSubmit = async (data: FormValues) => {
    const config: Record<string, unknown> = { ...configValues };
    if (data.botType === "chat" || data.botType === "voice") {
      const validHeaders = authHeaders.filter((h) => h.key.trim());
      if (validHeaders.length > 0) {
        config.authHeaders = validHeaders;
      }
    }
    const payload = {
      name: data.name,
      botType: data.botType as "voice" | "chat",
      provider: data.provider as "dialin" | "websocket" | "http",
      config,
      description: data.description || "",
    };

    if (!org || !formProjectId) return;
    if (editingId) {
      await botConnectionService.update(org.organizationId, formProjectId, editingId, payload);
    } else {
      await botConnectionService.create(org.organizationId, formProjectId, payload);
    }
    closeForm();
    fetchConnections();
  };

  const handleDelete = async (conn: BotConnectionWithUser) => {
    if (!org) return;
    await botConnectionService.remove(org.organizationId, conn.projectId, conn.id);
    setDeleteConfirmId(null);
    fetchConnections();
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const providerLabel = (p: string) => ALL_PROVIDERS.find((x) => x.value === p)?.label ?? p;
  const botTypeLabel = (t: string) => BOT_TYPES.find((x) => x.value === t)?.label ?? t;

  return (
    <div className="page wide">
      <PageHead
        title={<>Bots &amp; <em className="italic-teal">agents</em></>}
        subtitle="Registry of voice and chat systems you test against."
        actions={!showForm && (
          <Button
            variant="primary"
            disabled={writable.length === 0}
            title={writable.length === 0 ? "You don't have write access to any project in this organization" : undefined}
            onClick={openCreate}
          >
            <svg className="ico" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg>
            Add bot
          </Button>
        )}
      />

      <div style={{ marginBottom: 16 }}>
        <ProjectFilter placeholder="Filter by project pick one or more…" />
      </div>

      {showForm && (
        <form className="ts-form" onSubmit={handleSubmit(onSubmit)}>
          <div className="ts-form-title">{editingId ? "Edit Bot Connection" : "Add Bot Connection"}</div>
          <div className="ts-form-field">
            <label htmlFor="bot-project">Project</label>
            <ProjectPickerField id="bot-project" value={formProjectId} onChange={setFormProjectId} disabled={!!editingId} required />
          </div>

          <div className="ts-form-field">
            <label htmlFor="bc-name">Name</label>
            <input id="bc-name" type="text" placeholder="My Voice Bot" autoFocus {...register("name")} />
            {errors.name && <span className="ts-form-error">{errors.name.message}</span>}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
            <div className="ts-form-field">
              <label>Bot Type</label>
              <Select
                value={watch("botType") ? { value: watch("botType"), label: botTypeLabel(watch("botType")) } : null}
                onChange={(opt) => {
                  setValue("botType", opt?.value ?? "", { shouldValidate: true });
                  setValue("provider", "", { shouldValidate: true });
                  setConfigValues({});
                  setAuthHeaders([]);
                }}
                options={BOT_TYPES}
                placeholder="Select bot type"
              />
              {errors.botType && <span className="ts-form-error">{errors.botType.message}</span>}
            </div>

            <div className="ts-form-field">
              <label>Provider</label>
              <Select
                value={watch("provider") ? { value: watch("provider"), label: providerLabel(watch("provider")) } : null}
                onChange={(opt) => {
                  setValue("provider", opt?.value ?? "", { shouldValidate: true });
                  setConfigValues({});
                }}
                options={providerOptions}
                placeholder={selectedBotType ? "Select provider" : "Select bot type first"}
              />
              {errors.provider && <span className="ts-form-error">{errors.provider.message}</span>}
            </div>
          </div>

          {selectedProvider && PROVIDER_CONFIG_FIELDS[selectedProvider] && (
            <div style={{ marginTop: "4px" }}>
              {PROVIDER_CONFIG_FIELDS[selectedProvider].map((field) => (
                <div className="ts-form-field" key={field.key}>
                  <label>{field.label}</label>
                  <input
                    type="text"
                    placeholder={field.placeholder}
                    value={configValues[field.key] || ""}
                    onChange={(e) => setConfigValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
          )}

          {(selectedProvider === "websocket" || selectedProvider === "http") && (
            <div style={{ marginTop: "4px", background: "var(--bg-2)", border: "1px solid var(--line)", borderRadius: "10px", padding: "16px" }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", marginBottom: 12 }}>
                {selectedBotType === "voice" ? "Audio I/O Schema" : "Message Schema"}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                <div className="ts-form-field">
                  <label>{AUDIO_SCHEMA_FIELDS.inputAudioField.label}</label>
                  <input
                    type="text"
                    placeholder={AUDIO_SCHEMA_FIELDS.inputAudioField.placeholder}
                    value={configValues["inputAudioField"] || ""}
                    onChange={(e) => setConfigValues((prev) => ({ ...prev, inputAudioField: e.target.value }))}
                  />
                </div>
                <div className="ts-form-field">
                  <label>{AUDIO_SCHEMA_FIELDS.outputAudioField.label}</label>
                  <input
                    type="text"
                    placeholder={AUDIO_SCHEMA_FIELDS.outputAudioField.placeholder}
                    value={configValues["outputAudioField"] || ""}
                    onChange={(e) => setConfigValues((prev) => ({ ...prev, outputAudioField: e.target.value }))}
                  />
                </div>
              </div>
              <div className="ts-form-field">
                <label>{AUDIO_SCHEMA_FIELDS.outputTemplate.label}</label>
                <div style={{ border: "1px solid var(--line)", borderRadius: "10px", overflow: "hidden" }}>
                  <Editor
                    height="140px"
                    defaultLanguage="json"
                    theme={theme === "dark" ? "vs-dark" : "light"}
                    value={configValues["outputTemplate"] || ""}
                    onChange={(val) => setConfigValues((prev) => ({ ...prev, outputTemplate: val ?? "" }))}
                    options={{
                      minimap: { enabled: false },
                      scrollBeyondLastLine: false,
                      fontSize: 13,
                      lineNumbers: "off",
                      folding: false,
                      tabSize: 2,
                      automaticLayout: true,
                      padding: { top: 8, bottom: 8 },
                    }}
                  />
                </div>
              </div>
              {selectedBotType === "voice" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "14px" }}>
                  <div className="ts-form-field">
                    <label>{AUDIO_SCHEMA_FIELDS.encoding.label}</label>
                    <Select
                      value={configValues["encoding"] ? { value: configValues["encoding"], label: AUDIO_ENCODING_OPTIONS.find((o) => o.value === configValues["encoding"])?.label ?? configValues["encoding"] } : null}
                      onChange={(opt) => setConfigValues((prev) => ({ ...prev, encoding: opt?.value ?? "" }))}
                      options={AUDIO_ENCODING_OPTIONS}
                      placeholder="Select encoding"
                    />
                  </div>
                  <div className="ts-form-field">
                    <label>{AUDIO_SCHEMA_FIELDS.sampleRate.label}</label>
                    <input
                      type="number"
                      placeholder={AUDIO_SCHEMA_FIELDS.sampleRate.placeholder}
                      value={configValues["sampleRate"] || ""}
                      onChange={(e) => setConfigValues((prev) => ({ ...prev, sampleRate: e.target.value }))}
                    />
                  </div>
                  <div className="ts-form-field">
                    <label>{AUDIO_SCHEMA_FIELDS.channels.label}</label>
                    <Select
                      value={configValues["channels"] ? { value: configValues["channels"], label: configValues["channels"] === "1" ? "Mono (1)" : "Stereo (2)" } : null}
                      onChange={(opt) => setConfigValues((prev) => ({ ...prev, channels: opt?.value ?? "" }))}
                      options={[{ value: "1", label: "Mono (1)" }, { value: "2", label: "Stereo (2)" }]}
                      placeholder="Select"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {showAuthHeaders && (
            <div style={{ marginTop: "4px" }}>
              <div className="ts-form-field">
                <label>Authentication Headers</label>
                {authHeaders.map((header, idx) => (
                  <div key={idx} style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: "8px", marginBottom: "8px" }}>
                    <input
                      type="text"
                      placeholder="Header name (e.g. Authorization)"
                      value={header.key}
                      onChange={(e) => {
                        const updated = [...authHeaders];
                        updated[idx] = { ...updated[idx], key: e.target.value };
                        setAuthHeaders(updated);
                      }}
                    />
                    <input
                      type="text"
                      placeholder="Value (e.g. Bearer token...)"
                      value={header.value}
                      onChange={(e) => {
                        const updated = [...authHeaders];
                        updated[idx] = { ...updated[idx], value: e.target.value };
                        setAuthHeaders(updated);
                      }}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setAuthHeaders((prev) => prev.filter((_, i) => i !== idx))}
                      style={{ alignSelf: "center" }}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setAuthHeaders((prev) => [...prev, { key: "", value: "" }])}
                >
                  + Add Header
                </Button>
              </div>
            </div>
          )}

          <div className="ts-form-field">
            <label htmlFor="bc-desc">Description</label>
            <textarea id="bc-desc" rows={2} placeholder="Optional description..." {...register("description")} />
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
              { value: "all",   label: "All",   count: total, chipVariant: "teal", dotColor: "var(--teal)" },
              { value: "voice", label: "Voice", count: connections.filter((c) => c.botType === "voice").length, chipVariant: "voice" },
              { value: "chat",  label: "Chat",  count: connections.filter((c) => c.botType === "chat").length, chipVariant: "chat" },
            ]}
          />
        </div>
      )}

      {initialLoad ? (
        <p className="ts-empty">Loading…</p>
      ) : total === 0 && !filterType && !showForm ? (
        <div className="empty">
          <div className="title">No <em className="italic-teal">bots</em> connected.</div>
          <div className="sub">Add a voice or chat bot connection so Coglity can run tests against it.</div>
          <Button variant="primary" onClick={() => setShowForm(true)}>Add bot</Button>
        </div>
      ) : (
        <>
          {loading ? (
            <p className="ts-empty">Loading…</p>
          ) : connections.length === 0 ? (
            <p className="ts-empty">No connections match your filter.</p>
          ) : (
            <div className="card" style={{ overflow: "hidden" }}>
              <div className="table-scroll">
                <table className="t">
                  <thead>
                    <tr>
                      <th></th>
                      <th>Name</th>
                      <th>Type</th>
                      <th>Provider</th>
                      <th>Health</th>
                      <th>Created</th>
                      <th style={{ textAlign: "right" }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {connections.map((conn) => (
                      <tr key={conn.id}>
                        <td style={{ width: 44 }}>
                          <div style={{ width: 28, height: 28, borderRadius: 8, background: conn.botType === "voice" ? "var(--violet-bg)" : "var(--blue-bg)", display: "grid", placeItems: "center", color: conn.botType === "voice" ? "var(--violet)" : "var(--blue)" }}>
                            <svg className="ico" width="14" height="14" viewBox="0 0 24 24">
                              {conn.botType === "voice"
                                ? <path d="M12 1a3 3 0 013 3v8a3 3 0 01-6 0V4a3 3 0 013-3zM19 10v1a7 7 0 01-14 0v-1M12 19v3" />
                                : <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />}
                            </svg>
                          </div>
                        </td>
                        <td>
                          <div style={{ color: "var(--ink)", fontWeight: 500 }}>{conn.name}</div>
                          {conn.description && <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{conn.description}</div>}
                        </td>
                        <td>
                          <Chip variant={conn.botType === "voice" ? "voice" : "chat"}>{botTypeLabel(conn.botType)}</Chip>
                        </td>
                        <td className="mono">{providerLabel(conn.provider)}</td>
                        <td><Chip variant="pass" dot pulse>healthy</Chip></td>
                        <td className="mono muted">{new Date(conn.createdAt).toLocaleDateString()}</td>
                        <td style={{ textAlign: "right" }}>
                          <div className="row" style={{ justifyContent: "flex-end", gap: 4 }}>
                            <Button variant="ghost" size="sm" onClick={() => startEdit(conn)}>Edit</Button>
                            {deleteConfirmId === conn.id ? (
                              <>
                                <Button variant="danger" size="sm" onClick={() => handleDelete(conn)}>Confirm</Button>
                                <Button variant="ghost" size="sm" onClick={() => setDeleteConfirmId(null)}>Cancel</Button>
                              </>
                            ) : (
                              <Button variant="ghost" size="sm" onClick={() => setDeleteConfirmId(conn.id)} style={{ color: "var(--red)" }}>Delete</Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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