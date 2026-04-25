import {
  BlobSASPermissions,
  BlobServiceClient,
  generateBlobSASQueryParameters,
} from "@azure/storage-blob";
import { azureCredential } from "./azureCredential.js";

type Encoding = "pcm16" | "mulaw" | "alaw";

const credential = azureCredential;

export class Recorder {
  private testerChunks: Buffer[] = [];
  private sutChunks: Buffer[] = [];
  private readonly sampleRate: number;
  private readonly encoding: Encoding;
  private readonly startMs: number;

  constructor(opts: { sampleRate: number; encoding: Encoding }) {
    this.sampleRate = opts.sampleRate || 16000;
    this.encoding = opts.encoding || "pcm16";
    this.startMs = Date.now();
  }

  appendTester(base64: string): void {
    if (!base64) return;
    this.testerChunks.push(Buffer.from(base64, "base64"));
  }

  appendSut(base64: string): void {
    if (!base64) return;
    this.sutChunks.push(Buffer.from(base64, "base64"));
  }

  async finalize(runId: string): Promise<{
    url: string;
    blobName: string;
    durationMs: number;
  } | null> {
    const account = process.env.AZURE_STORAGE_ACCOUNT ?? "";
    if (!account) {
      console.warn("[recording] AZURE_STORAGE_ACCOUNT not set; skipping upload");
      return null;
    }
    const containerName = process.env.AZURE_STORAGE_RECORDINGS_CONTAINER ?? "test-run-recordings";

    const testerPcm = this.decodeAll(this.testerChunks);
    const sutPcm = this.decodeAll(this.sutChunks);

    const stereo = interleaveStereo(testerPcm, sutPcm);
    const wav = wrapWavHeader(stereo, this.sampleRate, 2);

    const svc = new BlobServiceClient(`https://${account}.blob.core.windows.net`, credential);
    const container = svc.getContainerClient(containerName);
    await container.createIfNotExists(); // no public access — we'll hand out SAS URLs
    const blobName = `runs/${runId}.wav`;
    const blob = container.getBlockBlobClient(blobName);
    await blob.uploadData(wav, { blobHTTPHeaders: { blobContentType: "audio/wav" } });

    // Read-only user-delegation SAS, 24h lifetime, so the UI <audio> tag can play it.
    const startsOn = new Date(Date.now() - 60_000); // skew buffer
    const expiresOn = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const delegationKey = await svc.getUserDelegationKey(startsOn, expiresOn);
    const sas = generateBlobSASQueryParameters(
      {
        containerName,
        blobName,
        permissions: BlobSASPermissions.parse("r"),
        startsOn,
        expiresOn,
      },
      delegationKey,
      account,
    ).toString();

    return {
      url: `${blob.url}?${sas}`,
      blobName,
      durationMs: Date.now() - this.startMs,
    };
  }

  private decodeAll(chunks: Buffer[]): Int16Array {
    const raw = Buffer.concat(chunks);
    if (this.encoding === "pcm16") {
      // Interpret as signed 16-bit LE samples.
      const arr = new Int16Array(raw.buffer, raw.byteOffset, raw.length / 2);
      return Int16Array.from(arr); // copy so it's not tied to chunk buffers
    }
    if (this.encoding === "mulaw") return mulawToPcm16(raw);
    return alawToPcm16(raw);
  }
}

function interleaveStereo(left: Int16Array, right: Int16Array): Int16Array {
  const len = Math.max(left.length, right.length);
  const out = new Int16Array(len * 2);
  for (let i = 0; i < len; i++) {
    out[i * 2] = i < left.length ? left[i] : 0;
    out[i * 2 + 1] = i < right.length ? right[i] : 0;
  }
  return out;
}

function wrapWavHeader(samples: Int16Array, sampleRate: number, channels: number): Buffer {
  const byteRate = sampleRate * channels * 2;
  const blockAlign = channels * 2;
  const dataSize = samples.length * 2;
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);          // PCM fmt chunk size
  header.writeUInt16LE(1, 20);           // PCM format
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(16, 34);          // bits per sample
  header.write("data", 36);
  header.writeUInt32LE(dataSize, 40);
  const pcm = Buffer.from(samples.buffer, samples.byteOffset, dataSize);
  return Buffer.concat([header, pcm]);
}

// ITU-T G.711 mu-law → linear PCM16
function mulawToPcm16(buf: Buffer): Int16Array {
  const out = new Int16Array(buf.length);
  for (let i = 0; i < buf.length; i++) {
    const u = ~buf[i] & 0xff;
    const sign = u & 0x80;
    const exponent = (u >> 4) & 0x07;
    const mantissa = u & 0x0f;
    let sample = ((mantissa << 3) + 0x84) << exponent;
    sample -= 0x84;
    out[i] = sign ? -sample : sample;
  }
  return out;
}

// ITU-T G.711 A-law → linear PCM16
function alawToPcm16(buf: Buffer): Int16Array {
  const out = new Int16Array(buf.length);
  for (let i = 0; i < buf.length; i++) {
    let a = buf[i] ^ 0x55;
    const sign = a & 0x80;
    const exponent = (a >> 4) & 0x07;
    const mantissa = a & 0x0f;
    let sample = exponent === 0 ? (mantissa << 4) + 8 : ((mantissa << 4) + 0x108) << (exponent - 1);
    out[i] = sign ? -sample : sample;
  }
  return out;
}

// ── Turn-based recording (STT→LLM→TTS flow) ──────────────────────
// Builds a stereo WAV where segments play sequentially:
// SUT segment → R channel with silence on L, tester segment → L channel with silence on R.

type AudioSegment = { side: "tester" | "sut" | "silence"; pcm: Buffer };

export async function uploadRecording(
  runId: string,
  segments: AudioSegment[],
  sampleRate: number,
): Promise<{ url: string; blobName: string; durationMs: number } | null> {
  const account = process.env.AZURE_STORAGE_ACCOUNT ?? "";
  if (!account) {
    console.warn("[recording] AZURE_STORAGE_ACCOUNT not set; skipping upload");
    return null;
  }
  if (segments.length === 0) return null;
  const containerName = process.env.AZURE_STORAGE_RECORDINGS_CONTAINER ?? "test-run-recordings";

  // Build stereo PCM: each segment plays on its channel, other is silence.
  // Silence segments = both channels silent (captures real latency gaps).
  const stereoChunks: Buffer[] = [];
  for (const seg of segments) {
    const samples = new Int16Array(seg.pcm.buffer, seg.pcm.byteOffset, seg.pcm.byteLength / 2);
    const stereo = new Int16Array(samples.length * 2);
    for (let i = 0; i < samples.length; i++) {
      if (seg.side === "tester") {
        stereo[i * 2] = samples[i];     // L = tester
        stereo[i * 2 + 1] = 0;          // R = silence
      } else if (seg.side === "sut") {
        stereo[i * 2] = 0;              // L = silence
        stereo[i * 2 + 1] = samples[i]; // R = SUT
      }
      // side === "silence": both channels stay 0
    }
    stereoChunks.push(Buffer.from(stereo.buffer, stereo.byteOffset, stereo.byteLength));
  }

  const pcmData = Buffer.concat(stereoChunks);
  const totalSamples = pcmData.length / 2;
  const durationMs = Math.round((totalSamples / 2 / sampleRate) * 1000);
  const wav = wrapWavHeader(new Int16Array(pcmData.buffer, pcmData.byteOffset, totalSamples), sampleRate, 2);

  const svc = new BlobServiceClient(`https://${account}.blob.core.windows.net`, credential);
  const container = svc.getContainerClient(containerName);
  await container.createIfNotExists();
  const blobName = `runs/${runId}.wav`;
  const blob = container.getBlockBlobClient(blobName);
  await blob.uploadData(wav, { blobHTTPHeaders: { blobContentType: "audio/wav" } });

  const startsOn = new Date(Date.now() - 60_000);
  const expiresOn = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const delegationKey = await svc.getUserDelegationKey(startsOn, expiresOn);
  const sas = generateBlobSASQueryParameters(
    { containerName, blobName, permissions: BlobSASPermissions.parse("r"), startsOn, expiresOn },
    delegationKey,
    account,
  ).toString();

  return { url: `${blob.url}?${sas}`, blobName, durationMs };
}
