import express from "express";
import { sessionMiddleware } from "./session.js";
import { requireAuth } from "./middleware/requireAuth.js";
import authRouter from "./routes/auth.js";
import testSuitesRouter from "./routes/testSuites.js";
import testCasesRouter from "./routes/testCases.js";
import tagsRouter from "./routes/tags.js";

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

app.listen(port, () => {
  console.log(`Backend running on http://localhost:${port}`);
});
