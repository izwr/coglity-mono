import express, { Router } from "express";
import { sessionMiddleware } from "./session.js";
import { requireAuth } from "./middleware/requireAuth.js";
import { resolveOrg } from "./middleware/resolveOrg.js";
import { resolveProject } from "./middleware/resolveProject.js";
import { requireProjectRole } from "./middleware/requireProjectRole.js";
import { resolveProjectsScope } from "./middleware/resolveProjectsScope.js";
import { withScopedTx } from "./middleware/withScopedTx.js";
import { withInviteAcceptTx } from "./middleware/withInviteAcceptTx.js";

import authRouter from "./routes/auth.js";
import usersMeRouter from "./routes/usersMe.js";
import organizationsRouter from "./routes/organizations.js";
import organizationMembersRouter from "./routes/organizationMembers.js";
import invitesRouter from "./routes/invites.js";
import inviteAcceptRouter from "./routes/inviteAccept.js";
import projectsRouter from "./routes/projects.js";
import projectMembersRouter from "./routes/projectMembers.js";

import testSuitesRouter from "./routes/testSuites.js";
import testCasesRouter from "./routes/testCases.js";
import tagsRouter from "./routes/tags.js";
import bugsRouter from "./routes/bugs.js";
import scheduledTestSuitesRouter from "./routes/scheduledTestSuites.js";
import aiRouter from "./routes/ai.js";
import projectUsersRouter from "./routes/users.js";
import botConnectionsRouter from "./routes/botConnections.js";
import knowledgeSourcesRouter from "./routes/knowledgeSources.js";
import orgContentListsRouter from "./routes/orgContentLists.js";
import testRunsRouter from "./routes/testRuns.js";
import testRunsCallbackRouter from "./routes/testRunsCallback.js";
import testRunDownloadRouter from "./routes/testRunDownload.js";

const app = express();
const port = process.env.PORT || 3001;

// Trust the first proxy (nginx → Container Apps ingress) so express-session
// recognises HTTPS via X-Forwarded-Proto and issues secure cookies.
app.set("trust proxy", 1);

app.use(express.json());
app.use(sessionMiddleware);

// ── Public / top-level ─────────────────────────────────────────
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});
app.get("/api/debug-session", (req, res) => {
  (req.session as any).test = Date.now();
  req.session.save((err) => {
    res.json({
      error: err?.message || null,
      sessionID: req.sessionID,
      cookie: req.session.cookie,
      headers: { host: req.headers.host, xForwardedProto: req.headers["x-forwarded-proto"], xForwardedHost: req.headers["x-forwarded-host"] },
    });
  });
});
app.use("/api/auth", authRouter);

// ── Internal webhooks (no session, shared-secret auth inside) ─
app.use("/api/internal/test-runs", testRunsCallbackRouter);

// ── Authenticated, non-scoped ─────────────────────────────────
app.use("/api/users/me", usersMeRouter);
app.use("/api/invites/accept", withInviteAcceptTx, inviteAcceptRouter);
app.use("/api/organizations", organizationsRouter);

// ── Org-scoped (no project yet) ───────────────────────────────
// organizationMembers and invites run with org context set via resolveOrg in
// their own router; they open the scoped tx after role resolution.
const orgScoped = Router({ mergeParams: true });
orgScoped.use(withScopedTx);
orgScoped.use("/members", organizationMembersRouter);
orgScoped.use("/invites", invitesRouter);

// Projects listing/create happens at /api/organizations/:orgId/projects.
// Individual project content sits at /api/organizations/:orgId/projects/:projectId/...
const projectContent = Router({ mergeParams: true });
projectContent.use(requireAuth, resolveOrg, resolveProject);
projectContent.use((req, res, next) =>
  req.method === "GET" ? requireProjectRole("read")(req, res, next) : requireProjectRole("writer")(req, res, next),
);
projectContent.use(withScopedTx);
projectContent.use("/test-suites", testSuitesRouter);
projectContent.use("/test-cases", testCasesRouter);
projectContent.use("/tags", tagsRouter);
projectContent.use("/bugs", bugsRouter);
projectContent.use("/scheduled-test-suites", scheduledTestSuitesRouter);
projectContent.use("/ai", aiRouter);
projectContent.use("/users", projectUsersRouter);
projectContent.use("/members", projectMembersRouter);
projectContent.use("/bot-connections", botConnectionsRouter);
projectContent.use("/knowledge-sources", knowledgeSourcesRouter);
projectContent.use("/test-runs", testRunsRouter);
projectContent.use("/test-runs", testRunDownloadRouter);

app.use("/api/organizations/:orgId/projects/:projectId", projectContent);
app.use("/api/organizations/:orgId/projects", projectsRouter);
// Multi-project list endpoints used by the project-filter UI on content pages.
app.use(
  "/api/organizations/:orgId",
  requireAuth,
  resolveOrg,
  resolveProjectsScope,
  orgContentListsRouter,
);
app.use("/api/organizations/:orgId", requireAuth, resolveOrg, orgScoped);

app.listen(port, () => {
  console.log(`Backend listening on port ${port}`);
});
