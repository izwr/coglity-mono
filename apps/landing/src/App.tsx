import { useState, useEffect, useCallback } from "react";

export function App() {
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof window !== "undefined") {
      return window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    }
    return "light";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const toggleTheme = () =>
    setTheme((t) => (t === "light" ? "dark" : "light"));

  return (
    <>
      <Nav theme={theme} onToggleTheme={toggleTheme} />
      <Hero />
      <Features />
      <HowItWorks />
      <CTA />
      <Footer />
    </>
  );
}

function Nav({
  theme,
  onToggleTheme,
}: {
  theme: string;
  onToggleTheme: () => void;
}) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav className={`nav ${scrolled ? "nav-scrolled" : ""}`}>
      <div className="nav-inner">
        <span className="nav-logo">Coglity</span>
        <div className="nav-links">
          <a href="#features">Features</a>
          <a href="#how-it-works">How it works</a>
        </div>
        <div className="nav-actions">
          <button
            className="theme-btn"
            onClick={onToggleTheme}
            aria-label="Toggle theme"
          >
            {theme === "light" ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
            )}
          </button>
          <a href="/app" className="btn-nav-primary">
            Get started
          </a>
        </div>
      </div>
    </nav>
  );
}

const PIPELINE_STEPS = [
  { id: "feature", label: "Feature", icon: "lightbulb" },
  { id: "vibe-code", label: "Vibe Coding", icon: "code" },
  { id: "deploy", label: "Deployment", icon: "rocket" },
  { id: "test-gen", label: "Test Generation", icon: "sparkles" },
  { id: "agent-test", label: "Agent Testing", icon: "agent" },
] as const;

type StepId = (typeof PIPELINE_STEPS)[number]["id"];

function Hero() {
  const [activeStep, setActiveStep] = useState<number>(0);
  const [typing, setTyping] = useState(0);

  const advance = useCallback(() => {
    setActiveStep((s) => (s + 1) % PIPELINE_STEPS.length);
    setTyping(0);
  }, []);

  // auto-advance every 5s
  useEffect(() => {
    const id = setInterval(advance, 5000);
    return () => clearInterval(id);
  }, [advance]);

  // typing effect for code step
  useEffect(() => {
    if (PIPELINE_STEPS[activeStep].id !== "vibe-code") return;
    const id = setInterval(() => setTyping((t) => t + 1), 60);
    return () => clearInterval(id);
  }, [activeStep]);

  const currentId = PIPELINE_STEPS[activeStep].id;

  return (
    <section className="hero">
      <div className="hero-inner">
        <div className="hero-badge">Autonomous QA for the AI era</div>
        <h1 className="hero-title">
          You vibe code it,
          <br />
          <span className="hero-gradient">we vibe test it.</span>
        </h1>
        <p className="hero-subtitle">
          Your team ships features with AI coding assistants. Coglity
          deploys vision-based AI agents that see your application like a
          real user, generate test cases from every deployment, and
          execute them autonomously — no scripts, no selectors, no maintenance.
        </p>
        <div className="hero-actions">
          <a href="/app" className="btn-hero-primary">
            Start for free
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
          </a>
          <a href="#features" className="btn-hero-secondary">
            See how it works
          </a>
        </div>

        <div className="hero-visual">
          {/* Pipeline progress bar */}
          <div className="pipeline-track">
            {PIPELINE_STEPS.map((step, i) => (
              <div key={step.id} className="pipeline-step-wrapper">
                <div className="pipeline-node-wrapper">
                  <button
                    className={`pipeline-node ${i < activeStep ? "done" : ""} ${i === activeStep ? "active" : ""}`}
                    onClick={() => { setActiveStep(i); setTyping(0); }}
                  >
                    <StepIcon type={step.icon} done={i < activeStep} active={i === activeStep} />
                  </button>
                  <span className={`pipeline-label ${i === activeStep ? "active" : ""}`}>
                    {step.label}
                  </span>
                </div>
                {i < PIPELINE_STEPS.length - 1 && (
                  <div className={`pipeline-connector ${i < activeStep ? "done" : ""}`}>
                    <div
                      className="pipeline-connector-fill"
                      style={{
                        transform: i < activeStep ? "scaleX(1)" : i === activeStep ? "scaleX(0.5)" : "scaleX(0)",
                      }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Animated stage */}
          <div className="pipeline-stage">
            <div className="stage-window">
              <div className="stage-window-bar">
                <span /><span /><span />
                <div className="stage-window-title">{stageTitle(currentId)}</div>
              </div>
              <div className="stage-content" key={currentId}>
                {currentId === "feature" && <StageFeature />}
                {currentId === "vibe-code" && <StageVibeCoding chars={typing} />}
                {currentId === "deploy" && <StageDeploy />}
                {currentId === "test-gen" && <StageTestGen />}
                {currentId === "agent-test" && <StageAgentTest />}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function stageTitle(id: StepId) {
  switch (id) {
    case "feature": return "Product Backlog";
    case "vibe-code": return "Terminal - Claude Code";
    case "deploy": return "Deployment Pipeline";
    case "test-gen": return "Coglity - Test Generation";
    case "agent-test": return "Coglity - Vision Agent Execution";
  }
}

function StepIcon({ type, done, active }: { type: string; done: boolean; active: boolean }) {
  if (done) return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
  );
  switch (type) {
    case "lightbulb": return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z"/></svg>;
    case "code": return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>;
    case "rocket": return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/></svg>;
    case "sparkles": return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.912 5.813a2 2 0 0 0 1.275 1.275L21 12l-5.813 1.912a2 2 0 0 0-1.275 1.275L12 21l-1.912-5.813a2 2 0 0 0-1.275-1.275L3 12l5.813-1.912a2 2 0 0 0 1.275-1.275L12 3z"/></svg>;
    case "agent": return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 9h6v6H9z" opacity={active ? 1 : 0.5}/><circle cx="7.5" cy="7.5" r="1" fill="currentColor"/><circle cx="16.5" cy="7.5" r="1" fill="currentColor"/></svg>;
    default: return null;
  }
}

/* ── Stage: Feature ── */
function StageFeature() {
  return (
    <div className="stage-feature">
      <div className="feature-ticket anim-slide-up">
        <div className="ticket-status">NEW FEATURE</div>
        <div className="ticket-title">Add user profile settings page</div>
        <div className="ticket-desc">Allow users to update their display name, avatar, and notification preferences from a new settings panel.</div>
        <div className="ticket-meta">
          <span className="ticket-priority">Priority: High</span>
          <span className="ticket-tag">frontend</span>
          <span className="ticket-tag">settings</span>
        </div>
      </div>
      <div className="feature-arrow anim-fade-in-delay">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>
        <span>Hand off to AI coding assistant</span>
      </div>
    </div>
  );
}

/* ── Stage: Vibe Coding ── */
const CODE_LINES = [
  { prompt: true, text: "claude \"add user profile settings page\"" },
  { prompt: false, text: "" },
  { prompt: false, text: "  Creating src/pages/Settings.tsx..." },
  { prompt: false, text: "  Creating src/components/AvatarUpload.tsx..." },
  { prompt: false, text: "  Updating src/routes.ts..." },
  { prompt: false, text: "  Adding notification preferences API..." },
  { prompt: false, text: "" },
  { prompt: false, text: "  \u2713 5 files created, 2 files modified" },
  { prompt: false, text: "  \u2713 All types check. Ready to deploy." },
];

function StageVibeCoding({ chars }: { chars: number }) {
  let remaining = chars;
  return (
    <div className="stage-terminal">
      <div className="terminal-lines">
        {CODE_LINES.map((line, i) => {
          if (remaining <= 0) return null;
          const visible = line.text.slice(0, remaining);
          remaining -= line.text.length || 1;
          const isComplete = remaining >= 0;
          return (
            <div key={i} className={`terminal-line ${line.prompt ? "terminal-prompt" : ""}`}>
              {line.prompt && <span className="terminal-ps1">$ </span>}
              <span>{visible}</span>
              {!isComplete && <span className="terminal-cursor" />}
            </div>
          );
        })}
      </div>
      <div className="terminal-badge">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
        Claude Code
      </div>
    </div>
  );
}

/* ── Stage: Deploy ── */
function StageDeploy() {
  return (
    <div className="stage-deploy">
      <div className="deploy-steps">
        <DeployStep label="Building application" delay={0} />
        <DeployStep label="Running lint checks" delay={1} />
        <DeployStep label="Pushing to production" delay={2} />
        <DeployStep label="Deployment live" delay={3} done />
      </div>
      <div className="deploy-url anim-fade-in-long">
        <span className="deploy-live-dot" />
        https://app.example.com
        <span className="deploy-status">200 OK</span>
      </div>
    </div>
  );
}

function DeployStep({ label, delay, done }: { label: string; delay: number; done?: boolean }) {
  return (
    <div className="deploy-step" style={{ animationDelay: `${delay * 0.6}s` }}>
      <div className={`deploy-check ${done ? "deploy-check-final" : ""}`}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
      </div>
      <span>{label}</span>
    </div>
  );
}

/* ── Stage: Test Generation ── */
function StageTestGen() {
  const tests = [
    "should render profile settings page",
    "should update display name",
    "should upload avatar image",
    "should toggle notification preferences",
    "should show validation errors for empty name",
    "should persist changes on save",
  ];
  return (
    <div className="stage-testgen">
      <div className="testgen-header anim-slide-up">
        <div className="testgen-ai-icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.912 5.813a2 2 0 0 0 1.275 1.275L21 12l-5.813 1.912a2 2 0 0 0-1.275 1.275L12 21l-1.912-5.813a2 2 0 0 0-1.275-1.275L3 12l5.813-1.912a2 2 0 0 0 1.275-1.275L12 3z"/></svg>
        </div>
        <span>Analyzing deployment diff & generating tests...</span>
      </div>
      <div className="testgen-list">
        {tests.map((t, i) => (
          <div
            className="testgen-item anim-slide-in-right"
            key={i}
            style={{ animationDelay: `${0.3 + i * 0.25}s` }}
          >
            <span className="testgen-bullet" />
            <code>{t}</code>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Stage: Agent Testing (Vision-based) ── */
function StageAgentTest() {
  const results = [
    { name: "navigate to settings page", pass: true },
    { name: "locate and fill display name field", pass: true },
    { name: "click avatar upload, verify preview", pass: false },
    { name: "toggle notifications switch on", pass: true },
    { name: "clear name, verify error visible", pass: true },
    { name: "click Save, verify success toast", pass: false },
  ];
  return (
    <div className="stage-agent">
      <div className="agent-browser anim-slide-up">
        <div className="agent-browser-bar">
          <div className="agent-browser-dots"><span /><span /><span /></div>
          <div className="agent-url-bar">app.example.com/settings</div>
          <div className="agent-vision-badge">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            Vision Agent
          </div>
        </div>
        <div className="agent-browser-body">
          <div className="agent-cursor" />
          {/* Vision overlay scanning effect */}
          <div className="agent-vision-overlay" />
          <div className="agent-page-mock">
            <div className="agent-mock-input"><span>Display Name</span></div>
            <div className="agent-mock-input"><span>Email</span></div>
            <div className="agent-mock-toggle"><span>Notifications</span><div className="agent-toggle-track"><div className="agent-toggle-knob" /></div></div>
            <div className="agent-mock-btn">Save Changes</div>
          </div>
          {/* Vision annotation boxes */}
          <div className="vision-box vision-box-1" />
          <div className="vision-box vision-box-2" />
          <div className="vision-box vision-box-3" />
        </div>
      </div>
      <div className="agent-results">
        <div className="agent-results-header anim-slide-up">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          Agent sees UI, acts like a real user
        </div>
        {results.map((r, i) => (
          <div
            className="agent-result anim-slide-in-right"
            key={i}
            style={{ animationDelay: `${0.4 + i * 0.3}s` }}
          >
            <span className={r.pass ? "agent-result-pass" : "agent-result-fail"}>{r.pass ? "PASS" : "FAIL"}</span>
            <span>{r.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Features() {
  const features = [
    {
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
      ),
      title: "Vision-Based Agent Execution",
      description:
        "AI agents see your application through screenshots — clicking, typing, and navigating exactly like a real user. No brittle selectors, no DOM coupling, no test maintenance.",
    },
    {
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.912 5.813a2 2 0 0 0 1.275 1.275L21 12l-5.813 1.912a2 2 0 0 0-1.275 1.275L12 21l-1.912-5.813a2 2 0 0 0-1.275-1.275L3 12l5.813-1.912a2 2 0 0 0 1.275-1.275L12 3z"/></svg>
      ),
      title: "Intelligent Test Generation",
      description:
        "Coglity analyzes every deployment diff and automatically generates targeted test cases. Your QA coverage scales with your shipping velocity.",
    },
    {
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
      ),
      title: "Built for Vibe Coding Workflows",
      description:
        "Works seamlessly with Claude Code, GitHub Copilot, Cursor, and Codex. Your team ships features with AI — Coglity ensures they actually work.",
    },
    {
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/></svg>
      ),
      title: "Deploy-Triggered Testing",
      description:
        "Every deployment automatically triggers test generation and agent execution. Catch regressions before your customers do — without anyone writing a single test.",
    },
    {
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/></svg>
      ),
      title: "Quality Visibility for Teams",
      description:
        "Dashboards and reports give engineering leads and product managers real-time visibility into test coverage, pass rates, and deployment confidence.",
    },
    {
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
      ),
      title: "Zero Test Maintenance",
      description:
        "Traditional end-to-end tests break when the UI changes. Vision-based agents adapt automatically — your tests evolve with your product, not against it.",
    },
  ];

  return (
    <section className="features" id="features">
      <div className="section-inner">
        <div className="section-header">
          <h2 className="section-title">QA that keeps up with how you build</h2>
          <p className="section-subtitle">
            AI-generated code ships fast. Coglity makes sure it ships reliably
            with autonomous, vision-based test agents.
          </p>
        </div>
        <div className="features-grid">
          {features.map((f) => (
            <div className="feature-card" key={f.title}>
              <div className="feature-icon">{f.icon}</div>
              <h3 className="feature-title">{f.title}</h3>
              <p className="feature-desc">{f.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    {
      number: "01",
      title: "Your team ships a feature",
      description:
        "A developer uses Claude Code, Copilot, or any AI assistant to build a feature and deploys it. Business as usual.",
    },
    {
      number: "02",
      title: "Coglity generates test cases",
      description:
        "Our platform detects the deployment, analyzes the changes, and generates comprehensive test cases targeting the new and affected functionality.",
    },
    {
      number: "03",
      title: "Vision agents verify it works",
      description:
        "AI agents open your application, see the UI through screenshots, and interact with it like a real user — clicking, typing, and validating every flow.",
    },
    {
      number: "04",
      title: "Your team gets results",
      description:
        "Pass/fail results, screenshots of each step, and detailed logs are delivered within minutes. Regressions are caught before they reach customers.",
    },
  ];

  return (
    <section className="how-it-works" id="how-it-works">
      <div className="section-inner">
        <div className="section-header">
          <h2 className="section-title">From deployment to confidence in minutes</h2>
          <p className="section-subtitle">
            No test scripts to write. No infrastructure to manage. Just ship and know it works.
          </p>
        </div>
        <div className="steps-grid">
          {steps.map((s) => (
            <div className="step-card" key={s.number}>
              <div className="step-number">{s.number}</div>
              <h3 className="step-title">{s.title}</h3>
              <p className="step-desc">{s.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CTA() {
  return (
    <section className="cta">
      <div className="section-inner">
        <div className="cta-card">
          <h2 className="cta-title">Stop writing tests. Start shipping with confidence.</h2>
          <p className="cta-subtitle">
            Let vision-based AI agents handle your QA so your team can focus
            on building. Set up in minutes, catch regressions from day one.
          </p>
          <a href="/app" className="btn-hero-primary">
            Get started free
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
          </a>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="footer">
      <div className="section-inner">
        <div className="footer-inner">
          <span className="footer-logo">Coglity</span>
          <span className="footer-copy">
            &copy; {new Date().getFullYear()} Coglity. All rights reserved.
          </span>
        </div>
      </div>
    </footer>
  );
}