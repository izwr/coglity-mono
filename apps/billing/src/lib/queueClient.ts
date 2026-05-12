import { QueueClient, QueueServiceClient } from "@azure/storage-queue";
import {
  ChainedTokenCredential,
  AzureCliCredential,
  ManagedIdentityCredential,
} from "@azure/identity";

const account = process.env.AZURE_STORAGE_ACCOUNT ?? "";
const credential = new ChainedTokenCredential(
  new AzureCliCredential(),
  new ManagedIdentityCredential(),
);

let serviceClient: QueueServiceClient | null = null;

function getServiceClient(): QueueServiceClient {
  if (!account) {
    throw new Error("AZURE_STORAGE_ACCOUNT is not set");
  }
  if (!serviceClient) {
    serviceClient = new QueueServiceClient(
      `https://${account}.queue.core.windows.net`,
      credential,
    );
  }
  return serviceClient;
}

export function getQueueClient(queueName: string): QueueClient {
  return getServiceClient().getQueueClient(queueName);
}

export const USAGE_EVENTS_QUEUE =
  process.env.AZURE_QUEUE_USAGE_EVENTS ?? "usage-events";
export const COMPLETIONS_QUEUE =
  process.env.AZURE_QUEUE_COMPLETIONS ?? "run-completions";
