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
      <TestingCapabilities />
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
          <a href="#testing">Testing</a>
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

/* ── Testing Capabilities Section ── */
const TESTING_TABS = [
  {
    id: "web",
    label: "Web Testing",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
    ),
    headline: "End-to-end web application testing",
    description:
      "Vision-based agents navigate your web app like real users — clicking buttons, filling forms, and verifying UI states across browsers. No selectors to maintain, no flaky locators.",
    bullets: [
      "Cross-browser visual validation",
      "Form flows & multi-page journeys",
      "Responsive layout verification",
      "Automatic regression detection on every deploy",
    ],
  },
  {
    id: "voice",
    label: "Voice Bot Testing",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
    ),
    headline: "Test voice bots with real conversations",
    description:
      "Simulate real phone calls and voice interactions end-to-end. Coglity speaks to your voice bot, listens to responses, and validates conversation flows, intents, and audio quality.",
    bullets: [
      "Speech-to-text & text-to-speech validation",
      "Intent recognition accuracy testing",
      "Multi-turn voice conversation flows",
      "Latency & audio quality metrics",
    ],
  },
  {
    id: "chatbot",
    label: "Conversational Bot Testing",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
    ),
    headline: "Validate chatbot intelligence at scale",
    description:
      "Automatically test conversational AI bots across thousands of scenarios. Verify intent handling, context retention, fallback behavior, and response quality — all without manual effort.",
    bullets: [
      "Multi-turn context & memory testing",
      "Intent coverage & fallback validation",
      "Tone, accuracy & hallucination detection",
      "Regression testing across model updates",
    ],
  },
  {
    id: "agent",
    label: "Agent Testing",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 16.8l-6.2 4.5 2.4-7.4L2 9.4h7.6z"/></svg>
    ),
    headline: "Test autonomous AI agents end-to-end",
    description:
      "Validate that your AI agents make the right decisions, use tools correctly, and complete multi-step tasks. Coglity runs your agents through complex scenarios and evaluates every action.",
    bullets: [
      "Tool-use & function-call validation",
      "Multi-step task completion scoring",
      "Guardrail & safety boundary testing",
      "Cost & latency benchmarking per run",
    ],
  },
] as const;

function TestingCapabilities() {
  const [activeTab, setActiveTab] = useState(0);
  const tab = TESTING_TABS[activeTab];

  return (
    <section className="testing-capabilities" id="testing">
      <div className="section-inner">
        <div className="section-header">
          <h2 className="section-title">One platform, every type of testing</h2>
          <p className="section-subtitle">
            From web UIs to voice bots to autonomous agents — Coglity tests it all with AI-powered precision.
          </p>
        </div>

        <div className="tc-tabs">
          {TESTING_TABS.map((t, i) => (
            <button
              key={t.id}
              className={`tc-tab ${i === activeTab ? "tc-tab-active" : ""}`}
              onClick={() => setActiveTab(i)}
            >
              <span className="tc-tab-icon">{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </div>

        <div className="tc-panel" key={tab.id}>
          <div className="tc-panel-text">
            <h3 className="tc-headline">{tab.headline}</h3>
            <p className="tc-description">{tab.description}</p>
            <ul className="tc-bullets">
              {tab.bullets.map((b, i) => (
                <li key={i} className="tc-bullet">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  {b}
                </li>
              ))}
            </ul>
          </div>
          <div className="tc-panel-visual">
            {tab.id === "web" && <VisualWeb />}
            {tab.id === "voice" && <VisualVoice />}
            {tab.id === "chatbot" && <VisualChatbot />}
            {tab.id === "agent" && <VisualAgent />}
          </div>
        </div>
      </div>
    </section>
  );
}

function VisualWeb() {
  const steps = [
    { action: "Navigate to /signup", status: "pass" },
    { action: "Fill email & password fields", status: "pass" },
    { action: "Click 'Create Account' button", status: "pass" },
    { action: "Verify welcome dashboard loads", status: "pass" },
    { action: "Check responsive layout at 375px", status: "fail" },
  ];
  return (
    <div className="tv-web">
      <div className="tv-browser">
        <div className="tv-browser-bar">
          <div className="tv-dots"><span /><span /><span /></div>
          <div className="tv-url">app.example.com/signup</div>
        </div>
        <div className="tv-browser-body">
          <div className="tv-mock-form">
            <div className="tv-mock-field"><span>Email</span></div>
            <div className="tv-mock-field"><span>Password</span></div>
            <div className="tv-mock-submit">Create Account</div>
          </div>
          <div className="tv-scan-line" />
        </div>
      </div>
      <div className="tv-results">
        {steps.map((s, i) => (
          <div className="tv-result-row anim-slide-in-right" key={i} style={{ animationDelay: `${0.2 + i * 0.15}s` }}>
            <span className={s.status === "pass" ? "agent-result-pass" : "agent-result-fail"}>
              {s.status === "pass" ? "PASS" : "FAIL"}
            </span>
            <span>{s.action}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function VisualVoice() {
  const turns = [
    { role: "agent", text: "Hi, welcome to Acme support. How can I help you today?" },
    { role: "user", text: "I'd like to check the status of my order." },
    { role: "agent", text: "Sure! Can you give me your order number?" },
    { role: "user", text: "It's ORD-7829." },
    { role: "agent", text: "Your order shipped yesterday and arrives Friday." },
  ];
  return (
    <div className="tv-voice">
      <div className="tv-voice-header">
        <div className="tv-voice-wave">
          {[...Array(12)].map((_, i) => (
            <div key={i} className="tv-wave-bar" style={{ animationDelay: `${i * 0.08}s` }} />
          ))}
        </div>
        <span className="tv-voice-status">Call in progress</span>
      </div>
      <div className="tv-voice-transcript">
        {turns.map((t, i) => (
          <div
            className={`tv-voice-turn tv-voice-${t.role} anim-slide-in-right`}
            key={i}
            style={{ animationDelay: `${0.3 + i * 0.25}s` }}
          >
            <span className="tv-voice-role">{t.role === "agent" ? "Bot" : "Coglity"}</span>
            <span className="tv-voice-text">{t.text}</span>
          </div>
        ))}
      </div>
      <div className="tv-voice-metrics anim-fade-in-long">
        <div className="tv-metric">
          <span className="tv-metric-val">98%</span>
          <span className="tv-metric-label">Intent accuracy</span>
        </div>
        <div className="tv-metric">
          <span className="tv-metric-val">1.2s</span>
          <span className="tv-metric-label">Avg latency</span>
        </div>
        <div className="tv-metric">
          <span className="tv-metric-val">5/5</span>
          <span className="tv-metric-label">Turns completed</span>
        </div>
      </div>
    </div>
  );
}

function VisualChatbot() {
  const messages = [
    { from: "bot", text: "Hi! I'm your AI assistant. How can I help?" },
    { from: "tester", text: "What's your return policy?" },
    { from: "bot", text: "You can return items within 30 days of purchase for a full refund." },
    { from: "tester", text: "What if I lost the receipt?" },
    { from: "bot", text: "No worries! We can look up your order by email or phone number." },
  ];
  const checks = [
    { label: "Context retained across turns", pass: true },
    { label: "Accurate policy information", pass: true },
    { label: "Graceful fallback on edge case", pass: true },
    { label: "No hallucinated details", pass: false },
  ];
  return (
    <div className="tv-chatbot">
      <div className="tv-chat-window">
        <div className="tv-chat-header">
          <div className="tv-chat-avatar">AI</div>
          <span>Support Bot</span>
          <span className="tv-chat-online" />
        </div>
        <div className="tv-chat-messages">
          {messages.map((m, i) => (
            <div
              className={`tv-chat-msg tv-chat-${m.from} anim-slide-in-right`}
              key={i}
              style={{ animationDelay: `${0.2 + i * 0.2}s` }}
            >
              {m.text}
            </div>
          ))}
        </div>
      </div>
      <div className="tv-chat-checks">
        {checks.map((c, i) => (
          <div className="tv-chat-check anim-slide-in-right" key={i} style={{ animationDelay: `${0.5 + i * 0.15}s` }}>
            <span className={c.pass ? "agent-result-pass" : "agent-result-fail"}>
              {c.pass ? "PASS" : "FAIL"}
            </span>
            <span>{c.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function VisualAgent() {
  const actions = [
    { step: "1", action: "Parse user request: 'Book a flight to NYC'", status: "done" },
    { step: "2", action: "Call search_flights(dest='JFK', date='Mar 28')", status: "done" },
    { step: "3", action: "Select cheapest option: $342 Delta", status: "done" },
    { step: "4", action: "Call book_flight(id='DL-482')", status: "done" },
    { step: "5", action: "Confirm booking & send itinerary email", status: "active" },
  ];
  const evals = [
    { label: "Correct tool selection", score: "5/5" },
    { label: "Parameter accuracy", score: "4/5" },
    { label: "Task completion", score: "100%" },
    { label: "Guardrail compliance", score: "PASS" },
  ];
  return (
    <div className="tv-agent">
      <div className="tv-agent-trace">
        <div className="tv-agent-trace-header">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>
          Agent Execution Trace
        </div>
        {actions.map((a, i) => (
          <div
            className={`tv-agent-action ${a.status === "active" ? "tv-agent-action-active" : ""} anim-slide-in-right`}
            key={i}
            style={{ animationDelay: `${0.2 + i * 0.18}s` }}
          >
            <div className={`tv-agent-step-num ${a.status === "done" ? "tv-step-done" : "tv-step-active"}`}>
              {a.status === "done" ? (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              ) : (
                a.step
              )}
            </div>
            <span>{a.action}</span>
          </div>
        ))}
      </div>
      <div className="tv-agent-evals">
        <div className="tv-agent-evals-header">Evaluation</div>
        {evals.map((e, i) => (
          <div className="tv-agent-eval anim-slide-in-right" key={i} style={{ animationDelay: `${0.6 + i * 0.15}s` }}>
            <span className="tv-agent-eval-label">{e.label}</span>
            <span className="tv-agent-eval-score">{e.score}</span>
          </div>
        ))}
      </div>
    </div>
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