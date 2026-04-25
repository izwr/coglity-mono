import { useEffect, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import type { Tag } from "@coglity/shared";
import { Button } from "../components/ui/Button";
import { Select } from "../components/ui/Select";
import { Chip, type ChipVariant } from "../components/ui/Chip";
import { testCaseService, type TestCaseWithTags } from "../services/testCaseService";
import { tagService } from "../services/tagService";
import { botConnectionService, type BotConnectionWithUser } from "../services/botConnectionService";
import { testRunService, type TestRunWithUser } from "../services/testRunService";
import { TestRunPanel } from "../components/TestRunPanel";
import { useSetBreadcrumbs } from "../context/BreadcrumbsContext";
import { useCurrentOrg } from "../context/OrgContext";

const TEST_CASE_TYPES = [
  { value: "web", label: "Web" },
  { value: "mobile", label: "Mobile" },
  { value: "chat", label: "Chat" },
  { value: "voice", label: "Voice" },
  { value: "agent", label: "Agent" },
];

const typeChipVariant: Record<string, ChipVariant> = {
  web: "web", mobile: "mobile", chat: "chat", voice: "voice", agent: "agent",
};

const testCaseFormSchema = yup.object({
  title: yup.string().required("Title is required").max(255),
  preCondition: yup.string().max(10000).default(""),
  testSteps: yup.string().max(10000).default(""),
  expectedResults: yup.string().max(10000).default(""),
  data: yup.string().max(10000).default(""),
});

type FormValues = yup.InferType<typeof testCaseFormSchema>;

export function TestCaseDetail() {
  const { id, projectId } = useParams<{ id: string; projectId: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { org } = useCurrentOrg();
  useSetBreadcrumbs([{ label: "Test cases", to: "/test-cases" }, { label: "Case" }]);

  const [tc, setTc] = useState<TestCaseWithTags | null>(null);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [allBotConnections, setAllBotConnections] = useState<BotConnectionWithUser[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [selectedType, setSelectedType] = useState<string>("web");
  const [selectedBotConnectionId, setSelectedBotConnectionId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [runHistory, setRunHistory] = useState<TestRunWithUser[]>([]);
  const [runError, setRunError] = useState<string>("");
  const [starting, setStarting] = useState(false);

  const showBotConnectionPicker = selectedType === "chat" || selectedType === "voice";
  const filteredBotConnections = allBotConnections.filter((bc) => bc.botType === selectedType);

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
    if (!id || !projectId || !org) return;
    Promise.all([
      testCaseService.getById(org.organizationId, projectId, id),
      tagService.getAll(org.organizationId, [projectId]),
      botConnectionService.getAll(org.organizationId, [projectId], { limit: 100 }),
      testRunService.listByTestCase(org.organizationId, projectId, id).catch(() => []),
    ]).then(([tcData, tagsData, bcData, runsData]) => {
      setTc(tcData);
      setAllTags(Array.isArray(tagsData) ? tagsData : []);
      setAllBotConnections(Array.isArray(bcData.data) ? bcData.data : []);
      setRunHistory(Array.isArray(runsData) ? runsData : []);
      populateFields(tcData);
    }).catch(() => {
      navigate("/test-cases");
    }).finally(() => {
      setLoading(false);
    });
  }, [id, projectId, org]);

  const canRun = !!tc && tc.testCaseType === "voice" && !!tc.botConnectionId && !editing;

  const startRun = async () => {
    if (!id || !projectId || !org || !canRun) return;
    setRunError("");
    setStarting(true);
    try {
      const run = await testRunService.create(org.organizationId, projectId, id);
      setActiveRunId(run.id);
      setRunHistory((prev) => [run, ...prev]);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to start run";
      setRunError(msg);
    } finally {
      setStarting(false);
    }
  };

  // Auto-trigger run when navigated with ?run=1
  useEffect(() => {
    if (searchParams.get("run") !== "1") return;
    if (!canRun || loading || starting || activeRunId) return;
    startRun().then(() => {
      searchParams.delete("run");
      setSearchParams(searchParams, { replace: true });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canRun, loading, searchParams]);

  const refreshHistoryAfterTerminal = (final: TestRunWithUser) => {
    setRunHistory((prev) => prev.map((r) => (r.id === final.id ? final : r)));
  };

  const populateFields = (d: TestCaseWithTags) => {
    reset({
      title: d.title,
      preCondition: d.preCondition,
      testSteps: d.testSteps,
      expectedResults: d.expectedResults,
      data: d.data,
    });
    setSelectedTagIds((d.tags ?? []).map((t) => t.id));
    setSelectedType(d.testCaseType || "web");
    setSelectedBotConnectionId(d.botConnectionId || "");
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
    if (!id || !projectId || !org) return;
    const updated = await testCaseService.update(org.organizationId, projectId, id, {
      title: formData.title,
      preCondition: formData.preCondition,
      testSteps: formData.testSteps,
      data: formData.data,
      expectedResults: formData.expectedResults,
      tagIds: selectedTagIds,
      testCaseType: selectedType as "web" | "mobile" | "chat" | "voice" | "agent",
      botConnectionId: (selectedType === "chat" || selectedType === "voice") ? selectedBotConnectionId || null : null,
    });
    setTc(updated);
    setEditing(false);
  };

  const handleDelete = async () => {
    if (!id || !projectId || !org) return;
    await testCaseService.remove(org.organizationId, projectId, id);
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
          <Button variant="ghost" className="tc-back-btn" onClick={() => navigate("/test-cases")}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Back
          </Button>
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
              <span style={{ marginLeft: 12, display: "inline-flex", gap: 6, verticalAlign: "middle" }}>
                <Chip variant={typeChipVariant[tc.testCaseType] ?? "neutral"}>
                  {TEST_CASE_TYPES.find((t) => t.value === tc.testCaseType)?.label ?? tc.testCaseType}
                </Chip>
                {tc.status === "draft" && <Chip variant="warn" dot>Draft</Chip>}
                {tc.status === "active" && <Chip variant="pass" dot>Active</Chip>}
              </span>
            </h1>
          )}
          {errors.title && <span className="ts-form-error">{errors.title.message}</span>}
        </div>
        <div className="tc-detail-header-actions">
          {canRun && (
            <Button
              variant="teal"
              disabled={starting || !!activeRunId}
              onClick={startRun}
              title={activeRunId ? "A run is already in progress" : "Run this voice test case"}
            >
              {starting ? "Starting…" : activeRunId ? "Running…" : "Run"}
            </Button>
          )}
          {deleteConfirm ? (
            <div className="ts-delete-confirm">
              <Button variant="danger" size="sm" onClick={handleDelete}>Confirm</Button>
              <Button variant="ghost" size="sm" onClick={() => setDeleteConfirm(false)}>Cancel</Button>
            </div>
          ) : (
            <Button variant="danger" onClick={() => setDeleteConfirm(true)}>Delete</Button>
          )}
          {tc.status === "draft" && !editing && (
            <Button
              variant="teal"
              onClick={async () => {
                if (!id || !projectId || !org) return;
                const updated = await testCaseService.update(org.organizationId, projectId, id, {
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
            </Button>
          )}
          {editing ? (
            <>
              <Button variant="ghost" onClick={cancelEdit}>Cancel</Button>
              <Button
                onClick={handleSubmit(onSubmit)}
                disabled={isSubmitting || !isValid}
              >
                {isSubmitting ? "Saving..." : "Save"}
              </Button>
            </>
          ) : (
            <Button onClick={startEdit}>Edit</Button>
          )}
        </div>
      </div>

      {/* Metadata */}
      <div className="tc-detail-meta">
        {editing ? (
          <>
            <div style={{ marginBottom: 12 }}>
              <label className="tc-detail-label" style={{ marginBottom: 6 }}>Type</label>
              <div className="tag-picker">
                {TEST_CASE_TYPES.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    className={`chip-btn${selectedType === t.value ? " selected" : ""}`}
                    onClick={() => {
                      setSelectedType(t.value);
                      if (t.value !== "chat" && t.value !== "voice") {
                        setSelectedBotConnectionId("");
                      }
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
            {showBotConnectionPicker && (
              <div style={{ marginBottom: 12 }}>
                <label className="tc-detail-label" style={{ marginBottom: 6 }}>Bot Connection</label>
                {filteredBotConnections.length === 0 ? (
                  <span className="ts-form-hint">No {selectedType} bot connections available.</span>
                ) : (
                  <Select
                    value={selectedBotConnectionId ? { value: selectedBotConnectionId, label: filteredBotConnections.find((bc) => bc.id === selectedBotConnectionId)?.name ?? "" } : null}
                    onChange={(opt) => setSelectedBotConnectionId(opt?.value ?? "")}
                    options={filteredBotConnections.map((bc) => ({ value: bc.id, label: `${bc.name} (${bc.provider})` }))}
                    placeholder={`Select ${selectedType} bot connection`}
                  />
                )}
              </div>
            )}
            <div className="tc-detail-tag-picker">
              {allTags.length === 0 ? (
                <span className="ts-form-hint">No tags available.</span>
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
          </>
        ) : (
          <>
            {(tc.tags?.length ?? 0) > 0 && (
              <div className="ts-card-tags">
                {(tc.tags ?? []).map((tag) => (
                  <span key={tag.id} className="tag-badge">{tag.name}</span>
                ))}
              </div>
            )}
            {tc.botConnectionName && (
              <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 4 }}>
                Bot: {tc.botConnectionName}
              </div>
            )}
          </>
        )}
        <div className="tc-detail-meta-text">
          Suite: {tc.testSuiteName} · Created {new Date(tc.createdAt).toLocaleDateString()}
          {tc.createdByName && ` by ${tc.createdByName}`}
          {tc.updatedByName && (
            <> · Updated {new Date(tc.updatedAt).toLocaleDateString()} by {tc.updatedByName}</>
          )}
        </div>
      </div>

      {runError && (
        <div
          style={{
            padding: "8px 12px",
            borderRadius: 8,
            background: "var(--red-bg)",
            color: "var(--red)",
            marginBottom: 12,
            fontSize: 13,
          }}
        >
          {runError}
        </div>
      )}

      {activeRunId && org && projectId && (
        <TestRunPanel
          orgId={org.organizationId}
          projectId={projectId}
          runId={activeRunId}
          onTerminal={(run) => {
            refreshHistoryAfterTerminal(run);
            setActiveRunId(null);
          }}
        />
      )}

      {runHistory.length > 0 && !activeRunId && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", marginBottom: 6 }}>
            Run history
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {runHistory.slice(0, 5).map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setActiveRunId(r.id)}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "6px 10px",
                  border: "1px solid var(--line)",
                  borderRadius: 8,
                  background: "var(--bg-1)",
                  cursor: "pointer",
                  fontSize: 12,
                  textAlign: "left",
                }}
              >
                <span>
                  <Chip
                    variant={
                      r.state === "passed"
                        ? "pass"
                        : r.state === "failed"
                          ? "fail"
                          : r.state === "errored"
                            ? "warn"
                            : "info"
                    }
                  >
                    {r.state}
                  </Chip>
                  <span style={{ marginLeft: 8, color: "var(--muted)" }}>
                    {new Date(r.createdAt).toLocaleString()}
                  </span>
                </span>
                {r.verdict && (
                  <span
                    style={{
                      marginLeft: 12,
                      color: "var(--muted)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      maxWidth: 400,
                    }}
                  >
                    {r.verdict}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

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