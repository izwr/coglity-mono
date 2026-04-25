import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { testSuiteService, type TestSuiteWithTags } from "../services/testSuiteService";
import { aiService, type FollowUpQA, type GeneratedScenario } from "../services/aiService";
import { Button } from "../components/ui/Button";
import { Select } from "../components/ui/Select";
import { PageHead } from "../components/ui/PageHead";
import { useSetBreadcrumbs } from "../context/BreadcrumbsContext";
import { useCurrentOrg } from "../context/OrgContext";
import { useSelectedProjectIds } from "../components/ProjectFilter";
import { ProjectPickerField, useWritableProjects } from "../components/ProjectPickerField";

type Step = "setup" | "followup" | "scenarios" | "done";

export function GenerateTestCases() {
  useSetBreadcrumbs([{ label: "Test cases", to: "/test-cases" }, { label: "Generate with AI" }]);
  const navigate = useNavigate();
  const { org } = useCurrentOrg();
  const writable = useWritableProjects();
  const [formProjectId, setFormProjectId] = useState<string>("");
  const projectIds = useSelectedProjectIds();

  // Step tracking
  const [step, setStep] = useState<Step>("setup");
  const [sessionId, setSessionId] = useState<string | null>(null);

  // Step 1: Setup
  const [allSuites, setAllSuites] = useState<TestSuiteWithTags[]>([]);
  const [testSuiteId, setTestSuiteId] = useState("");
  const [userStory, setUserStory] = useState("");
  const [loadingSuites, setLoadingSuites] = useState(true);

  // Step 2: Follow-up questions
  const [questions, setQuestions] = useState<string[]>([]);
  const [answers, setAnswers] = useState<string[]>([]);

  // Step 3: Scenarios
  const [scenarios, setScenarios] = useState<GeneratedScenario[]>([]);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());

  // Shared
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!org) return;
    // If the form has a project picked, load suites from there;
    // otherwise default to projects in the filter (for the initial "pick a project" state).
    const ids = formProjectId ? [formProjectId] : projectIds;
    if (ids.length === 0) {
      setAllSuites([]);
      setLoadingSuites(false);
      return;
    }
    testSuiteService.getAll(org.organizationId, ids, { limit: 100 }).then((res) => {
      setAllSuites(Array.isArray(res.data) ? res.data : []);
      setLoadingSuites(false);
    }).catch(() => setLoadingSuites(false));
  }, [org, formProjectId, projectIds]);

  // Default form project on first render.
  useEffect(() => {
    if (!formProjectId && writable.length > 0) {
      setFormProjectId(writable[0].projectId);
    }
  }, [writable, formProjectId]);

  const handleCreateSession = async () => {
    if (!org || !formProjectId) {
      setError("Pick a project first.");
      return;
    }
    if (!testSuiteId || !userStory.trim()) return;
    setLoading(true);
    setError("");
    try {
      const session = await aiService.createSession(org.organizationId, formProjectId, testSuiteId, userStory);
      setSessionId(session.id);
      const qs = await aiService.getFollowUpQuestions(org.organizationId, formProjectId, session.id);
      setQuestions(qs);
      setAnswers(new Array(qs.length).fill(""));
      setStep("followup");
    } catch {
      setError("Failed to start AI session. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitAnswers = async () => {
    if (!sessionId || !org || !formProjectId) return;
    setLoading(true);
    setError("");
    try {
      const qa: FollowUpQA[] = questions.map((q, i) => ({
        question: q,
        answer: answers[i] || "Not provided",
      }));
      await aiService.submitAnswers(org.organizationId, formProjectId, sessionId, qa);
      const updated = await aiService.generateScenarios(org.organizationId, formProjectId, sessionId);
      setScenarios(updated.generatedScenarios);
      setSelectedIndices(new Set(updated.generatedScenarios.map((_, i) => i)));
      setStep("scenarios");
    } catch {
      setError("Failed to generate scenarios. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSkipFollowUp = async () => {
    if (!sessionId || !org || !formProjectId) return;
    setLoading(true);
    setError("");
    try {
      const updated = await aiService.generateScenarios(org.organizationId, formProjectId, sessionId);
      setScenarios(updated.generatedScenarios);
      setSelectedIndices(new Set(updated.generatedScenarios.map((_, i) => i)));
      setStep("scenarios");
    } catch {
      setError("Failed to generate scenarios. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const toggleScenario = (index: number) => {
    setSelectedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIndices.size === scenarios.length) {
      setSelectedIndices(new Set());
    } else {
      setSelectedIndices(new Set(scenarios.map((_, i) => i)));
    }
  };

  const handleCreateTestCases = async () => {
    if (!sessionId || !org || !formProjectId || selectedIndices.size === 0) return;
    setLoading(true);
    setError("");
    try {
      await aiService.createTestCases(org.organizationId, formProjectId, sessionId, Array.from(selectedIndices));
      setStep("done");
    } catch {
      setError("Failed to create test cases. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const stepLabels = ["Describe Feature", "Answer Questions", "Select Scenarios", "Done"];
  const stepKeys: Step[] = ["setup", "followup", "scenarios", "done"];
  const currentStepIndex = stepKeys.indexOf(step);

  return (
    <div className="page narrow">
      <Button variant="ghost" size="sm" onClick={() => navigate("/test-cases")} style={{ marginBottom: 12, padding: "4px 8px" }}>
        <svg className="ico" width="14" height="14" viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6" /></svg>
        Back to cases
      </Button>
      <PageHead
        title={<>Generate <em className="italic-teal">cases</em> from a story</>}
        subtitle="Coglity will ask a few questions, propose scenarios, and draft full cases."
      />

      {/* Stepper */}
      <div className="ai-stepper">
        {stepLabels.map((label, i) => (
          <div key={label} className={`ai-step${i <= currentStepIndex ? " ai-step-active" : ""}${i < currentStepIndex ? " ai-step-completed" : ""}`}>
            <div className="ai-step-number">
              {i < currentStepIndex ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                i + 1
              )}
            </div>
            <span className="ai-step-label">{label}</span>
            {i < stepLabels.length - 1 && <div className="ai-step-line" />}
          </div>
        ))}
      </div>

      {error && <div className="ai-error">{error}</div>}

      {/* Step 1: Setup */}
      {step === "setup" && (
        <div className="ts-form">
          <div className="ts-form-title">Describe the Feature</div>
          <div className="ts-form-field">
            <label htmlFor="ai-project">Project</label>
            <ProjectPickerField id="ai-project" value={formProjectId} onChange={setFormProjectId} required />
          </div>
          <div className="ts-form-field">
            <label htmlFor="ai-suite">Test Suite</label>
            {loadingSuites ? (
              <p className="ts-form-hint">Loading suites...</p>
            ) : allSuites.length === 0 ? (
              <p className="ts-form-hint">No test suites available. Create a test suite first.</p>
            ) : (
              <Select
                value={testSuiteId ? { value: testSuiteId, label: allSuites.find((s) => s.id === testSuiteId)?.name ?? "" } : null}
                onChange={(opt) => setTestSuiteId(opt?.value ?? "")}
                options={allSuites.map((suite) => ({ value: suite.id, label: suite.name }))}
                placeholder="Select a test suite"
              />
            )}
          </div>
          <div className="ts-form-field">
            <label htmlFor="ai-story">User Story / Feature Description</label>
            <textarea
              id="ai-story"
              placeholder="As a user, I want to... so that..."
              value={userStory}
              onChange={(e) => setUserStory(e.target.value)}
              rows={6}
              style={{ resize: "vertical" }}
            />
          </div>
          <div className="ts-form-actions">
            <Button variant="ghost" onClick={() => navigate("/test-cases")}>Cancel</Button>
            <Button
              onClick={handleCreateSession}
              disabled={loading || !testSuiteId || !userStory.trim() || !formProjectId}
            >
              {loading ? "Starting..." : "Continue"}
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: Follow-up Questions */}
      {step === "followup" && (
        <div className="ts-form">
          <div className="ts-form-title">Follow-up Questions</div>
          <p className="ts-form-hint" style={{ marginBottom: "16px" }}>
            The AI has some questions to help generate better test scenarios. Answer as many as you can.
          </p>
          {questions.map((q, i) => (
            <div className="ts-form-field" key={i}>
              <label>{q}</label>
              <textarea
                placeholder="Your answer..."
                value={answers[i]}
                onChange={(e) => {
                  const next = [...answers];
                  next[i] = e.target.value;
                  setAnswers(next);
                }}
                rows={2}
                style={{ resize: "vertical" }}
              />
            </div>
          ))}
          <div className="ts-form-actions">
            <Button variant="ghost" onClick={handleSkipFollowUp} disabled={loading}>
              Skip & Generate
            </Button>
            <Button
              onClick={handleSubmitAnswers}
              disabled={loading}
            >
              {loading ? "Generating Scenarios..." : "Submit & Generate"}
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Select Scenarios */}
      {step === "scenarios" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <div>
              <span style={{ fontSize: "15px", fontWeight: 600, color: "var(--color-text)" }}>
                Generated Scenarios ({selectedIndices.size}/{scenarios.length} selected)
              </span>
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <Button variant="ghost" onClick={toggleAll}>
                {selectedIndices.size === scenarios.length ? "Deselect All" : "Select All"}
              </Button>
            </div>
          </div>
          <div className="ts-list">
            {scenarios.map((scenario, index) => (
              <div
                key={index}
                className="ts-card"
                style={{
                  cursor: "pointer",
                  borderColor: selectedIndices.has(index) ? "var(--color-accent)" : undefined,
                  background: selectedIndices.has(index) ? "var(--color-accent-subtle)" : undefined,
                }}
                onClick={() => toggleScenario(index)}
              >
                <div style={{ display: "flex", alignItems: "flex-start", gap: "12px", flex: 1, minWidth: 0 }}>
                  <input
                    type="checkbox"
                    checked={selectedIndices.has(index)}
                    onChange={() => toggleScenario(index)}
                    onClick={(e) => e.stopPropagation()}
                    style={{ marginTop: "3px", flexShrink: 0 }}
                  />
                  <div className="ts-card-body">
                    <div className="ts-card-name">{scenario.title}</div>
                    <div className="ts-card-desc" style={{ whiteSpace: "pre-wrap", overflow: "visible" }}>
                      {scenario.description}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="ts-form-actions" style={{ marginTop: "20px" }}>
            <Button variant="ghost" onClick={() => navigate("/test-cases")}>Cancel</Button>
            <Button
              onClick={handleCreateTestCases}
              disabled={loading || selectedIndices.size === 0}
            >
              {loading ? "Creating..." : `Create ${selectedIndices.size} Test Case${selectedIndices.size !== 1 ? "s" : ""} as Draft`}
            </Button>
          </div>
        </div>
      )}

      {/* Step 4: Done */}
      {step === "done" && (
        <div className="ts-empty-state">
          <div className="ts-empty-icon" style={{ opacity: 1 }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>
          <p>Test cases created as drafts!</p>
          <span style={{ marginBottom: "20px" }}>Review them in the test cases list and mark them active when ready.</span>
          <Button onClick={() => navigate("/test-cases")}>
            View Test Cases
          </Button>
        </div>
      )}
    </div>
  );
}
