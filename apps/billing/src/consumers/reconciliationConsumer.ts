import { completionEventSchema } from "@coglity/shared/schema";
import { getQueueClient, COMPLETIONS_QUEUE } from "../lib/queueClient";
import { reconcile } from "../services/billing";

const BATCH_SIZE = 32;
const VISIBILITY_TIMEOUT_SEC = 120;
const IDLE_POLL_MS = 5_000;
const ERROR_BACKOFF_MS = 10_000;

export async function startReconciliationConsumer(): Promise<never> {
  const queue = getQueueClient(COMPLETIONS_QUEUE);
  console.log(`[reconciliation] consumer started, polling queue "${COMPLETIONS_QUEUE}"`);

  while (true) {
    try {
      const response = await queue.receiveMessages({
        numberOfMessages: BATCH_SIZE,
        visibilityTimeout: VISIBILITY_TIMEOUT_SEC,
      });

      const messages = response.receivedMessageItems;
      if (messages.length === 0) {
        await Bun.sleep(IDLE_POLL_MS);
        continue;
      }

      console.log(`[reconciliation] received ${messages.length} message(s)`);

      for (const msg of messages) {
        try {
          const raw = JSON.parse(
            Buffer.from(msg.messageText, "base64").toString("utf-8"),
          );
          const parsed = completionEventSchema.safeParse(raw);
          if (!parsed.success) {
            console.warn(
              `[reconciliation] invalid message ${msg.messageId}:`,
              parsed.error.flatten().fieldErrors,
            );
            // Delete poison message
            await queue.deleteMessage(msg.messageId, msg.popReceipt);
            continue;
          }

          await reconcile(parsed.data.correlation_id);
          await queue.deleteMessage(msg.messageId, msg.popReceipt);
          console.log(
            `[reconciliation] settled correlation_id=${parsed.data.correlation_id}`,
          );
        } catch (err) {
          // Don't delete — message reappears after visibility timeout for retry
          console.error(
            `[reconciliation] failed to process message ${msg.messageId}:`,
            err instanceof Error ? err.message : err,
          );
        }
      }
    } catch (err) {
      console.error(
        "[reconciliation] consumer error:",
        err instanceof Error ? err.message : err,
      );
      await Bun.sleep(ERROR_BACKOFF_MS);
    }
  }
}
