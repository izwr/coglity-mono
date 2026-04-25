import { type Router as RouterType, Router } from "express";
import { eq, and } from "drizzle-orm";
import { BlobServiceClient } from "@azure/storage-blob";
import { ChainedTokenCredential, AzureCliCredential, ManagedIdentityCredential } from "@azure/identity";
import { testRuns } from "@coglity/shared/schema";
import { db as rootDb } from "../db.js";

const router: RouterType = Router({ mergeParams: true });

type DbHandle = typeof rootDb;

const credential = new ChainedTokenCredential(
  new AzureCliCredential(),
  new ManagedIdentityCredential(),
);

function getBlobService(): BlobServiceClient {
  const account = process.env.AZURE_STORAGE_ACCOUNT ?? "";
  if (!account) throw new Error("AZURE_STORAGE_ACCOUNT not set");
  return new BlobServiceClient(`https://${account}.blob.core.windows.net`, credential);
}

router.get("/:id/download", async (req, res) => {
  const db = (req.db ?? rootDb) as DbHandle;
  const projectId = req.projectId!;
  const [run] = await db
    .select({ recordingBlobName: testRuns.recordingBlobName })
    .from(testRuns)
    .where(and(eq(testRuns.id, req.params.id as string), eq(testRuns.projectId, projectId)));
  if (!run || !run.recordingBlobName) {
    res.status(404).json({ error: "Recording not found" });
    return;
  }

  const containerName = process.env.AZURE_STORAGE_RECORDINGS_CONTAINER ?? "test-run-recordings";

  try {
    const svc = getBlobService();
    const blob = svc.getContainerClient(containerName).getBlockBlobClient(run.recordingBlobName);
    const download = await blob.download(0);

    res.setHeader("Content-Type", "audio/wav");
    res.setHeader("Content-Disposition", `attachment; filename="run-${req.params.id}.wav"`);
    if (download.contentLength) {
      res.setHeader("Content-Length", download.contentLength);
    }
    download.readableStreamBody!.pipe(res);
  } catch (err) {
    console.error("[download] blob fetch failed:", err);
    res.status(500).json({ error: "Failed to fetch recording" });
  }
});

router.get("/:id/transcript", async (req, res) => {
  const db = (req.db ?? rootDb) as DbHandle;
  const projectId = req.projectId!;
  const [run] = await db
    .select({ transcript: testRuns.transcript })
    .from(testRuns)
    .where(and(eq(testRuns.id, req.params.id as string), eq(testRuns.projectId, projectId)));
  if (!run) {
    res.status(404).json({ error: "Run not found" });
    return;
  }

  const text = (run.transcript as { role: string; text: string }[])
    .map((t) => `[${t.role}] ${t.text}`)
    .join("\n\n");

  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="transcript-${req.params.id}.txt"`);
  res.send(text);
});

export default router;
