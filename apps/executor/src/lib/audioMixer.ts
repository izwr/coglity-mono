import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const noiseCache = new Map<string, Int16Array>();

export function loadNoiseSample(environmentId: string): Int16Array | null {
  if (!environmentId || environmentId === "quiet") return null;
  if (noiseCache.has(environmentId)) return noiseCache.get(environmentId)!;

  const filePath = resolve(__dirname, `../../assets/noise/${environmentId}.pcm`);
  try {
    const buf = readFileSync(filePath);
    const samples = new Int16Array(buf.buffer, buf.byteOffset, buf.byteLength / 2);
    noiseCache.set(environmentId, samples);
    return samples;
  } catch {
    const samples = generateProceduralNoise(environmentId, 24000, 30);
    noiseCache.set(environmentId, samples);
    return samples;
  }
}

function generateProceduralNoise(
  _environmentId: string,
  sampleRate: number,
  durationSeconds: number,
): Int16Array {
  const length = sampleRate * durationSeconds;
  const samples = new Int16Array(length);
  // Pink noise via Voss-McCartney algorithm (sum of octave-band white noise)
  const bands = 8;
  const state = new Float64Array(bands);
  for (let i = 0; i < bands; i++) state[i] = (Math.random() * 2 - 1) * 0.15;

  for (let i = 0; i < length; i++) {
    for (let b = 0; b < bands; b++) {
      if ((i & ((1 << b) - 1)) === 0) {
        state[b] = (Math.random() * 2 - 1) * 0.15;
      }
    }
    let sum = 0;
    for (let b = 0; b < bands; b++) sum += state[b];
    samples[i] = Math.max(-32768, Math.min(32767, Math.round(sum * 32767)));
  }
  return samples;
}

export function mixWithNoise(
  cleanPcm: Buffer,
  noiseSamples: Int16Array,
  snrDb: number,
  noiseOffset: number,
): { mixed: Buffer; newOffset: number } {
  const cleanSamples = new Int16Array(
    cleanPcm.buffer, cleanPcm.byteOffset, cleanPcm.byteLength / 2,
  );

  let cleanRmsSum = 0;
  for (let i = 0; i < cleanSamples.length; i++) {
    cleanRmsSum += cleanSamples[i] * cleanSamples[i];
  }
  const cleanRms = Math.sqrt(cleanRmsSum / cleanSamples.length);
  const targetNoiseRms = cleanRms / Math.pow(10, snrDb / 20);

  let noiseRmsSum = 0;
  for (let i = 0; i < noiseSamples.length; i++) {
    noiseRmsSum += noiseSamples[i] * noiseSamples[i];
  }
  const noiseRms = Math.sqrt(noiseRmsSum / noiseSamples.length);
  const gain = noiseRms > 0 ? targetNoiseRms / noiseRms : 0;

  const output = new Int16Array(cleanSamples.length);
  let pos = noiseOffset % noiseSamples.length;
  for (let i = 0; i < cleanSamples.length; i++) {
    const mixed = cleanSamples[i] + Math.round(noiseSamples[pos] * gain);
    output[i] = Math.max(-32768, Math.min(32767, mixed));
    pos = (pos + 1) % noiseSamples.length;
  }

  return {
    mixed: Buffer.from(output.buffer, output.byteOffset, output.byteLength),
    newOffset: pos,
  };
}
