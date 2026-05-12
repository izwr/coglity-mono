import { QueueServiceClient } from "@azure/storage-queue";
import { azureCredential } from "./azureCredential.js";

const account = process.env.AZURE_STORAGE_ACCOUNT ?? "";
const usageQueueName = process.env.AZURE_QUEUE_USAGE_EVENTS ?? "usage-events";
const completionsQueueName = process.env.AZURE_QUEUE_COMPLETIONS ?? "run-completions";

let serviceClient: QueueServiceClient | null = null;

function getServiceClient(): QueueServiceClient {
  if (!account) {
    throw new Error("AZURE_STORAGE_ACCOUNT is not set");
  }
  if (!serviceClient) {
    serviceClient = new QueueServiceClient(
      `https://${account}.queue.core.windows.net`,
      azureCredential,
    );
  }
  return serviceClient;
}

export type UsageEventPayload = {
  event_id: string;
  correlation_id: string;
  project_id: string;
  organisation_id: string;
  sku: string;
  consumption_qty: number;
  timestamp: string;
};

export async function emitUsageEvent(event: UsageEventPayload): Promise<void> {
  if (!account) return;
  try {
    const queue = getServiceClient().getQueueClient(usageQueueName);
    const encoded = Buffer.from(JSON.stringify(event)).toString("base64");
    await queue.sendMessage(encoded);
  } catch (err) {
    console.error(
      `[billing] failed to emit usage event ${event.event_id}:`,
      err instanceof Error ? err.message : err,
    );
  }
}

export async function emitCompletionEvent(
  correlationId: string,
): Promise<void> {
  if (!account) return;
  try {
    const queue = getServiceClient().getQueueClient(completionsQueueName);
    const payload = { event_type: "run_completed", correlation_id: correlationId };
    const encoded = Buffer.from(JSON.stringify(payload)).toString("base64");
    await queue.sendMessage(encoded, { visibilityTimeout: 120 });
  } catch (err) {
    console.error(
      `[billing] failed to emit completion event for ${correlationId}:`,
      err instanceof Error ? err.message : err,
    );
  }
}
