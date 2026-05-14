import { usageEventSchema, type UsageEvent } from "@coglity/shared/schema";
import { getQueueClient, USAGE_EVENTS_QUEUE } from "../lib/queueClient";
import { batchInsertBillingEvents } from "../services/billing";

const BATCH_SIZE = 32;
const VISIBILITY_TIMEOUT_SEC = 60;
const IDLE_POLL_MS = 5_000;
const ERROR_BACKOFF_MS = 10_000;

export async function startMeteringConsumer(): Promise<never> {
  const queue = getQueueClient(USAGE_EVENTS_QUEUE);
  console.log(`[metering] consumer started, polling queue "${USAGE_EVENTS_QUEUE}"`);

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

      console.log(`[metering] received ${messages.length} message(s)`);

      const validEvents: UsageEvent[] = [];
      const poisonMessageIds: { messageId: string; popReceipt: string }[] = [];

      for (const msg of messages) {
        try {
          const raw = JSON.parse(
            Buffer.from(msg.messageText, "base64").toString("utf-8"),
          );
          const parsed = usageEventSchema.safeParse(raw);
          if (!parsed.success) {
            console.warn(
              `[metering] invalid message ${msg.messageId}:`,
              parsed.error.flatten().fieldErrors,
            );
            poisonMessageIds.push({
              messageId: msg.messageId,
              popReceipt: msg.popReceipt,
            });
            continue;
          }
          validEvents.push(parsed.data);
        } catch (err) {
          console.warn(
            `[metering] unparseable message ${msg.messageId}:`,
            err instanceof Error ? err.message : err,
          );
          poisonMessageIds.push({
            messageId: msg.messageId,
            popReceipt: msg.popReceipt,
          });
        }
      }

      // Delete poison messages to unblock the queue
      for (const pm of poisonMessageIds) {
        try {
          await queue.deleteMessage(pm.messageId, pm.popReceipt);
        } catch (err) {
          console.error(
            `[metering] failed to delete poison message ${pm.messageId}:`,
            err instanceof Error ? err.message : err,
          );
        }
      }

      if (validEvents.length > 0) {
        await batchInsertBillingEvents(validEvents);

        // Delete successfully processed messages
        for (const msg of messages) {
          if (poisonMessageIds.some((p) => p.messageId === msg.messageId)) continue;
          try {
            await queue.deleteMessage(msg.messageId, msg.popReceipt);
          } catch (err) {
            console.error(
              `[metering] failed to delete message ${msg.messageId}:`,
              err instanceof Error ? err.message : err,
            );
          }
        }
        console.log(`[metering] processed ${validEvents.length} event(s)`);
      }
    } catch (err) {
      console.error(
        "[metering] consumer error:",
        err instanceof Error ? err.message : err,
      );
      await Bun.sleep(ERROR_BACKOFF_MS);
    }
  }
}
