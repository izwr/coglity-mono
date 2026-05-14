import express, { Router } from "express";
import { sessionMiddleware } from "./session";
import { requireAuth } from "./middleware/requireAuth";
import { resolveOrg } from "./middleware/resolveOrg";
import { resolveProject } from "./middleware/resolveProject";
import { requireProjectRole } from "./middleware/requireProjectRole";
import { resolveProjectsScope } from "./middleware/resolveProjectsScope";
import { withScopedTx } from "./middleware/withScopedTx";
import { withInviteAcceptTx } from "./middleware/withInviteAcceptTx";

import authRouter from "./routes/auth";
import usersMeRouter from "./routes/usersMe";
import organizationsRouter from "./routes/organizations";
import organizationMembersRouter from "./routes/organizationMembers";
import invitesRouter from "./routes/invites";
import inviteAcceptRouter from "./routes/inviteAccept";
import projectsRouter from "./routes/projects";
import projectMembersRouter from "./routes/projectMembers";

import testSuitesRouter from "./routes/testSuites";
import testCasesRouter from "./routes/testCases";
import tagsRouter from "./routes/tags";
import bugsRouter from "./routes/bugs";
import scheduledTestSuitesRouter from "./routes/scheduledTestSuites";
import aiRouter from "./routes/ai";
import projectUsersRouter from "./routes/users";
import botConnectionsRouter from "./routes/botConnections";
import knowledgeSourcesRouter from "./routes/knowledgeSources";
import orgContentListsRouter from "./routes/orgContentLists";
import testRunsRouter from "./routes/testRuns";
import testRunsCallbackRouter from "./routes/testRunsCallback";
import testRunDownloadRouter from "./routes/testRunDownload";
import billingRouter from "./routes/billing";

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
// Org-scoped billing (proxy to billing service)
app.use("/api/organizations/:orgId/billing", requireAuth, resolveOrg, billingRouter);
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
