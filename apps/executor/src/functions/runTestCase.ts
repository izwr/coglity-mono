import { app, type InvocationContext } from "@azure/functions";
import { runVoiceTest, type RunPayload } from "../lib/voiceTester.js";

app.serviceBusQueue("runTestCase", {
  queueName: "test-run-jobs",
  connection: "ServiceBusConnection",
  handler: async (message: unknown, ctx: InvocationContext): Promise<void> => {
    const payload = message as RunPayload;
    if (!payload?.runId || !payload?.testCase || !payload?.botConnection) {
      ctx.error("[runTestCase] invalid message: missing runId/testCase/botConnection");
      return;
    }

    ctx.log(`[runTestCase] processing run ${payload.runId}`);
    await runVoiceTest(payload);
  },
});
