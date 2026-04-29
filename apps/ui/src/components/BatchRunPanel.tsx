import { useEffect, useRef, useState } from "react";
import { SUPPORTED_LANGUAGES, SUPPORTED_ENVIRONMENTS } from "@coglity/shared";
import { testRunService, type TestRunWithUser } from "../services/testRunService";
import { Chip, type ChipVariant } from "./ui/Chip";
import { TestRunPanel } from "./TestRunPanel";

interface Props {
  orgId: string;
  projectId: string;
  batchId: string;
  onAllTerminal?: (runs: TestRunWithUser[]) => void;
}

const TERMINAL_STATES = new Set(["passed", "failed", "errored", "cancelled"]);

const STATE_CHIP: Record<string, { variant: ChipVariant; label: string }> = {
  queued:    { variant: "info", label: "Q" },
  running:   { variant: "teal", label: "R" },
  passed:    { variant: "pass", label: "P" },
  failed:    { variant: "fail", label: "F" },
  errored:   { variant: "warn", label: "E" },
  cancelled: { variant: "neutral", label: "C" },
};

export function BatchRunPanel({ orgId, projectId, batchId, onAllTerminal }: Props) {
  const [runs, setRuns] = useState<TestRunWithUser[]>([]);
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);
  const [error, setError] = useState<string>("");
  const notifiedRef = useRef(false);

  useEffect(() => {
    notifiedRef.current = false;
    let cancelled = false;
    let timer: number | undefined;

    const tick = async () => {
      try {
        const result = await testRunService.listByBatch(orgId, projectId, batchId);
        if (cancelled) return;
        setRuns(result);
        const allTerminal = result.length > 0 && result.every((r) => TERMINAL_STATES.has(r.state));
        if (allTerminal) {
          if (!notifiedRef.current) {
            notifiedRef.current = true;
            onAllTerminal?.(result);
          }
          return;
        }
        timer = window.setTimeout(tick, 2000);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Failed to load runs");
      }
    };
    tick();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [orgId, projectId, batchId, onAllTerminal]);

  if (error) return <div className="run-panel-error">Error loading batch: {error}</div>;
  if (runs.length === 0) return <div className="run-panel-loading">Loading batch runs...</div>;

  const total = runs.length;
  const completed = runs.filter((r) => TERMINAL_STATES.has(r.state)).length;
  const passed = runs.filter((r) => r.state === "passed").length;
  const failed = runs.filter((r) => r.state === "failed").length;
  const errored = runs.filter((r) => r.state === "errored").length;

  const languages = [...new Set(runs.map((r) => r.language))].sort();
  const environments = [...new Set(runs.map((r) => r.environment))].sort();

  const getRunForCell = (lang: string, env: string) =>
    runs.find((r) => r.language === lang && r.environment === env);

  return (
    <div style={containerStyle}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
        <span style={{ fontSize: 14, fontWeight: 600 }}>Batch Run</span>
        <span className="muted" style={{ fontSize: 12 }}>
          {completed}/{total} complete
        </span>
        {passed > 0 && <Chip variant="pass">{passed} passed</Chip>}
        {failed > 0 && <Chip variant="fail">{failed} failed</Chip>}
        {errored > 0 && <Chip variant="warn">{errored} errored</Chip>}
      </div>

      <div style={{ overflowX: "auto", marginBottom: 12 }}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}></th>
              {environments.map((env) => (
                <th key={env} style={thStyle}>
                  {SUPPORTED_ENVIRONMENTS.find((e) => e.id === env)?.label ?? env}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {languages.map((lang) => (
              <tr key={lang}>
                <td style={tdLabelStyle}>
                  {SUPPORTED_LANGUAGES.find((l) => l.code === lang)?.label ?? lang}
                </td>
                {environments.map((env) => {
                  const run = getRunForCell(lang, env);
                  if (!run) return <td key={env} style={tdStyle}>-</td>;
                  const chip = STATE_CHIP[run.state] ?? STATE_CHIP.queued;
                  return (
                    <td key={env} style={tdStyle}>
                      <button
                        style={cellBtnStyle}
                        onClick={() => setExpandedRunId(expandedRunId === run.id ? null : run.id)}
                        title={`${run.state}${run.verdict ? `: ${run.verdict.slice(0, 80)}` : ""}`}
                      >
                        <Chip variant={chip.variant} dot={run.state === "running"} pulse={run.state === "running"}>
                          {chip.label}
                        </Chip>
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {expandedRunId && (
        <TestRunPanel orgId={orgId} projectId={projectId} runId={expandedRunId} />
      )}
    </div>
  );
}

const containerStyle: React.CSSProperties = {
  border: "1px solid var(--line)",
  borderRadius: 12,
  padding: 16,
  background: "var(--bg-1)",
  marginBottom: 16,
};

const tableStyle: React.CSSProperties = {
  borderCollapse: "collapse",
  width: "100%",
  fontSize: 13,
};

const thStyle: React.CSSProperties = {
  textAlign: "center",
  padding: "6px 10px",
  fontSize: 11,
  fontWeight: 600,
  color: "var(--muted)",
  borderBottom: "1px solid var(--line)",
};

const tdLabelStyle: React.CSSProperties = {
  padding: "6px 10px",
  fontSize: 12,
  fontWeight: 600,
  color: "var(--ink)",
  borderBottom: "1px solid var(--line)",
  whiteSpace: "nowrap",
};

const tdStyle: React.CSSProperties = {
  textAlign: "center",
  padding: "6px 10px",
  borderBottom: "1px solid var(--line)",
};

const cellBtnStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  cursor: "pointer",
  padding: 0,
};
