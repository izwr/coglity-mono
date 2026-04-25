import { BlobServiceClient } from "@azure/storage-blob";
import { ChainedTokenCredential, AzureCliCredential, ManagedIdentityCredential } from "@azure/identity";
import crypto from "crypto";

const account = process.env.AZURE_STORAGE_ACCOUNT ?? "";
const containerName = process.env.AZURE_STORAGE_CONTAINER ?? "knowledge-sources";
const credential = new ChainedTokenCredential(
  new AzureCliCredential(),
  new ManagedIdentityCredential(),
);

function getContainerClient() {
  if (!account) {
    throw new Error("AZURE_STORAGE_ACCOUNT is not set");
  }
  const blobServiceClient = new BlobServiceClient(
    `https://${account}.blob.core.windows.net`,
    credential,
  );
  return blobServiceClient.getContainerClient(containerName);
}

export async function uploadBlob(
  file: Express.Multer.File,
): Promise<{ url: string; blobName: string }> {
  const container = getContainerClient();
  await container.createIfNotExists({ access: "blob" });

  const ext = file.originalname.split(".").pop() ?? "";
  const blobName = `${crypto.randomUUID()}${ext ? `.${ext}` : ""}`;
  const blockBlob = container.getBlockBlobClient(blobName);

  await blockBlob.uploadData(file.buffer, {
    blobHTTPHeaders: { blobContentType: file.mimetype },
  });

  return { url: blockBlob.url, blobName };
}

export async function deleteBlob(blobUrl: string): Promise<void> {
  if (!blobUrl || !account) return;
  try {
    const container = getContainerClient();
    const url = new URL(blobUrl);
    const blobName = url.pathname.split("/").pop();
    if (blobName) {
      await container.getBlockBlobClient(blobName).deleteIfExists();
    }
  } catch {
    // Best-effort deletion
  }
}
