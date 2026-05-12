import { router } from "./lib/router";
import "./routes/reserve";
import "./routes/balance";
import "./routes/account";
import "./routes/usage";
import { startMeteringConsumer } from "./consumers/meteringConsumer";
import { startReconciliationConsumer } from "./consumers/reconciliationConsumer";

const port = process.env.PORT || 3003;

// Health check — no auth required
router.get("/api/health", async () => Response.json({ status: "ok" }), false);

const server = Bun.serve({
  port,
  fetch: router.handle,
});

console.log(`Billing service listening on port ${server.port}`);

// Start queue consumers
if (process.env.DISABLE_CONSUMERS !== "true") {
  startMeteringConsumer().catch((err) =>
    console.error("[metering] consumer crashed:", err),
  );
  startReconciliationConsumer().catch((err) =>
    console.error("[reconciliation] consumer crashed:", err),
  );
}
