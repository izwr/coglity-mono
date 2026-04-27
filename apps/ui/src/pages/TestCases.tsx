import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import type { Tag } from "@coglity/shared";
import { testCaseService, type TestCaseWithTags } from "../services/testCaseService";
import { testSuiteService, type TestSuiteWithTags } from "../services/testSuiteService";
import { tagService } from "../services/tagService";
import { botConnectionService, type BotConnectionWithUser } from "../services/botConnectionService";
import { ListToolbar, type AppliedFilters } from "../components/ListToolbar";
import { Button } from "../components/ui/Button";
import { Chip, type ChipVariant } from "../components/ui/Chip";
import { Select } from "../components/ui/Select";
import { PageHead } from "../components/ui/PageHead";
import { useSetBreadcrumbs } from "../context/BreadcrumbsContext";
import { ProjectFilter, useSelectedProjectIds } from "../components/ProjectFilter";
import { ProjectPickerField, useWritableProjects } from "../components/ProjectPickerField";
import { useCurrentOrg } from "../context/OrgContext";

const TEST_CASE_TYPES = [
  { value: "web",    label: "Web" },
  { value: "mobile", label: "Mobile" },
  { value: "chat",   label: "Chat" },
  { value: "voice",  label: "Voice" },
  { value: "agent",  label: "Agent" },
];

const typeChipVariant: Record<string, ChipVariant> = {
  web: "web",
  mobile: "mobile",
  chat: "chat",
  voice: "voice",
  agent: "agent",
};

const createTestCaseSchema = yup.object({
  title: yup.string().required("Title is required").max(255),
  testSuiteId: yup.string().required("Test suite is required"),
  testCaseType: yup.string().required("Type is required"),
  botConnectionId: yup.string().default(""),
});

type CreateFormValues = yup.InferType<typeof createTestCaseSchema>;

const PAGE_SIZE = 12;

const SORT_OPTIONS = [
  { label: "Newest first", field: "createdAt", dir: "desc" as const },
  { label: "Oldest first", field: "createdAt", dir: "asc" as const },
  { label: "Title A–Z", field: "title", dir: "asc" as const },
  { label: "Title Z–A", field: "title", dir: "desc" as const },
  { label: "Recently updated", field: "updatedAt", dir: "desc" as const },
];

const STATUS_TOGGLE = {
  options: [
    { value: "active", label: "Active", activeClass: "active-selected" },
    { value: "draft",  label: "Draft",  activeClass: "draft-selected" },
  ],
};

export function TestCases() {
  useSetBreadcrumbs([{ label: "Test cases" }]);
  const navigate = useNavigate();
  const { org } = useCurrentOrg();
  const projectIds = useSelectedProjectIds();
  const writable = useWritableProjects();
  const [formProjectId, setFormProjectId] = useState<string>("");
  const [cases, setCases] = useState<TestCaseWithTags[]>([]);
  const [total, setTotal] = useState(0);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [allSuites, setAllSuites] = useState<TestSuiteWithTags[]>([]);
  const [allBotConnections, setAllBotConnections] = useState<BotConnectionWithUser[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [initialLoad, setInitialLoad] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const [filters, setFilters] = useState<AppliedFilters>({
    search: "", tagId: "", sortBy: "updatedAt", sortDir: "desc", suiteId: "", status: "",
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
    resolver: yupResolver(createTestCaseSchema),
    mode: "onChange",
    defaultValues: { title: "", testSuiteId: "", testCaseType: "web", botConnectionId: "" },
  });

  const selectedType = watch("testCaseType");
  const showBotConnectionPicker = selectedType === "chat" || selectedType === "voice";
  const filteredBotConnections = allBotConnections.filter(
    (bc) => bc.botType === selectedType && bc.projectId === formProjectId,
  );

  const fetchCases = useCallback(async () => {
    if (!org) return;
    setLoading(true);
    try {
      const res = await testCaseService.getAll(org.organizationId, projectIds, {
        search: filters.search || undefined,
        testSuiteId: filters.suiteId || undefined,
        status: filters.status || undefined,
        sortBy: filters.sortBy,
        sortDir: filters.sortDir,
        page,
        limit: PAGE_SIZE,
      });
      setCases(res.data);
      setTotal(res.total);
    } catch {
      setCases([]); setTotal(0);
    } finally {
      setLoading(false);
      setInitialLoad(false);
    }
  }, [org, projectIds, filters, page]);

  useEffect(() => {
    if (!org) return;
    tagService.getAll(org.organizationId, projectIds).then(setAllTags).catch(() => setAllTags([]));
  }, [org, projectIds]);

  useEffect(() => {
    if (!org || writable.length === 0) { setAllSuites([]); return; }
    const writableIds = writable.map((p) => p.projectId);
    testSuiteService.getAll(org.organizationId, writableIds, { limit: 100 }).then((d) => setAllSuites(d.data)).catch(() => setAllSuites([]));
  }, [org, writable]);

  useEffect(() => {
    if (!org || writable.length === 0) {
      setAllBotConnections([]);
      return;
    }
    const writableIds = writable.map((p) => p.projectId);
    botConnectionService
      .getAll(org.organizationId, writableIds, { limit: 100 })
      .then((d) => setAllBotConnections(d.data))
      .catch(() => setAllBotConnections([]));
  }, [org, writable]);
  useEffect(() => { fetchCases(); }, [fetchCases]);

  const handleApplyFilters = (applied: AppliedFilters) => {
    setFilters(applied);
    setPage(1);
  };

  const closeForm = () => {
    reset({ title: "", testSuiteId: "", testCaseType: "web", botConnectionId: "" });
    setSelectedTagIds([]);
    setFormProjectId("");
    setShowForm(false);
  };

  const openCreate = () => {
    reset({ title: "", testSuiteId: "", testCaseType: "web", botConnectionId: "" });
    setSelectedTagIds([]);
    setFormProjectId(writable[0]?.projectId ?? "");
    setShowForm(true);
  };

  const onSubmit = async (data: CreateFormValues) => {
    if (!org || !formProjectId) return;
    const created = await testCaseService.create(org.organizationId, formProjectId, {
      title: data.title,
      testSuiteId: data.testSuiteId,
      preCondition: "",
      testSteps: "",
      data: "",
      expectedResults: "",
      tagIds: selectedTagIds,
      testCaseType: data.testCaseType as "web" | "mobile" | "chat" | "voice" | "agent",
      botConnectionId: data.botConnectionId || null,
    });
    closeForm();
    navigate(`/test-cases/${formProjectId}/${created.id}`);
  };

  const handleDelete = async (tc: TestCaseWithTags) => {
    if (!org) return;
    await testCaseService.remove(org.organizationId, tc.projectId, tc.id);
    setDeleteConfirmId(null);
    fetchCases();
  };

  const toggleTag = (tagId: string) => {
    setSelectedTagIds((prev) => (prev.includes(tagId) ? prev.filter((i) => i !== tagId) : [...prev, tagId]));
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasFilters = !!(filters.search || filters.tagId || filters.suiteId || filters.status);

  return (
    <div className="page wide">
      <PageHead
        title={<>Test case <em className="italic-teal">library</em></>}
        subtitle={<>{total} cases across {(projectIds.length > 0 ? allSuites.filter((s) => projectIds.includes(s.projectId)) : allSuites).length} suites</>}
        actions={
          !showForm && (
            <>
              <Button variant="ghost" onClick={() => navigate("/test-cases/generate")}>
                <svg className="ico" viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" /></svg>
                Generate with AI
              </Button>
              <Button
                variant="primary"
                disabled={writable.length === 0}
                title={writable.length === 0 ? "You don't have write access to any project in this organization" : undefined}
                onClick={openCreate}
              >
                <svg className="ico" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg>
                New test case
              </Button>
            </>
          )
        }
      />

      <div style={{ marginBottom: 16 }}>
        <ProjectFilter placeholder="Filter by project pick one or more…" />
      </div>

      {showForm && (
        <form className="ts-form" onSubmit={handleSubmit(onSubmit)}>
          <div className="ts-form-title">New test case</div>
          <div className="ts-form-field">
            <label htmlFor="tc-project">Project</label>
            <ProjectPickerField
              id="tc-project"
              value={formProjectId}
              onChange={(id) => {
                setFormProjectId(id);
                setValue("testSuiteId", "", { shouldValidate: true });
                setValue("botConnectionId", "", { shouldValidate: true });
              }}
              required
            />
          </div>
          <div className="ts-form-field">
            <label htmlFor="tc-title">Title</label>
            <input id="tc-title" type="text" placeholder="e.g., Billing · update payment method" autoFocus {...register("title")} />
            {errors.title && <span className="ts-form-error">{errors.title.message}</span>}
          </div>
          <div className="ts-form-field">
            <label htmlFor="tc-suite">Test suite</label>
            {(() => {
              const suites = formProjectId ? allSuites.filter((s) => s.projectId === formProjectId) : allSuites;
              return suites.length === 0 ? (
                <p className="ts-form-hint">No test suites available. Create a suite first.</p>
              ) : (
                <Select
                  value={watch("testSuiteId") ? { value: watch("testSuiteId"), label: suites.find((s) => s.id === watch("testSuiteId"))?.name ?? "" } : null}
                  onChange={(opt) => setValue("testSuiteId", opt?.value ?? "", { shouldValidate: true })}
                  options={suites.map((suite) => ({ value: suite.id, label: suite.name }))}
                  placeholder="Select a test suite"
                />
              );
            })()}
            {errors.testSuiteId && <span className="ts-form-error">{errors.testSuiteId.message}</span>}
          </div>
          <div className="ts-form-field">
            <label>Type</label>
            <div className="tag-picker">
              {TEST_CASE_TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  className={`chip-btn${selectedType === t.value ? " selected" : ""}`}
                  onClick={() => {
                    setValue("testCaseType", t.value, { shouldValidate: true });
                    if (t.value !== "chat" && t.value !== "voice") {
                      setValue("botConnectionId", "", { shouldValidate: true });
                    }
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          {showBotConnectionPicker && (
            <div className="ts-form-field">
              <label>Bot connection</label>
              {filteredBotConnections.length === 0 ? (
                <p className="ts-form-hint">No {selectedType} bot connections available. Add one from Bot Connections.</p>
              ) : (
                <Select
                  value={watch("botConnectionId") ? { value: watch("botConnectionId"), label: filteredBotConnections.find((bc) => bc.id === watch("botConnectionId"))?.name ?? "" } : null}
                  onChange={(opt) => setValue("botConnectionId", opt?.value ?? "", { shouldValidate: true })}
                  options={filteredBotConnections.map((bc) => ({ value: bc.id, label: `${bc.name} (${bc.provider})` }))}
                  placeholder={`Select ${selectedType} bot connection`}
                />
              )}
            </div>
          )}
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
            <Button type="submit" variant="primary" disabled={!isValid || isSubmitting || !formProjectId}>Create</Button>
          </div>
        </form>
      )}

      {initialLoad ? (
        <p className="ts-empty">Loading…</p>
      ) : total === 0 && !hasFilters && !showForm ? (
        <div className="empty">
          <div className="title">Your <em className="italic-teal">library</em> is empty.</div>
          <div className="sub">Author a test case by hand, or let Coglity draft some from a user story.</div>
          <div className="row">
            <Button variant="primary" onClick={() => setShowForm(true)}>New test case</Button>
            <Button variant="teal" onClick={() => navigate("/test-cases/generate")}>Generate with AI</Button>
          </div>
        </div>
      ) : (
        <>
          <ListToolbar
            searchPlaceholder="Search test cases…"
            tags={allTags}
            sortOptions={SORT_OPTIONS}
            onApply={handleApplyFilters}
            suites={projectIds.length > 0 ? allSuites.filter((s) => projectIds.includes(s.projectId)) : allSuites}
            statusToggle={STATUS_TOGGLE}
          />

          {loading ? (
            <p className="ts-empty">Loading…</p>
          ) : cases.length === 0 ? (
            <p className="ts-empty">No test cases match your filters.</p>
          ) : (
            <div className="card" style={{ overflow: "hidden" }}>
              <div className="table-scroll">
                <table className="t">
                  <thead>
                    <tr>
                      <th>Title</th>
                      <th>Type</th>
                      <th>Suite</th>
                      <th>Status</th>
                      <th>Tags</th>
                      <th>Updated</th>
                      <th style={{ textAlign: "right" }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {cases.map((tc) => (
                      <tr key={tc.id} onClick={() => navigate(`/test-cases/${tc.projectId}/${tc.id}`)} style={{ cursor: "pointer" }}>
                        <td style={{ maxWidth: 340 }}>
                          <div style={{ color: "var(--ink)", fontWeight: 500 }}>{tc.title}</div>
                          <div className="mono muted-2" style={{ fontSize: 11, marginTop: 2 }}>{tc.id.slice(0, 8)}</div>
                        </td>
                        <td><Chip variant={typeChipVariant[tc.testCaseType] ?? "neutral"}>{tc.testCaseType}</Chip></td>
                        <td className="muted">{tc.testSuiteName}</td>
                        <td>
                          {tc.status === "active"
                            ? <Chip variant="pass" dot>active</Chip>
                            : <Chip variant="warn" dot>draft</Chip>}
                        </td>
                        <td>
                          <div className="row" style={{ flexWrap: "wrap", gap: 4 }}>
                            {(tc.tags ?? []).slice(0, 3).map((t) => (
                              <span key={t.id} className="tag-badge">{t.name}</span>
                            ))}
                            {(tc.tags?.length ?? 0) > 3 && <span className="muted" style={{ fontSize: 11 }}>+{(tc.tags!.length - 3)}</span>}
                          </div>
                        </td>
                        <td className="mono">{new Date(tc.updatedAt).toLocaleDateString()}</td>
                        <td onClick={(e) => e.stopPropagation()} style={{ textAlign: "right" }}>
                          {deleteConfirmId === tc.id ? (
                            <div className="row" style={{ justifyContent: "flex-end", gap: 4 }}>
                              <Button variant="danger" size="sm" onClick={() => handleDelete(tc)}>Confirm</Button>
                              <Button variant="ghost" size="sm" onClick={() => setDeleteConfirmId(null)}>Cancel</Button>
                            </div>
                          ) : (
                            <div className="row" style={{ justifyContent: "flex-end", gap: 4 }}>
                              {tc.testCaseType === "voice" && tc.botConnectionId && (
                                <Button
                                  variant="teal"
                                  size="sm"
                                  onClick={() => navigate(`/test-cases/${tc.projectId}/${tc.id}?run=1`)}
                                  title="Run this voice test case"
                                >
                                  Run
                                </Button>
                              )}
                              <Button variant="ghost" size="sm" onClick={() => setDeleteConfirmId(tc.id)}>Delete</Button>
                            </div>
                          )}
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
