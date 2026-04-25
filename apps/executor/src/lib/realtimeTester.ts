import { WebSocket, type RawData } from "ws";
import { buildTesterInstructions } from "./testerPrompt.js";
import { buildOutgoingFrame, getAtPath } from "./audioFrame.js";
import { Recorder } from "./recording.js";
import { azureCredential } from "./azureCredential.js";

const AZURE_AI_SCOPE = "https://cognitiveservices.azure.com/.default";
const credential = azureCredential;

type TranscriptTurn = { role: "tester" | "sut" | "system"; text: string; ts: number };

type BotConnectionConfig = {
  url?: string;
  inputAudioField?: string;
  outputAudioField?: string;
  outputTemplate?: string;
  encoding?: "pcm16" | "mulaw" | "alaw";
  sampleRate?: string | number;
  channels?: string | number;
};

export type RunPayload = {
  runId: string;
  testCase: {
    id: string;
    preCondition: string;
    testSteps: string;
    expectedResults: string;
    data: string;
  };
  botConnection: {
    id: string;
    provider: string;
    config: BotConnectionConfig;
  };
};

type TerminalUpdate = {
  state: "passed" | "failed" | "errored";
  verdict?: string;
  error?: string;
  transcript: TranscriptTurn[];
  recordingUrl?: string;
  recordingBlobName?: string;
  recordingDurationMs?: number;
  startedAt: Date;
  finishedAt: Date;
};

function realtimeAudioFormat(enc: string | undefined): string {
  if (enc === "mulaw") return "g711_ulaw";
  if (enc === "alaw") return "g711_alaw";
  return "pcm16";
}

export async function runVoiceTest(payload: RunPayload): Promise<void> {
  const TAG = `[run ${payload.runId}]`;
  console.log(`${TAG} ── starting voice test ──`);
  console.log(`${TAG} testCase: ${payload.testCase.id}`);
  console.log(`${TAG} sut url: ${payload.botConnection.config?.url ?? "(none)"}`);
  console.log(`${TAG} realtime endpoint: ${process.env.AZURE_OPENAI_REALTIME_ENDPOINT}`);
  console.log(`${TAG} deployment: ${process.env.AZURE_OPENAI_REALTIME_DEPLOYMENT}`);

  const startedAt = new Date();
  await patchRun(payload.runId, { state: "running", startedAt });

  const cfg = payload.botConnection.config ?? {};
  const sampleRate = Number(cfg.sampleRate) || 24000;
  const encoding = (cfg.encoding ?? "pcm16") as "pcm16" | "mulaw" | "alaw";
  const maxDurationMs = parseInt(process.env.EXECUTOR_MAX_DURATION_MS ?? "180000", 10);
  const maxTurns = parseInt(process.env.EXECUTOR_MAX_TURNS ?? "12", 10);
  const silenceMs = parseInt(process.env.EXECUTOR_SILENCE_MS ?? "8000", 10);

  const transcript: TranscriptTurn[] = [];
  const recorder = new Recorder({ sampleRate, encoding });

  let finished = false;
  let turns = 0;
  let sutAudioFrames = 0;
  let testerAudioFrames = 0;
  let realtime: WebSocket | null = null;
  let sut: WebSocket | null = null;
  let timeoutHandle: NodeJS.Timeout | null = null;
  let silenceInterval: NodeJS.Timeout | null = null;

  // 100ms of silence at 24kHz PCM16 mono = 4800 bytes of zeros
  const SILENCE_CHUNK = Buffer.alloc(4800).toString("base64");

  const stopSilence = () => {
    if (silenceInterval) { clearInterval(silenceInterval); silenceInterval = null; }
  };

  const startSilence = () => {
    stopSilence();
    let sent = 0;
    silenceInterval = setInterval(() => {
      if (!sut || sut.readyState !== WebSocket.OPEN || finished || sent >= 15) {
        stopSilence();
        return;
      }
      const frame = buildOutgoingFrame(cfg.outputTemplate, cfg.inputAudioField ?? "audio", SILENCE_CHUNK);
      sut.send(JSON.stringify(frame));
      sent++;
    }, 100);
  };

  const pushTurn = (role: TranscriptTurn["role"], text: string) => {
    if (!text) return;
    transcript.push({ role, text, ts: Date.now() });
  };

  const finish = async (update: Omit<TerminalUpdate, "startedAt" | "finishedAt" | "transcript">) => {
    if (finished) return;
    finished = true;
    stopSilence();
    if (timeoutHandle) clearTimeout(timeoutHandle);
    console.log(
      `${TAG} finishing: state=${update.state}` +
        (update.error ? ` error="${update.error}"` : "") +
        (update.verdict ? ` verdict="${update.verdict.slice(0, 120)}"` : ""),
    );
    console.log(`${TAG} stats: testerAudioFrames=${testerAudioFrames} sutAudioFrames=${sutAudioFrames} turns=${turns} transcriptLen=${transcript.length}`);
    try { realtime?.close(); } catch { /* noop */ }
    try { sut?.close(); } catch { /* noop */ }

    let recording: Awaited<ReturnType<Recorder["finalize"]>> = null;
    try {
      recording = await recorder.finalize(payload.runId);
    } catch (e) {
      console.error(`${TAG} recording upload failed`, e);
    }

    await patchRun(payload.runId, {
      ...update,
      transcript,
      recordingUrl: recording?.url ?? "",
      recordingBlobName: recording?.blobName ?? "",
      recordingDurationMs: recording?.durationMs ?? 0,
      startedAt,
      finishedAt: new Date(),
    });
  };

  timeoutHandle = setTimeout(() => {
    finish({ state: "errored", error: `timeout: exceeded ${maxDurationMs}ms` });
  }, maxDurationMs);

  // ── 1) Acquire token ───────────────────────────────────────────
  const rtEndpoint = (process.env.AZURE_OPENAI_REALTIME_ENDPOINT ?? "").replace(/\/$/, "");
  const rtDeployment = process.env.AZURE_OPENAI_REALTIME_DEPLOYMENT ?? "gpt-4o-realtime-preview";
  const rtApiVersion = process.env.AZURE_OPENAI_REALTIME_API_VERSION ?? "2024-10-01-preview";
  if (!rtEndpoint) {
    await finish({ state: "errored", error: "AZURE_OPENAI_REALTIME_ENDPOINT not set" });
    return;
  }

  let rtToken: string;
  try {
    console.log(`${TAG} acquiring azure token...`);
    const tok = await credential.getToken(AZURE_AI_SCOPE);
    if (!tok) throw new Error("getToken returned null");
    rtToken = tok.token;
    console.log(`${TAG} token acquired`);
  } catch (err) {
    await finish({ state: "errored", error: `azure auth failed: ${err instanceof Error ? err.message : String(err)}` });
    return;
  }

  // ── 2) Connect Realtime and wait for session ready ─────────────
  const rtUrl = `${rtEndpoint}/realtime?api-version=${encodeURIComponent(rtApiVersion)}&deployment=${encodeURIComponent(rtDeployment)}`;
  console.log(`${TAG} connecting to realtime: ${rtUrl}`);

  try {
    realtime = await connectAndSetupRealtime(rtUrl, rtToken);
  } catch (err) {
    await finish({ state: "errored", error: `realtime connect failed: ${err instanceof Error ? err.message : String(err)}` });
    return;
  }
  console.log(`${TAG} realtime WS open`);

  // Send session config and wait for session.updated before connecting SUT.
  const audioFormat = realtimeAudioFormat(encoding);
  const instructions = buildTesterInstructions({
    preCondition: payload.testCase.preCondition,
    testSteps: payload.testCase.testSteps,
    data: payload.testCase.data,
    expectedResults: payload.testCase.expectedResults,
    maxTurns,
    silenceMs,
  });

  try {
    await setupRealtimeSession(realtime, instructions, audioFormat);
  } catch (err) {
    await finish({ state: "errored", error: `realtime session setup failed: ${err instanceof Error ? err.message : String(err)}` });
    return;
  }
  console.log(`${TAG} realtime session ready`);

  // ── 3) Now connect SUT (bot under test) ────────────────────────
  const sutUrl = cfg.url;
  if (!sutUrl) {
    await finish({ state: "errored", error: "bot_connection.config.url is empty" });
    return;
  }
  console.log(`${TAG} connecting to SUT: ${sutUrl}`);

  try {
    sut = await connectWs(sutUrl);
  } catch (err) {
    await finish({ state: "errored", error: `sut connect failed: ${err instanceof Error ? err.message : String(err)}` });
    return;
  }
  console.log(`${TAG} SUT WS open`);

  // ── 4) Wire up the audio bridge ────────────────────────────────

  // Realtime → SUT: tester speaks, forward audio to bot
  realtime.on("message", async (raw: RawData) => {
    let msg: Record<string, unknown>;
    try { msg = JSON.parse(raw.toString()) as Record<string, unknown>; } catch { return; }
    const t = msg.type as string;

    if (t === "response.audio.delta") {
      const audio = msg.delta as string;
      if (audio) {
        testerAudioFrames++;
        recorder.appendTester(audio);
        if (sut && sut.readyState === WebSocket.OPEN) {
          const frame = buildOutgoingFrame(cfg.outputTemplate, cfg.inputAudioField ?? "audio", audio);
          sut.send(JSON.stringify(frame));
        }
      }
    } else if (t === "response.audio_transcript.done") {
      const text = String(msg.transcript ?? "");
      console.log(`${TAG} tester said: "${text.slice(0, 150)}"`);
      pushTurn("tester", text);
    } else if (t === "conversation.item.input_audio_transcription.completed") {
      const text = String(msg.transcript ?? "");
      console.log(`${TAG} sut said: "${text.slice(0, 150)}"`);
      pushTurn("sut", text);
    } else if (t === "response.done") {
      turns += 1;
      console.log(`${TAG} response.done (turn ${turns}/${maxTurns})`);
      // Send silence frames so the SUT's VAD detects end-of-speech.
      startSilence();
      if (turns > maxTurns && !finished) {
        await finish({ state: "failed", verdict: "exceeded turn budget" });
      }
    } else if (t === "response.function_call_arguments.done") {
      const name = msg.name as string;
      console.log(`${TAG} tool call: ${name}`);
      if (name === "submit_verdict") {
        let args: { verdict?: string; reasoning?: string } = {};
        try { args = JSON.parse(String(msg.arguments ?? "{}")); } catch { /* noop */ }
        console.log(`${TAG} verdict=${args.verdict} reasoning="${(args.reasoning ?? "").slice(0, 200)}"`);
        await finish({ state: args.verdict === "pass" ? "passed" : "failed", verdict: args.reasoning ?? "" });
      }
    } else if (t === "error") {
      const errObj = msg.error as { message?: string; code?: string } | undefined;
      console.error(`${TAG} realtime error: [${errObj?.code ?? ""}] ${errObj?.message ?? JSON.stringify(msg.error)}`);
    }
  });

  realtime.on("error", async (err) => {
    await finish({ state: "errored", error: `realtime socket error: ${err.message}` });
  });
  realtime.on("close", async (code, reason) => {
    if (!finished) {
      await finish({ state: "errored", error: `realtime socket closed: ${code} ${reason.toString()}` });
    }
  });

  // SUT → Realtime: bot speaks, forward audio to tester's realtime input
  let sutMessageCount = 0;
  sut.on("message", (raw: RawData) => {
    let frame: unknown;
    const text = raw.toString();
    try { frame = JSON.parse(text); } catch { return; }
    sutMessageCount++;

    const frameType = (frame as Record<string, unknown>)?.type;

    // Log first few and every Nth for visibility
    if (sutMessageCount <= 5 || sutMessageCount % 50 === 0) {
      console.log(`${TAG} sut frame #${sutMessageCount}: type=${String(frameType)} (len=${text.length})`);
    }

    const audio = getAtPath(frame, cfg.outputAudioField ?? "audio");
    if (typeof audio === "string" && audio) {
      stopSilence(); // SUT is responding, stop sending silence
      sutAudioFrames++;
      recorder.appendSut(audio);
      if (realtime && realtime.readyState === WebSocket.OPEN) {
        realtime.send(JSON.stringify({ type: "input_audio_buffer.append", audio }));
      }
    }
  });

  sut.on("error", async (err) => {
    await finish({ state: "errored", error: `sut socket error: ${err.message}` });
  });
  sut.on("close", async (code, reason) => {
    if (!finished) {
      await finish({ state: "errored", error: `sut socket closed: ${code} ${reason.toString()}` });
    }
  });

  // ── 5) Kick off the tester's first utterance ───────────────────
  console.log(`${TAG} sending response.create to start tester`);
  realtime.send(JSON.stringify({
    type: "response.create",
    response: { modalities: ["audio", "text"] },
  }));
}

// ── Helpers ────────────────────────────────────────────────────────

function connectWs(url: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    ws.once("open", () => resolve(ws));
    ws.once("error", reject);
    ws.once("unexpected-response", (_req, res) => {
      const chunks: Buffer[] = [];
      res.on("data", (c: Buffer) => chunks.push(c));
      res.on("end", () => {
        reject(new Error(`handshake ${res.statusCode}: ${Buffer.concat(chunks).toString("utf8").slice(0, 300)}`));
      });
    });
  });
}

function connectAndSetupRealtime(url: string, token: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url, { headers: { Authorization: `Bearer ${token}` } });
    ws.once("open", () => resolve(ws));
    ws.once("error", reject);
    ws.once("unexpected-response", (_req, res) => {
      const chunks: Buffer[] = [];
      res.on("data", (c: Buffer) => chunks.push(c));
      res.on("end", () => {
        reject(new Error(`handshake ${res.statusCode}: ${Buffer.concat(chunks).toString("utf8").slice(0, 500)}`));
      });
    });
  });
}

function setupRealtimeSession(ws: WebSocket, instructions: string, audioFormat: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("session.updated timeout (10s)")), 10_000);
    const handler = (raw: RawData) => {
      try {
        const msg = JSON.parse(raw.toString()) as Record<string, unknown>;
        if (msg.type === "session.created") {
          // session exists, now send our config
        } else if (msg.type === "session.updated") {
          clearTimeout(timeout);
          ws.removeListener("message", handler);
          resolve();
        } else if (msg.type === "error") {
          clearTimeout(timeout);
          ws.removeListener("message", handler);
          const errObj = msg.error as { message?: string } | undefined;
          reject(new Error(errObj?.message ?? "realtime session error"));
        }
      } catch { /* noop */ }
    };
    ws.on("message", handler);
    ws.send(JSON.stringify({
      type: "session.update",
      session: {
        modalities: ["audio", "text"],
        instructions,
        voice: "alloy",
        input_audio_format: audioFormat,
        output_audio_format: audioFormat,
        input_audio_transcription: { model: "whisper-1" },
        turn_detection: { type: "server_vad" },
        tools: [
          {
            type: "function",
            name: "submit_verdict",
            description: "Call exactly once when the test is done. verdict=pass|fail, reasoning cites which steps/expected results matched.",
            parameters: {
              type: "object",
              properties: {
                verdict: { type: "string", enum: ["pass", "fail"] },
                reasoning: { type: "string" },
              },
              required: ["verdict", "reasoning"],
            },
          },
        ],
        tool_choice: "auto",
      },
    }));
  });
}

async function patchRun(runId: string, body: Record<string, unknown>): Promise<void> {
  const backendUrl = (process.env.BACKEND_INTERNAL_URL ?? "").replace(/\/$/, "");
  const secret = process.env.EXECUTOR_WEBHOOK_SECRET ?? "";
  if (!backendUrl) {
    console.warn(`[run ${runId}] BACKEND_INTERNAL_URL not set; skipping callback`, body);
    return;
  }
  try {
    const res = await fetch(`${backendUrl}/api/internal/test-runs/${runId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", "x-webhook-secret": secret },
      body: JSON.stringify(serialize(body)),
    });
    if (!res.ok) {
      console.error(`[run ${runId}] callback ${res.status}: ${await res.text()}`);
    }
  } catch (err) {
    console.error(`[run ${runId}] callback failed:`, err);
  }
}

function serialize(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v instanceof Date) out[k] = v.toISOString();
    else out[k] = v;
  }
  return out;
}
