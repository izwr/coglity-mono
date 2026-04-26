import { ArrowRight } from "./icons";

export default function LandingPage() {
  return (
    <>
      <Nav />
      <Hero />
      <ProblemSection />
      <FeaturesSection />
      <WorkflowSection />
      <ProcessStrip />
      <MetricsRow />
      <PricingSection />
      <FAQSection />
      <BigCTA />
      <Footer />
    </>
  );
}

/* ────────────────────────────── Nav ────────────────────────────── */
function Nav() {
  return (
    <nav className="top">
      <div className="wrap inner">
        <a href="/" className="brand">
          <img className="brand-mark" src="/logo.svg" alt="Coglity" />
          <div className="brand-name" style={{ fontFamily: "var(--font-serif)" }}>
            Cog<em>lity</em>
          </div>
        </a>
        <ul>
          <li><a href="#product">Product</a></li>
          <li><a href="#workflow">How it works</a></li>
          <li><a href="#pricing">Pricing</a></li>
        </ul>
        <div className="right">
          <a href="https://studio.coglity.com" className="btn primary">
            Get started
            <ArrowRight />
          </a>
        </div>
      </div>
    </nav>
  );
}

/* ────────────────────────────── Hero ────────────────────────────── */
function Hero() {
  return (
    <div className="hero">
      <div className="wrap">
        <div className="pill">
          <span className="tag">NEW</span> Adversarial test generation is live &rarr;
        </div>
        <h1 className="display" style={{ fontFamily: "var(--font-serif)" }}>
          QA for <em>conversational AI</em>, from the first intent to the nightly regression.
        </h1>
        <p className="lede">
          Coglity is the testing platform for voice bots, chatbots, and agents. Author cases with an
          AI copilot, run them at scale across environments, and catch regressions before your users
          do.
        </p>
        <div className="hero-cta">
          <a href="https://studio.coglity.com" className="btn teal lg">
            Get started free
            <ArrowRight />
          </a>
          <span className="micro">5,000 CU free · no card required · SOC 2 Type II</span>
        </div>

        <div className="hero-shot">
          <div className="frame">
            <div className="win-bar">
              <div className="dot" style={{ background: "#FF5F57" }} />
              <div className="dot" style={{ background: "#FEBC2E" }} />
              <div className="dot" style={{ background: "#28C840" }} />
              <div className="url" style={{ fontFamily: "var(--font-mono)" }}>
                coglity.app/ridgeline-qa/runs/r_9f12
              </div>
              <div style={{ width: 44 }} />
            </div>
            <div className="screenshot">
              <MockRunLive />
            </div>
          </div>
          <div className="tag-float tl">
            <div className="l">Live run</div>
            <div className="v" style={{ fontFamily: "var(--font-serif)" }}>
              204 / 204 <em>passed</em>
            </div>
            <div style={{ fontSize: 11, color: "var(--green)", marginTop: 1 }}>
              ▲ 1.8% vs. last run
            </div>
          </div>
          <div className="tag-float br">
            <div className="l">Root cause (AI)</div>
            <div className="v" style={{ fontFamily: "var(--font-serif)" }}>
              Tool call <em>mismatch</em>
            </div>
            <div
              style={{
                fontSize: 11,
                color: "var(--muted)",
                marginTop: 2,
                fontFamily: "var(--font-mono)",
              }}
            >
              get_balance · account_id
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────── Problem ────────────────────────────── */
function ProblemSection() {
  return (
    <section id="problem">
      <div className="wrap">
        <div className="section-head">
          <div className="eyebrow"><span className="tick" />The problem</div>
          <h2 className="disp" style={{ fontFamily: "var(--font-serif)" }}>
            Your bot passes the demo. <em>Then production happens.</em>
          </h2>
          <p className="sub">
            Traditional QA tooling was built for deterministic APIs. Conversational AI is stochastic,
            multi-turn, and tool-using,and your test suite is a spreadsheet and a Slack thread.
          </p>
        </div>
        <div className="problem-grid">
          <div className="prob-card old">
            <div className="card-tag">Today</div>
            <h3 style={{ fontFamily: "var(--font-serif)" }}>
              Spreadsheets, screenshots, <em>and hope</em>.
            </h3>
            <ul className="prob-list">
              <li><span className="ic">&times;</span>Prompts change on Tuesday; Thursday&apos;s release ships a regression no one caught.</li>
              <li><span className="ic">&times;</span>Your &quot;test suite&quot; is 40 rows of example inputs a PM wrote once.</li>
              <li><span className="ic">&times;</span>Tool calls and handoffs are untested,you find bugs in Sentry, not CI.</li>
              <li><span className="ic">&times;</span>Nobody can tell you the pass rate of last night&apos;s build in under an hour.</li>
            </ul>
          </div>
          <div className="prob-card new">
            <div className="card-tag">With Coglity</div>
            <h3 style={{ fontFamily: "var(--font-serif)" }}>
              QA that actually <em>understands conversation</em>.
            </h3>
            <ul className="prob-list">
              <li><span className="ic">✓</span>Every merge triggers 200+ adversarial test cases,voice, chat, and agent.</li>
              <li><span className="ic">✓</span>AI-authored variants expand coverage faster than humans can type.</li>
              <li><span className="ic">✓</span>Tool-call and handoff validation baked in,not an afterthought.</li>
              <li><span className="ic">✓</span>Pass rate, flaky cases, and root cause land in Slack by 7am.</li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ────────────────────────────── Features ────────────────────────────── */
function FeaturesSection() {
  const features = [
    { icon: "M12 2l2.4 5.6L20 10l-5.6 2.4L12 18l-2.4-5.6L4 10l5.6-2.4L12 2z", title: "AI test authoring", desc: "Describe an intent in plain English; Coglity drafts Given/When/Then, adversarial variants, and the tool-call assertions. You review, refine, commit." },
    { icon: "M5 3l14 9-14 9V3z", title: "Parallel runs", desc: "Run 200 cases against staging in 4 minutes, not 40. Streamed results, per-case transcripts, diff against the last green run." },
    { icon: "M12 7v5l3 2", circle: true, title: "Live triage", desc: "Per-case status ticks in real time. One click to a transcript diff, the tool-call inspector, and an inferred root cause from our triage model." },
    { icon: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z", title: "Voice · chat · agent", desc: "One platform for every modality. Voice runs capture audio, latency, ASR confidence; chat captures turn-by-turn; agents get tool-call traces." },
    { icon: "M12 22s8-6 8-12a8 8 0 00-16 0c0 6 8 12 8 12z", innerCircle: true, title: "Adversarial coverage", desc: "Curated attack suites for prompt injection, refusal bypasses, PII leaks, and jailbreaks. Scheduled nightly, updated weekly by our red team." },
    { icon: "M3 3v18h18M7 15l4-4 3 3 5-7", title: "Reports that ship", desc: "Pass-rate trends, flakiness leaderboards, intent × env heatmaps. Scheduled to Slack, email, or your CI. Your PM will actually read this one." },
  ];
  return (
    <section id="product">
      <div className="wrap">
        <div className="section-head">
          <div className="eyebrow"><span className="tick" />Platform</div>
          <h2 className="disp" style={{ fontFamily: "var(--font-serif)" }}>
            Everything you need to ship a bot you actually <em>trust</em>.
          </h2>
        </div>
        <div className="features">
          {features.map((f) => (
            <div key={f.title} className="feat">
              <div className="ico">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                  {f.circle && <circle cx="12" cy="12" r="9" />}
                  {f.innerCircle && <circle cx="12" cy="10" r="3" />}
                  <path d={f.icon} />
                </svg>
              </div>
              <h3 style={{ fontFamily: "var(--font-serif)" }}>{f.title}</h3>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ────────────────────────────── Workflow Splits ────────────────────────────── */
function WorkflowSection() {
  return (
    <section id="workflow">
      <div className="wrap">
        <div className="section-head">
          <div className="eyebrow"><span className="tick" />How it works</div>
          <h2 className="disp" style={{ fontFamily: "var(--font-serif)" }}>
            Author. Run. <em>Triage.</em> Ship.
          </h2>
        </div>

        {/* Authoring split */}
        <div className="split">
          <div className="copy">
            <div className="chip">Authoring</div>
            <h3 style={{ fontFamily: "var(--font-serif)" }}>
              An AI copilot that <em>actually understands</em> conversation.
            </h3>
            <p>Start with one intent. Coglity drafts Given/When/Then, generates adversarial variants, and proposes the tool-call contract. You stay in charge.</p>
            <ul className="bullets">
              <li><span className="tick-mark">✓</span><span><b>Inline refinement</b>,&quot;make it ruder&quot;, &quot;add a PII leak attempt&quot;</span></li>
              <li><span className="tick-mark">✓</span><span><b>Variant fan-out</b>,one case spawns 8 stress tests</span></li>
              <li><span className="tick-mark">✓</span><span><b>Keyboard-first</b>,Cmd+K runs everything</span></li>
            </ul>
            <a href="https://studio.coglity.com" className="btn teal">Try the authoring copilot <ArrowRight /></a>
          </div>
          <div className="shot">
            <div className="screenshot"><MockAuthor /></div>
          </div>
        </div>

        {/* Live runs split (reversed) */}
        <div className="split rev">
          <div className="shot">
            <div className="screenshot"><MockRunLive /></div>
          </div>
          <div className="copy">
            <div className="chip">Live runs</div>
            <h3 style={{ fontFamily: "var(--font-serif)" }}>
              See every case tick green <em>or know why it didn&apos;t</em>.
            </h3>
            <p>Runs stream in real time. When a case fails, Coglity opens a triage pane with a transcript diff, the tool-call inspector, and an inferred root cause.</p>
            <ul className="bullets">
              <li><span className="tick-mark">✓</span><span><b>Transcript diff</b> vs. the last green run</span></li>
              <li><span className="tick-mark">✓</span><span><b>Tool-call inspector</b>,JSON request, response, timing</span></li>
              <li><span className="tick-mark">✓</span><span><b>One-click</b> to Jira, Linear, or GitHub</span></li>
            </ul>
            <a href="https://studio.coglity.com" className="btn">Explore live triage <ArrowRight /></a>
          </div>
        </div>

        {/* Reporting split */}
        <div className="split" style={{ marginBottom: 0 }}>
          <div className="copy">
            <div className="chip">Reporting</div>
            <h3 style={{ fontFamily: "var(--font-serif)" }}>
              The <em>weekly digest</em> your PM actually opens.
            </h3>
            <p>Pass-rate trends, flakiness leaderboards, failure heatmaps by intent and environment. Scheduled to Slack, email, or your CI.</p>
            <ul className="bullets">
              <li><span className="tick-mark">✓</span><span><b>Trend lines</b> for 30 / 60 / 90 days</span></li>
              <li><span className="tick-mark">✓</span><span><b>Flakiness score</b> per case,stop chasing ghosts</span></li>
              <li><span className="tick-mark">✓</span><span><b>Intent × env heatmap</b>,spot the weak corners fast</span></li>
            </ul>
            <a href="https://studio.coglity.com" className="btn">See the report format <ArrowRight /></a>
          </div>
          <div className="shot">
            <div className="screenshot"><MockReports /></div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ────────────────────────────── Process Strip ────────────────────────────── */
function ProcessStrip() {
  const steps = [
    { num: "01 / CONNECT", title: "Point at your bot", desc: "Plug in a webhook or SDK endpoint. Voice, chat, or agent. Dev, staging, and prod.", bars: [20, 30, 25, 35, 28] },
    { num: "02 / AUTHOR", title: "Draft with the copilot", desc: "Describe intents, let Coglity expand them into adversarial variants you'd never type.", bars: [35, 50, 42, 60, 55] },
    { num: "03 / RUN", title: "Execute in parallel", desc: "Trigger on PR, on deploy, on schedule. 200 cases in under 5 minutes.", bars: [70, 85, 78, 92, 88] },
    { num: "04 / TRIAGE", title: "Fix what broke", desc: "Diff, root-cause, ticket. Ship the fix before anyone opens Sentry.", bars: [90, 98, 92, 96, 100] },
  ];
  return (
    <section style={{ paddingTop: 40, borderTop: 0 }}>
      <div className="wrap">
        <div className="flow">
          {steps.map((s) => (
            <div key={s.num} className="step">
              <div className="num" style={{ fontFamily: "var(--font-mono)" }}>{s.num}</div>
              <h4 style={{ fontFamily: "var(--font-serif)" }}>{s.title}</h4>
              <p>{s.desc}</p>
              <div className="viz">
                {s.bars.map((h, i) => (
                  <div key={i} className="bar" style={{ height: `${h}%` }} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ────────────────────────────── Metrics ────────────────────────────── */
function MetricsRow() {
  const data = [
    { value: "12×", label: "More test coverage\nper engineer-week" },
    { value: "4m", label: "Median wall-clock for\na 200-case suite" },
    { value: "94%", label: "Regressions caught\nbefore customer reports" },
    { value: "18", label: "Integrations,CI,\nticketing, observability" },
  ];
  return (
    <section style={{ padding: 0 }}>
      <div className="wrap">
        <div className="metrics">
          {data.map((d) => (
            <div key={d.value} className="metric">
              <div className="v" style={{ fontFamily: "var(--font-serif)" }}>
                <em>{d.value}</em>
              </div>
              <div className="l" style={{ whiteSpace: "pre-line" }}>{d.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ────────────────────────────── Pricing ────────────────────────────── */
function PricingSection() {
  return (
    <section id="pricing">
      <div className="wrap">
        <div className="section-head">
          <div className="eyebrow"><span className="tick" />Pricing</div>
          <h2 className="disp" style={{ fontFamily: "var(--font-serif)" }}>
            Pay for <em>Conversation Units</em>, not seats.
          </h2>
          <p className="sub">
            One CU = one complete test case execution. Bulk on schedules, spike on releases; your
            bill tracks the work, not the roster.
          </p>
        </div>
        <div className="pricing">
          {/* Starter */}
          <div className="tier">
            <h4 style={{ fontFamily: "var(--font-serif)" }}>Starter</h4>
            <div className="price" style={{ fontFamily: "var(--font-serif)" }}>
              $0<span className="unit">/ mo</span>
            </div>
            <div className="cu" style={{ fontFamily: "var(--font-mono)" }}>5,000 CU included · no card</div>
            <div className="desc">For solo builders and teams kicking the tires. Up to 3 seats.</div>
            <ul>
              <li><span className="tick-mark">✓</span>Up to 3 projects · 200 test cases</li>
              <li><span className="tick-mark">✓</span>AI authoring copilot</li>
              <li><span className="tick-mark">✓</span>Community support</li>
              <li><span className="tick-mark">✓</span>7-day run retention</li>
            </ul>
            <a href="https://studio.coglity.com" className="btn">Get started free</a>
          </div>
          {/* Team (featured) */}
          <div className="tier featured">
            <div className="ribbon">Most popular</div>
            <h4 style={{ fontFamily: "var(--font-serif)" }}>
              Team<em> · for growing teams</em>
            </h4>
            <div className="price" style={{ fontFamily: "var(--font-serif)" }}>
              $0.008<span className="unit">/ CU</span>
            </div>
            <div className="cu" style={{ fontFamily: "var(--font-mono)" }}>from $299/mo · annual billing</div>
            <div className="desc">
              For teams with a bot in staging, a release cadence, and at least one PM who gets pinged
              about failures.
            </div>
            <ul>
              <li><span className="tick-mark">✓</span>Unlimited projects and cases</li>
              <li><span className="tick-mark">✓</span>Adversarial suite library + scheduled runs</li>
              <li><span className="tick-mark">✓</span>Slack, Jira, Linear, GitHub, PagerDuty</li>
              <li><span className="tick-mark">✓</span>90-day retention · RBAC</li>
              <li><span className="tick-mark">✓</span>Priority support · 4h response</li>
            </ul>
            <a href="https://studio.coglity.com" className="btn">Start 14-day trial</a>
          </div>
          {/* Enterprise */}
          <div className="tier">
            <h4 style={{ fontFamily: "var(--font-serif)" }}>Enterprise</h4>
            <div className="price" style={{ fontFamily: "var(--font-serif)" }}>Custom</div>
            <div className="cu" style={{ fontFamily: "var(--font-mono)" }}>volume CU · annual contract</div>
            <div className="desc">
              For regulated industries and global deployments. SSO, DPA, deployment flexibility.
            </div>
            <ul>
              <li><span className="tick-mark">✓</span>SAML SSO, SCIM, audit log export</li>
              <li><span className="tick-mark">✓</span>Dedicated CSM · custom SLA</li>
              <li><span className="tick-mark">✓</span>VPC / self-hosted option</li>
              <li><span className="tick-mark">✓</span>SOC 2 Type II · HIPAA · GDPR</li>
              <li><span className="tick-mark">✓</span>Custom adversarial suite authoring</li>
            </ul>
            <a href="https://studio.coglity.com" className="btn">Get started</a>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ────────────────────────────── FAQ ────────────────────────────── */
function FAQSection() {
  const items = [
    { q: "What's a Conversation Unit?", a: "One CU is one complete test case run against a connected bot, regardless of turn count. A 3-turn chat case and a 20-turn voice case both burn 1 CU. Adversarial variants inside a case are free." },
    { q: "Do you support voice bots?", a: "Yes. We capture audio, ASR confidence, latency per turn, and barge-in behavior. We integrate with Twilio, Vonage, LiveKit, and bring-your-own-SIP." },
    { q: "How does adversarial testing work?", a: "We maintain a curated library of attack patterns,prompt injection, PII extraction, refusal bypasses, jailbreaks, indirect injection from retrieved documents. You enable the suites that matter; they run on your schedule and we update them weekly." },
    { q: "Can we self-host?", a: "Enterprise customers can deploy Coglity in a customer-managed VPC on AWS, GCP, or Azure. The control plane stays with us; all test data, transcripts, and artifacts live in your environment." },
    { q: "Which models and providers do you work with?", a: "Anything behind an HTTP endpoint. Native integrations for OpenAI, Anthropic, AWS Bedrock, Azure OpenAI, Google Vertex, and common voice stacks. Custom endpoints with any auth,including mTLS and signed requests,via the connector SDK." },
    { q: "Is it secure?", a: "SOC 2 Type II, GDPR-compliant, HIPAA-ready with a signed BAA. Secrets stay in your secrets manager; we never store production credentials. Full audit log, SAML SSO, and SCIM on Enterprise." },
  ];
  return (
    <section>
      <div className="wrap">
        <div className="faq">
          <div>
            <div className="eyebrow"><span className="tick" />FAQ</div>
            <h2 className="disp" style={{ fontFamily: "var(--font-serif)", fontSize: 44 }}>
              Questions we <em>usually</em> get.
            </h2>
          </div>
          <div>
            {items.map((item, i) => (
              <details key={i} open={i === 0}>
                <summary style={{ fontFamily: "var(--font-serif)" }}>
                  {item.q}
                  <span className="plus">+</span>
                </summary>
                <div className="ans">{item.a}</div>
              </details>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ────────────────────────────── Big CTA ────────────────────────────── */
function BigCTA() {
  return (
    <div className="big-cta">
      <div className="inner">
        <h2 style={{ fontFamily: "var(--font-serif)" }}>
          Ship a bot you&apos;d <em>let your mom use</em>.
        </h2>
        <p>
          Start free with 5,000 CU. Hook up your bot in under four minutes. Catch the regression
          that&apos;s already in main.
        </p>
        <div className="cta-row">
          <a href="https://studio.coglity.com" className="btn-white">
            Get started free
            <ArrowRight />
          </a>
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────── Footer ────────────────────────────── */
function Footer() {
  return (
    <footer>
      <div className="wrap">
        <div className="foot-grid">
          <div className="col">
            <div className="brand">
              <img className="brand-mark" src="/logo.svg" alt="Coglity" />
              <div className="brand-name" style={{ fontFamily: "var(--font-serif)" }}>
                Cog<em>lity</em>
              </div>
            </div>
            <p>
              QA for conversational AI. Author, run, triage, and ship bots you can trust,voice,
              chat, and agent.
            </p>
          </div>
          <div className="col">
            <h5>Product</h5>
            <ul>
              <li><a href="#product">Platform</a></li>
              <li><a href="#workflow">How it works</a></li>
              <li><a href="#pricing">Pricing</a></li>
              <li><a href="/">Changelog</a></li>
            </ul>
          </div>
          <div className="col">
            <h5>Resources</h5>
            <ul>
              <li><a href="#">Docs</a></li>
              <li><a href="#">API reference</a></li>
              <li><a href="#">Playbooks</a></li>
              <li><a href="#">Blog</a></li>
            </ul>
          </div>
          <div className="col">
            <h5>Company</h5>
            <ul>
              <li><a href="#">Security</a></li>
              <li><a href="#">Careers</a></li>
              <li><a href="#">Privacy</a></li>
            </ul>
          </div>
          <div className="col">
            <h5>Get started</h5>
            <ul>
              <li>
                <a href="https://studio.coglity.com" style={{ color: "var(--teal)", fontWeight: 500 }}>
                  Create account &rarr;
                </a>
              </li>
            </ul>
          </div>
        </div>
        <div className="foot-bot">
          <span>&copy; 2026 Coglity Labs, Inc.</span>
          <span>San Francisco · Berlin · Bengaluru</span>
          <div className="sp" />
          <span className="status">
            <span className="status-dot" />
            All systems operational
          </span>
        </div>
      </div>
    </footer>
  );
}

/* ────────────────────────────── Product Mockups ────────────────────────────── */

function MockRunLive() {
  const statuses = [
    { color: "var(--green)" },
    { color: "var(--green)" },
    { color: "var(--red)" },
    { color: "var(--green)" },
    { color: "var(--green)" },
    { color: "var(--teal)" },
    { color: "var(--green)" },
    { color: "var(--muted-2)" },
  ];
  return (
    <div className="mock-app">
      <div className="mock-sidebar">
        <div className="mock-logo" />
        <div className="mock-nav-item" />
        <div className="mock-nav-item" />
        <div className="mock-nav-item active" />
        <div className="mock-nav-item" />
        <div className="mock-nav-item" />
      </div>
      <div className="mock-main">
        <div className="mock-bar teal medium" />
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
          <div style={{ height: 8, flex: 1, background: "var(--bg-2)", borderRadius: 4, overflow: "hidden", display: "flex" }}>
            <div style={{ width: "72%", background: "var(--green)", borderRadius: 4 }} />
            <div style={{ width: "4%", background: "var(--red)" }} />
            <div style={{ width: "4%", background: "var(--teal)", opacity: 0.7 }} />
          </div>
          <span style={{ fontSize: 9, color: "var(--muted)", fontFamily: "var(--font-mono)" }}>87%</span>
        </div>
        <div className="mock-card-row">
          <div className="mock-stat-card">
            <div className="mock-stat-label" />
            <div className="mock-stat-value" />
          </div>
          <div className="mock-stat-card">
            <div className="mock-stat-label" />
            <div className="mock-stat-value" />
          </div>
          <div className="mock-stat-card">
            <div className="mock-stat-label" />
            <div className="mock-stat-value" />
          </div>
        </div>
        <div className="mock-table">
          {statuses.map((s, i) => (
            <div key={i} className="mock-table-row">
              <div className="mock-status-dot" style={{ background: s.color }} />
              <div className="mock-text" style={{ width: `${55 + (i * 7) % 30}%` }} />
              <div className="mock-text-short" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MockAuthor() {
  return (
    <div className="mock-app">
      <div className="mock-sidebar">
        <div className="mock-logo" />
        <div className="mock-nav-item active" />
        <div className="mock-nav-item" />
        <div className="mock-nav-item" />
        <div className="mock-nav-item" />
      </div>
      <div className="mock-main" style={{ display: "grid", gridTemplateColumns: "1fr 140px", gap: 12 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ background: "linear-gradient(180deg, var(--teal-50), var(--surface))", border: "1px solid var(--teal-100)", borderRadius: 8, padding: 10 }}>
            <div style={{ width: "30%", height: 4, borderRadius: 2, background: "var(--teal)", opacity: 0.4, marginBottom: 6 }} />
            <div className="mock-bar medium" />
            <div className="mock-bar short" style={{ marginTop: 4 }} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--teal)", opacity: 0.5 }} />
            <div className="mock-bar" style={{ width: "20%", height: 5 }} />
          </div>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
              <div style={{ width: 18, height: 18, borderRadius: "50%", background: i % 2 === 0 ? "var(--teal)" : "var(--muted-2)", flexShrink: 0, opacity: 0.4 }} />
              <div style={{ flex: 1, background: i % 2 === 0 ? "var(--teal-50)" : "var(--surface)", border: `1px solid ${i % 2 === 0 ? "var(--teal-100)" : "var(--line)"}`, borderRadius: 6, padding: 8 }}>
                <div className="mock-bar" style={{ width: `${60 + i * 8}%`, height: 5 }} />
                <div className="mock-bar short" style={{ marginTop: 4, height: 5 }} />
              </div>
            </div>
          ))}
        </div>
        <div style={{ background: "var(--bg)", borderLeft: "1px solid var(--line)", padding: 10, display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ width: "60%", height: 4, borderRadius: 2, background: "var(--teal)", opacity: 0.3 }} />
          {[1, 2, 3].map((i) => (
            <div key={i} style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 6, padding: 6 }}>
              <div className="mock-bar short" style={{ height: 4 }} />
              <div className="mock-bar" style={{ width: "80%", height: 4, marginTop: 4 }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MockReports() {
  return (
    <div className="mock-app">
      <div className="mock-sidebar">
        <div className="mock-logo" />
        <div className="mock-nav-item" />
        <div className="mock-nav-item" />
        <div className="mock-nav-item" />
        <div className="mock-nav-item active" />
      </div>
      <div className="mock-main">
        <div className="mock-bar teal short" />
        <div className="mock-card-row">
          <div className="mock-stat-card">
            <div className="mock-stat-label" />
            <div className="mock-stat-value" style={{ width: "50%" }} />
          </div>
          <div className="mock-stat-card">
            <div className="mock-stat-label" />
            <div className="mock-stat-value" style={{ width: "35%" }} />
          </div>
          <div className="mock-stat-card">
            <div className="mock-stat-label" />
            <div className="mock-stat-value" style={{ width: "45%" }} />
          </div>
        </div>
        {/* Chart mockup */}
        <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 8, padding: 12, flex: 1 }}>
          <div className="mock-bar short" style={{ height: 4, marginBottom: 12 }} />
          <svg viewBox="0 0 300 80" style={{ width: "100%", height: 80 }}>
            <path d="M0 60 Q30 40 60 50 T120 35 T180 30 T240 20 T300 15" stroke="var(--teal)" strokeWidth="2" fill="none" />
            <path d="M0 65 Q30 55 60 58 T120 48 T180 42 T240 38 T300 35" stroke="var(--muted-2)" strokeWidth="1.5" fill="none" strokeDasharray="4 3" opacity="0.6" />
          </svg>
          <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
            {["var(--teal)", "var(--muted-2)"].map((c, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 8, color: "var(--muted)" }}>
                <div style={{ width: 10, height: 2, background: c, borderRadius: 1 }} />
                <div className="mock-bar" style={{ width: 30, height: 3 }} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
