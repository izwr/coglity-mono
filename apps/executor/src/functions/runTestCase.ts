import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from "@azure/functions";
import { runVoiceTest, type RunPayload } from "../lib/voiceTester.js";

app.http("runTestCase", {
  methods: ["POST"],
  route: "run-test-case",
  authLevel: "function",
  handler: async (req: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> => {
    const expected = process.env.EXECUTOR_WEBHOOK_SECRET ?? "";
    const actual = req.headers.get("x-webhook-secret") ?? "";
    if (!expected || actual !== expected) {
      return { status: 401, jsonBody: { error: "unauthorized" } };
    }

    let payload: RunPayload;
    try {
      payload = (await req.json()) as RunPayload;
    } catch {
      return { status: 400, jsonBody: { error: "invalid json body" } };
    }
    if (!payload?.runId || !payload?.testCase || !payload?.botConnection) {
      return { status: 400, jsonBody: { error: "missing runId/testCase/botConnection" } };
    }

    // Fire-and-forget. The function host may shut down before this finishes when
    // running under 'Consumption' SKU — deploy on 'Flex Consumption' or 'Premium'
    // so long-running background work on a single invocation completes.
    runVoiceTest(payload).catch((err) => {
      ctx.error(`[runTestCase ${payload.runId}] unhandled`, err);
    });

    return { status: 202, jsonBody: { runId: payload.runId } };
  },
});
