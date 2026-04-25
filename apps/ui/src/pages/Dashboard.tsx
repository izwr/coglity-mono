import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { CardHead } from "../components/ui/Card";
import { Chip } from "../components/ui/Chip";
import { Sparkline } from "../components/ui/Sparkline";
import { Button } from "../components/ui/Button";
import { useSetBreadcrumbs } from "../context/BreadcrumbsContext";
import { testCaseService, type TestCaseWithTags } from "../services/testCaseService";
import { testSuiteService } from "../services/testSuiteService";
import { bugService } from "../services/bugService";
import { scheduledTestSuiteService } from "../services/scheduledTestSuiteService";
import { botConnectionService, type BotConnectionWithUser } from "../services/botConnectionService";
import { useCurrentOrg } from "../context/OrgContext";

function greeting(hour: number) {
  if (hour < 5) return "Good evening";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function daysFeelCopy(fails: number) {
  if (fails === 0) return "Today is calm.";
  if (fails <= 3) return "A few things need your eye.";
  if (fails <= 8) return "A busy morning ahead.";
  return "Storm clouds brewing.";
}

export function Dashboard() {
  const { user } = useAuth();
  const { org } = useCurrentOrg();
  const navigate = useNavigate();
  useSetBreadcrumbs([{ label: "Dashboard" }]);

  const [suiteCount, setSuiteCount] = useState<number | null>(null);
  const [caseCount, setCaseCount] = useState<number | null>(null);
  const [bugCount, setBugCount] = useState<number | null>(null);
  const [runCount, setRunCount] = useState<number | null>(null);
  const [recentCases, setRecentCases] = useState<TestCaseWithTags[]>([]);
  const [bots, setBots] = useState<BotConnectionWithUser[]>([]);

  useEffect(() => {
    if (!org) return;
    const orgId = org.organizationId;
    const ids = org.projects.map((p) => p.projectId);
    if (ids.length === 0) {
      setSuiteCount(0); setCaseCount(0); setBugCount(0); setRunCount(0); setBots([]); setRecentCases([]);
      return;
    }
    (async () => {
      try {
        const suites = await testSuiteService.getAll(orgId, ids, { limit: 1 });
        setSuiteCount(suites.total);
      } catch { setSuiteCount(0); }
      try {
        const cases = await testCaseService.getAll(orgId, ids, { limit: 5, sortBy: "updatedAt", sortDir: "desc" });
        setCaseCount(cases.total);
        setRecentCases(cases.data);
      } catch { setCaseCount(0); }
      try {
        const bugs = await bugService.getAll(orgId, ids, { limit: 1 });
        setBugCount(bugs.total);
      } catch { setBugCount(0); }
      try {
        const runs = await scheduledTestSuiteService.getAll(orgId, ids, { limit: 1 });
        setRunCount(runs.total);
      } catch { setRunCount(0); }
      try {
        const b = await botConnectionService.getAll(orgId, ids, { limit: 10 });
        setBots(b.data);
      } catch { setBots([]); }
    })();
  }, [org]);

  const firstName = user?.displayName?.split(" ")[0] ?? "there";
  const feel = daysFeelCopy(bugCount ?? 0);
  const sparkA = [88, 91, 90, 93, 95, 92, 94, 96, 95, 97];
  const sparkB = [120, 132, 125, 140, 138, 150, 145, 160, 158, 165];

  const stats: Array<{ label: string; value: string; delta?: string; dir?: "up" | "down"; foot?: React.ReactNode }> = [
    {
      label: "30d pass rate",
      value: "95.1%",
      delta: "+1.8% vs prev",
      dir: "up",
      foot: <Sparkline data={sparkA} height={32} />,
    },
    {
      label: "Runs this week",
      value: String(runCount ?? "—"),
      delta: "scheduled",
      foot: <Sparkline data={sparkB} height={32} color="var(--ink-3)" />,
    },
    {
      label: "Open failures",
      value: String(bugCount ?? "—"),
      delta: feel,
    },
    {
      label: "CU balance",
      value: "72%",
      delta: "22 days remaining",
      foot: (
        <div className="meter" style={{ marginTop: 10 }}>
          <span style={{ width: "72%" }} />
        </div>
      ),
    },
  ];

  return (
    <div className="page">
      <div className="dash-hero">
        <h1>
          {greeting(new Date().getHours())}, {firstName}. <em>{feel}</em>
        </h1>
        <div className="sub">
          {suiteCount ?? 0} suites · {caseCount ?? 0} cases · {runCount ?? 0} scheduled runs · {bugCount ?? 0} open bugs
        </div>
      </div>

      <div className="page-head" style={{ marginBottom: 20 }}>
        <div className="row gap-lg">
          <Button variant="teal" onClick={() => navigate("/test-cases/generate")}>
            <svg className="ico" viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" /></svg>
            Ask Coglity
          </Button>
          <Button onClick={() => navigate("/test-cases")}>
            <svg className="ico" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg>
            New test case
          </Button>
          <Button variant="primary" onClick={() => navigate("/scheduled-test-suites")}>
            <svg className="ico" viewBox="0 0 24 24"><path d="M5 3l14 9-14 9V3z" /></svg>
            Run suite
          </Button>
        </div>
      </div>

      <div className="dash-grid">
        {stats.map((s) => (
          <div key={s.label} className="card stat">
            <div className="label">{s.label}</div>
            <div className="value">{s.value}</div>
            {s.delta && <div className={`delta${s.dir ? ` ${s.dir}` : ""}`}>{s.delta}</div>}
            {s.foot}
          </div>
        ))}
      </div>

      <div className="dash-layout">
        <div className="col gap-lg">
          <div className="card">
            <CardHead
              title={<>Recent <em className="italic-teal">activity</em></>}
              actions={<Button variant="ghost" size="sm" onClick={() => navigate("/test-cases")}>See all</Button>}
            />
            {recentCases.length === 0 ? (
              <div className="card-body muted" style={{ fontSize: 13 }}>No recent activity yet.</div>
            ) : (
              <div className="table-scroll">
                <table className="t">
                  <thead>
                    <tr><th>Case</th><th>Suite</th><th>Type</th><th>Status</th><th>Updated</th></tr>
                  </thead>
                  <tbody>
                    {recentCases.map((c) => (
                      <tr key={c.id} onClick={() => navigate(`/test-cases/${c.id}`)} style={{ cursor: "pointer" }}>
                        <td>{c.title}</td>
                        <td className="muted">{c.testSuiteName}</td>
                        <td><Chip variant={c.testCaseType as any}>{c.testCaseType}</Chip></td>
                        <td>
                          {c.status === "active"
                            ? <Chip variant="pass" dot>active</Chip>
                            : <Chip variant="warn" dot>draft</Chip>}
                        </td>
                        <td className="mono">{new Date(c.updatedAt).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="dash-ai">
            <div className="section-label" style={{ marginBottom: 10 }}>AI · surfaced</div>
            <h3>Three cases show signs of <em className="italic-teal">flakiness</em></h3>
            <p>
              Coglity noticed <code>bill-payment/confirm-number</code> failing ~14% of runs on
              <code>staging</code>. Worth reviewing against the new intent schema.
            </p>
            <div className="row" style={{ marginTop: 14 }}>
              <Button variant="teal" size="sm" onClick={() => navigate("/reporting")}>Open report</Button>
              <Button variant="ghost" size="sm">Dismiss</Button>
            </div>
          </div>
        </div>

        <div className="col gap-lg">
          <div className="card">
            <CardHead title={<>Systems under test</>} actions={<Button variant="ghost" size="sm" onClick={() => navigate("/bot-connections")}>Manage</Button>} />
            <div className="card-body col">
              {bots.length === 0 ? (
                <div className="muted" style={{ fontSize: 13 }}>No bots connected yet.</div>
              ) : bots.slice(0, 5).map((b) => (
                <div key={b.id} className="row" style={{ padding: "8px 0", borderBottom: "1px solid var(--line)" }}>
                  <Chip variant={(b.botType as any) || "neutral"} dot pulse>
                    {b.botType}
                  </Chip>
                  <div style={{ fontSize: 13, color: "var(--ink)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.name}</div>
                  <span className="mono muted-2" style={{ marginLeft: "auto", fontSize: 11.5 }}>{b.provider}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <CardHead title={<>Quick <em className="italic-teal">actions</em></>} />
            <div className="card-body col gap-lg">
              {[
                { label: "Generate cases from a story", to: "/test-cases/generate", d: "M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" },
                { label: "Schedule a suite run", to: "/scheduled-test-suites", d: "M5 3l14 9-14 9V3z" },
                { label: "Connect a new bot", to: "/bot-connections", d: "M12 2v3M6 9h12a2 2 0 012 2v7a2 2 0 01-2 2H6a2 2 0 01-2-2v-7a2 2 0 012-2z" },
                { label: "View reports", to: "/reporting", d: "M4 20V10M10 20V4M16 20v-7M22 20H2" },
              ].map((a) => (
                <button key={a.to} className="row" onClick={() => navigate(a.to)} style={{ padding: "8px 0", cursor: "pointer", textAlign: "left", width: "100%" }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: "var(--bg-2)", display: "grid", placeItems: "center", color: "var(--teal)" }}>
                    <svg className="ico" width="14" height="14" viewBox="0 0 24 24"><path d={a.d} /></svg>
                  </div>
                  <span style={{ fontSize: 13.5, color: "var(--ink)" }}>{a.label}</span>
                  <svg className="ico" style={{ marginLeft: "auto", color: "var(--muted-2)" }} width="14" height="14" viewBox="0 0 24 24"><path d="M9 6l6 6-6 6" /></svg>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
