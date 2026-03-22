import express from "express";
import { sessionMiddleware } from "./session.js";
import { requireAuth } from "./middleware/requireAuth.js";
import authRouter from "./routes/auth.js";
import testSuitesRouter from "./routes/testSuites.js";
import testCasesRouter from "./routes/testCases.js";
import tagsRouter from "./routes/tags.js";
import aiRouter from "./routes/ai.js";
import bugsRouter from "./routes/bugs.js";
import usersRouter from "./routes/users.js";
import scheduledTestSuitesRouter from "./routes/scheduledTestSuites.js";

const app = express();
const port = process.env.PORT || 3001;

app.use(express.json());
app.use(sessionMiddleware);

// Public routes
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});
app.use("/api/auth", authRouter);

// Protected routes
app.use("/api/test-suites", requireAuth, testSuitesRouter);
app.use("/api/test-cases", requireAuth, testCasesRouter);
app.use("/api/tags", requireAuth, tagsRouter);
app.use("/api/ai", requireAuth, aiRouter);
app.use("/api/bugs", requireAuth, bugsRouter);
app.use("/api/users", requireAuth, usersRouter);
app.use("/api/scheduled-test-suites", requireAuth, scheduledTestSuitesRouter);

app.listen(port, () => {
  console.log(`Backend running on http://localhost:${port}`);
});
