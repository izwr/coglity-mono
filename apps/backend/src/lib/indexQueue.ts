import { ServiceBusClient } from '@azure/service-bus';
import { ManagedIdentityCredential } from '@azure/identity';

export interface IndexQueuePayload {
  knowledgeSourceId: string;
  projectId: string;
  blobName: string;
  blobUrl: string;
  sourceType: string;
  fileName: string;
  url?: string;
  oldBlobName?: string;
}

export async function sendToIndexQueue(payload: IndexQueuePayload): Promise<void> {
  const namespace = process.env.AZURE_SERVICE_BUS_NAMESPACE;
  const queueName = process.env.AZURE_SERVICE_BUS_INDEX_QUEUE_NAME;
  if (!namespace || !queueName) {
    throw new Error('AZURE_SERVICE_BUS_NAMESPACE or AZURE_SERVICE_BUS_INDEX_QUEUE_NAME is not set');
  }
  const client = new ServiceBusClient(namespace, new ManagedIdentityCredential());
  const sender = client.createSender(queueName);
  try {
    await sender.sendMessages({
      body: payload,
      messageId: payload.knowledgeSourceId,
      contentType: 'application/json',
    });
  } finally {
    await sender.close();
    await client.close();
  }
}
