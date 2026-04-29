import { useEffect, useRef, useState } from "react";
import { SUPPORTED_LANGUAGES, SUPPORTED_ENVIRONMENTS } from "@coglity/shared";
import { testRunService, type TestRunWithUser } from "../services/testRunService";
import { Chip, type ChipVariant } from "./ui/Chip";

interface Props {
  orgId: string;
  projectId: string;
  runId: string;
  onTerminal?: (run: TestRunWithUser) => void;
}

const TERMINAL_STATES = new Set(["passed", "failed", "errored", "cancelled"]);

const STATE_CHIP: Record<string, { variant: ChipVariant; label: string; pulse?: boolean }> = {
  queued:    { variant: "info", label: "Queued" },
  running:   { variant: "teal", label: "Running", pulse: true },
  passed:    { variant: "pass", label: "Passed" },
  failed:    { variant: "fail", label: "Failed" },
  errored:   { variant: "warn", label: "Errored" },
  cancelled: { variant: "neutral", label: "Cancelled" },
};

export function TestRunPanel({ orgId, projectId, runId, onTerminal }: Props) {
  const [run, setRun] = useState<TestRunWithUser | null>(null);
  const [error, setError] = useState<string>("");
  const notifiedRef = useRef(false);

  useEffect(() => {
    notifiedRef.current = false;
    let cancelled = false;
    let timer: number | undefined;

    const tick = async () => {
      try {
        const next = await testRunService.getById(orgId, projectId, runId);
        if (cancelled) return;
        setRun(next);
        if (TERMINAL_STATES.has(next.state)) {
          if (!notifiedRef.current) {
            notifiedRef.current = true;
            onTerminal?.(next);
          }
          return; // stop polling
        }
        timer = window.setTimeout(tick, 1000);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Failed to load run");
      }
    };
    tick();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [orgId, projectId, runId, onTerminal]);

  if (error) {
    return <div className="run-panel-error">Error loading run: {error}</div>;
  }
  if (!run) {
    return <div className="run-panel-loading">Starting run…</div>;
  }

  const chip = STATE_CHIP[run.state] ?? STATE_CHIP.queued;

  return (
    <div className="run-panel" style={panelStyle}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <Chip variant={chip.variant} dot pulse={chip.pulse}>{chip.label}</Chip>
        {run.language && run.language !== "en-US" && (
          <Chip variant="info">{SUPPORTED_LANGUAGES.find((l) => l.code === run.language)?.label ?? run.language}</Chip>
        )}
        {run.environment && run.environment !== "quiet" && (
          <Chip variant="warn">{SUPPORTED_ENVIRONMENTS.find((e) => e.id === run.environment)?.label ?? run.environment}</Chip>
        )}
        {run.startedAt && (
          <span className="muted" style={{ fontSize: 12 }}>
            Started {new Date(run.startedAt).toLocaleTimeString()}
            {run.finishedAt && ` · Finished ${new Date(run.finishedAt).toLocaleTimeString()}`}
          </span>
        )}
      </div>

      {run.state === "errored" && run.error && (
        <div className="run-panel-error" style={errorBoxStyle}>
          <strong>Error:</strong> {run.error}
        </div>
      )}

      {run.verdict && (
        <div style={verdictBoxStyle}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", marginBottom: 4 }}>
            Verdict
          </div>
          <div style={{ whiteSpace: "pre-wrap" }}>{run.verdict}</div>
        </div>
      )}

      {run.recordingUrl && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", marginBottom: 4 }}>
            Recording
          </div>
          <audio controls src={run.recordingUrl} style={{ width: "100%" }} />
          <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
            {(run.recordingDurationMs / 1000).toFixed(1)}s · stereo (left: tester, right: SUT)
          </div>
        </div>
      )}

      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", marginBottom: 8 }}>
          Transcript
        </div>
        {run.transcript.length === 0 ? (
          <div className="muted" style={{ fontSize: 13 }}>
            {run.state === "running" || run.state === "queued"
              ? "Waiting for first utterance…"
              : "No transcript captured."}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {run.transcript.map((turn, i) => (
              <div
                key={i}
                style={{
                  alignSelf: turn.role === "tester" ? "flex-end" : "flex-start",
                  maxWidth: "80%",
                  background: turn.role === "tester" ? "var(--teal-bg)" : "var(--bg-2)",
                  color: "var(--ink)",
                  border: "1px solid var(--line)",
                  borderRadius: 10,
                  padding: "6px 10px",
                  fontSize: 13,
                }}
              >
                <div style={{ fontSize: 10, fontWeight: 600, color: "var(--muted)", marginBottom: 2 }}>
                  {turn.role === "tester" ? "Tester" : turn.role === "sut" ? "Bot under test" : "System"}
                </div>
                {turn.text}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const panelStyle: React.CSSProperties = {
  border: "1px solid var(--line)",
  borderRadius: 12,
  padding: 16,
  background: "var(--bg-1)",
  marginBottom: 16,
};

const errorBoxStyle: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 8,
  background: "var(--red-bg)",
  color: "var(--red)",
  marginBottom: 12,
  fontSize: 13,
};

const verdictBoxStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 8,
  background: "var(--bg-2)",
  border: "1px solid var(--line)",
  marginBottom: 12,
  fontSize: 13,
};
