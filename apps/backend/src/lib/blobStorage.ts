import { BlobServiceClient } from '@azure/storage-blob';
import {
  ChainedTokenCredential,
  AzureCliCredential,
  ManagedIdentityCredential,
} from '@azure/identity';
import crypto from 'crypto';

const account = process.env.AZURE_STORAGE_ACCOUNT ?? '';
const containerName = process.env.AZURE_STORAGE_CONTAINER ?? 'knowledge-sources';
const credential = new ChainedTokenCredential(
  new AzureCliCredential(),
  new ManagedIdentityCredential(),
);

function getContainerClient() {
  if (!account) {
    throw new Error('AZURE_STORAGE_ACCOUNT is not set');
  }
  const blobServiceClient = new BlobServiceClient(
    `https://${account}.blob.core.windows.net`,
    credential,
  );
  return blobServiceClient.getContainerClient(containerName);
}

export async function uploadBlob(
  file: Express.Multer.File,
  metadata?: Record<string, string>,
): Promise<{ url: string; blobName: string }> {
  const container = getContainerClient();
  // Private container (no `access` option = no anonymous access). Knowledge-source files
  // hold customer documents and must never be world-readable by URL; they are read back
  // server-side via the storage credential, mirroring the test-run recordings container.
  // NOTE: createIfNotExists does not downgrade an already-public container — an existing
  // 'knowledge-sources' container must have its public access level set to Private in Azure.
  await container.createIfNotExists();

  const ext = file.originalname.split('.').pop() ?? '';
  const blobName = `${crypto.randomUUID()}${ext ? `.${ext}` : ''}`;
  const blockBlob = container.getBlockBlobClient(blobName);

  await blockBlob.uploadData(file.buffer, {
    blobHTTPHeaders: { blobContentType: file.mimetype },
    metadata,
  });

  return { url: blockBlob.url, blobName };
}

export async function deleteBlob(blobUrl: string): Promise<void> {
  if (!blobUrl || !account) return;
  try {
    const container = getContainerClient();
    const url = new URL(blobUrl);
    const blobName = url.pathname.split('/').pop();
    if (blobName) {
      await container.getBlockBlobClient(blobName).deleteIfExists();
    }
  } catch {
    // Best-effort deletion
  }
}
