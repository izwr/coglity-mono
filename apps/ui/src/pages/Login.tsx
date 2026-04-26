import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { CoglityLogo } from "../components/CoglityLogo";

export function Login() {
  const { isAuthenticated, isLoading, login, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const error = searchParams.get("error");
  const returnTo = searchParams.get("returnTo");
  const [mode, setMode] = useState<"signin" | "signup">("signin");

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      // Return the user to where they were before the session died, falling
      // back to the dashboard. Guard against open-redirect by rejecting
      // anything that isn't a same-origin path.
      const safeReturn = returnTo && returnTo.startsWith("/") && !returnTo.startsWith("//")
        ? returnTo
        : "/dashboard";
      navigate(safeReturn, { replace: true });
    }
  }, [isLoading, isAuthenticated, navigate, returnTo]);

  return (
    <div className="auth-split">
      <section className="auth-editorial">
        <div className="sidebar-brand" style={{ padding: 0 }}>
          <CoglityLogo className="sidebar-mark" size={22} />
          <div className="sidebar-wordmark">Cog<em>lity</em></div>
        </div>

        <div>
          <div className="auth-kicker">QA for conversational AI</div>
          <h1 className="auth-headline" style={{ marginTop: 20 }}>
            Ship bots your customers <em>trust</em>.
          </h1>
          <p className="auth-lede" style={{ marginTop: 18 }}>
            Author test cases, run them against your voice and chat systems, and triage
            failures with AI‑assisted root cause. Everything a QA team needs for
            conversational AI in one warm, editorial surface.
          </p>
        </div>

        <div className="auth-proofs">
          <div className="auth-proof">
            <div className="lbl">Last nightly</div>
            <div className="v">97.4<em>%</em></div>
            <svg className="sparkline" style={{ marginTop: 8 }} viewBox="0 0 100 36" preserveAspectRatio="none">
              <path d="M 0 28 L 12 24 L 25 20 L 38 22 L 52 16 L 65 18 L 78 12 L 92 10 L 100 14" fill="none" stroke="var(--teal)" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M 0 28 L 12 24 L 25 20 L 38 22 L 52 16 L 65 18 L 78 12 L 92 10 L 100 14 L 100 36 L 0 36 Z" fill="var(--teal)" opacity="0.1" />
            </svg>
          </div>
          <div className="auth-proof">
            <div className="lbl">30‑day pass rate</div>
            <div className="v">95.1%</div>
            <div className="row" style={{ marginTop: 8 }}>
              <span className="chip pass"><span className="dot" />+1.8%</span>
              <span className="muted" style={{ fontSize: 11.5 }}>vs previous 30d</span>
            </div>
          </div>
        </div>
      </section>

      <section className="auth-panel">
        <div className="auth-card">
          <div className="auth-tabs" role="tablist">
            <button
              role="tab"
              className={`auth-tab${mode === "signin" ? " active" : ""}`}
              onClick={() => setMode("signin")}
            >
              Sign in
            </button>
            <button
              role="tab"
              className={`auth-tab${mode === "signup" ? " active" : ""}`}
              onClick={() => setMode("signup")}
            >
              Create workspace
            </button>
          </div>

          <h2 className="auth-heading">
            {mode === "signin" ? <>Welcome <em className="italic-teal">back</em>.</> : <>Start a <em className="italic-teal">workspace</em>.</>}
          </h2>
          <p className="auth-sub">
            {mode === "signin"
              ? "Sign in with your work identity. We only support SSO."
              : "Invite your QA team we'll generate starter test cases from your bot."}
          </p>

          {error && <div className="auth-error">Authentication failed. Please try again.</div>}

          <div className="col">
            <button className="auth-sso primary" onClick={login}>
              <MicrosoftLogo />
              <span>Continue with Microsoft</span>
              <span className="pill">SSO · Entra ID</span>
            </button>

            <button className="auth-sso" onClick={loginWithGoogle}>
              <GoogleLogo />
              <span>Continue with Google</span>
              <span className="pill">Google Workspace</span>
            </button>
          </div>

          <div className="auth-hint">
            <svg className="ico" style={{ width: 14, height: 14, flex: "none", marginTop: 2, color: "var(--teal)" }} viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 8v5M12 16h.01" />
            </svg>
            <div>
              Workspaces are <strong>domain‑locked</strong>. Coglity matches your email domain to an
              existing workspace when possible, or spins up a new one on first sign‑in.
            </div>
          </div>

          <p className="auth-fine">
            By continuing you agree to our <a href="#">terms</a> and <a href="#">privacy</a> policies.
          </p>
        </div>
      </section>
    </div>
  );
}

function MicrosoftLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 21 21" aria-hidden="true">
      <rect x="1" y="1" width="9" height="9" fill="#f25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
      <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
      <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
    </svg>
  );
}

function GoogleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59a14.5 14.5 0 010-9.18l-7.98-6.19a24.01 24.01 0 000 21.56l7.98-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    </svg>
  );
}
