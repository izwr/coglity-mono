import { WebSocket, type RawData } from "ws";
import * as speechSdk from "microsoft-cognitiveservices-speech-sdk";
import { AzureOpenAI } from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { buildOutgoingFrame, getAtPath } from "./audioFrame.js";
import { uploadRecording } from "./recording.js";
import { azureCredential } from "./azureCredential.js";
import { buildTesterSystemPrompt } from "./testerPrompt.js";
import { computeRuleBasedMetrics, evaluateWithLlm, type TurnTiming } from "./metrics.js";
import { loadNoiseSample, mixWithNoise } from "./audioMixer.js";

const AZURE_AI_SCOPE = "https://cognitiveservices.azure.com/.default";

type TranscriptTurn = { role: "tester" | "sut" | "system"; text: string; ts: number };

type BotConnectionConfig = {
  url?: string;
  inputAudioField?: string;
  outputAudioField?: string;
  outputTemplate?: string;
  encoding?: "pcm16" | "mulaw" | "alaw";
  sampleRate?: string | number;
  channels?: string | number;
  authHeaders?: { key: string; value: string }[];
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
  language?: string;
  ttsVoice?: string;
  environment?: string;
  environmentSnrDb?: number;
};

export async function runVoiceTest(payload: RunPayload): Promise<void> {
  const TAG = `[run ${payload.runId}]`;
  console.log(`${TAG} ── starting voice test (STT→LLM→TTS) ──`);

  const startedAt = new Date();
  await patchRun(payload.runId, { state: "running", startedAt });

  const cfg = payload.botConnection.config ?? {};
  const sampleRate = Number(cfg.sampleRate) || 24000;
  const encoding = (cfg.encoding ?? "pcm16") as "pcm16" | "mulaw" | "alaw";
  const maxDurationMs = parseInt(process.env.EXECUTOR_MAX_DURATION_MS ?? "180000", 10);
  const maxTurns = parseInt(process.env.EXECUTOR_MAX_TURNS ?? "12", 10);
  const silenceMs = parseInt(process.env.EXECUTOR_SILENCE_MS ?? "8000", 10);

  const transcript: TranscriptTurn[] = [];
  const audioSegments: { side: "tester" | "sut" | "silence"; pcm: Buffer }[] = [];
  const turnTimings: TurnTiming[] = [];
  let lastSegmentEndMs = Date.now();
  let finished = false;

  // used only by the hard timeout
  const finish = async (state: "passed" | "failed" | "errored", opts: { verdict?: string; error?: string }) => {
    await computeAndFinish(state, opts);
  };

  // ── Auth ────────────────────────────────────────────────────────
  let token: string;
  try {
    console.log(`${TAG} acquiring azure token...`);
    const tok = await azureCredential.getToken(AZURE_AI_SCOPE);
    if (!tok) throw new Error("getToken returned null");
    token = tok.token;
    console.log(`${TAG} token acquired`);
  } catch (err) {
    await finish("errored", { error: `azure auth failed: ${err instanceof Error ? err.message : String(err)}` });
    return;
  }

  // ── Azure Speech config (AAD auth via custom subdomain) ─────────
  const speechRegion = process.env.AZURE_SPEECH_REGION ?? "";
  const speechResourceId = process.env.AZURE_SPEECH_RESOURCE_ID ?? "";
  const speechCustomDomain = process.env.AZURE_SPEECH_CUSTOM_DOMAIN ?? "";
  if (!speechRegion || !speechResourceId) {
    await finish("errored", { error: "AZURE_SPEECH_REGION or AZURE_SPEECH_RESOURCE_ID not set" });
    return;
  }
  const speechAuthToken = `aad#${speechResourceId}#${token}`;
  let speechConfig: speechSdk.SpeechConfig;
  if (speechCustomDomain) {
    speechConfig = speechSdk.SpeechConfig.fromHost(new URL(`wss://${speechCustomDomain}.cognitiveservices.azure.com`));
    speechConfig.authorizationToken = speechAuthToken;
  } else {
    speechConfig = speechSdk.SpeechConfig.fromAuthorizationToken(speechAuthToken, speechRegion);
  }
  speechConfig.speechRecognitionLanguage = payload.language ?? "en-US";
  speechConfig.speechSynthesisVoiceName = payload.ttsVoice ?? process.env.AZURE_SPEECH_VOICE ?? "en-US-AvaMultilingualNeural";
  speechConfig.speechSynthesisOutputFormat = speechSdk.SpeechSynthesisOutputFormat.Raw24Khz16BitMonoPcm;

  // ── Azure OpenAI (GPT-4.1 mini) ────────────────────────────────
  const aoaiEndpoint = process.env.AZURE_OPENAI_ENDPOINT ?? "";
  const aoaiDeployment = process.env.AZURE_OPENAI_CHAT_DEPLOYMENT ?? "gpt-4.1-mini";
  if (!aoaiEndpoint) {
    await finish("errored", { error: "AZURE_OPENAI_ENDPOINT not set" });
    return;
  }
  const llm = new AzureOpenAI({
    endpoint: aoaiEndpoint,
    apiVersion: "2024-10-01-preview",
    azureADTokenProvider: async () => {
      const tok = await azureCredential.getToken(AZURE_AI_SCOPE);
      return tok.token;
    },
  });

  // ── Environment noise ────────────────────────────────────────────
  const noiseSamples = loadNoiseSample(payload.environment ?? "quiet");
  const snrDb = payload.environmentSnrDb ?? 15;
  let noiseOffset = 0;

  // ── Connect to SUT ──────────────────────────────────────────────
  const sutUrl = cfg.url;
  if (!sutUrl) {
    await finish("errored", { error: "bot_connection.config.url is empty" });
    return;
  }
  console.log(`${TAG} connecting to SUT: ${sutUrl}`);
  const sutHeaders = cfg.authHeaders?.reduce<Record<string, string>>((acc, h) => {
    if (h.key.trim()) acc[h.key] = h.value;
    return acc;
  }, {});

  let sut: WebSocket;
  try {
    sut = await connectWs(sutUrl, sutHeaders);
  } catch (err) {
    await finish("errored", { error: `sut connect failed: ${err instanceof Error ? err.message : String(err)}` });
    return;
  }
  console.log(`${TAG} SUT WS open`);

  // ── Hard timeout ────────────────────────────────────────────────
  const timeoutHandle = setTimeout(() => {
    finish("errored", { error: `timeout: exceeded ${maxDurationMs}ms` });
  }, maxDurationMs);

  // ── Conversation loop ───────────────────────────────────────────
  const systemPrompt = buildTesterSystemPrompt({
    preCondition: payload.testCase.preCondition,
    testSteps: payload.testCase.testSteps,
    data: payload.testCase.data,
    expectedResults: payload.testCase.expectedResults,
    maxTurns,
    silenceMs,
    language: payload.language,
  });

  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
  ];

  const computeAndFinish = async (state: "passed" | "failed" | "errored", opts: { verdict?: string; error?: string }) => {
    clearTimeout(timeoutHandle);
    const totalDurationMs = Date.now() - startedAt.getTime();

    // Compute rule-based metrics
    const ruleMetrics = computeRuleBasedMetrics(transcript, turnTimings, totalDurationMs, sampleRate);
    console.log(`${TAG} rule metrics:`, JSON.stringify(ruleMetrics));

    // LLM evaluation (skip on error / empty transcript)
    let llmMetrics: Record<string, string | number> = {};
    if (state !== "errored" && transcript.length > 0) {
      try {
        console.log(`${TAG} running LLM evaluation...`);
        llmMetrics = await evaluateWithLlm(
          llm, aoaiDeployment, transcript,
          payload.testCase.testSteps, payload.testCase.expectedResults,
        );
        console.log(`${TAG} llm metrics:`, JSON.stringify(llmMetrics));
      } catch (e) {
        console.error(`${TAG} LLM eval failed:`, e);
      }
    }

    const properties = { ...ruleMetrics, ...llmMetrics };
    await finishWithProps(state, { ...opts, properties });
  };

  const finishWithProps = async (
    state: "passed" | "failed" | "errored",
    opts: { verdict?: string; error?: string; properties?: Record<string, string | number> },
  ) => {
    if (finished) return;
    finished = true;
    console.log(`${TAG} finishing: state=${state}${opts.error ? ` error="${opts.error}"` : ""}${opts.verdict ? ` verdict="${opts.verdict.slice(0, 120)}"` : ""}`);

    try { sut?.close(); } catch { /* noop */ }

    let recording: Awaited<ReturnType<typeof uploadRecording>> = null;
    try {
      recording = await uploadRecording(payload.runId, audioSegments, sampleRate);
    } catch (e) {
      console.error(`${TAG} recording upload failed`, e);
    }

    await patchRun(payload.runId, {
      state,
      verdict: opts.verdict ?? "",
      error: opts.error ?? "",
      transcript,
      properties: opts.properties ?? {},
      recordingUrl: recording?.url ?? "",
      recordingBlobName: recording?.blobName ?? "",
      recordingDurationMs: recording?.durationMs ?? 0,
      startedAt,
      finishedAt: new Date(),
    });
  };

  try {
    for (let turn = 0; turn < maxTurns && !finished; turn++) {
      const timing: TurnTiming = { turn: turn + 1, sutAudioMs: 0, sttMs: 0, llmMs: 0, ttsMs: 0, sutBytes: 0, testerBytes: 0, sutText: "", testerText: "" };

      // 1. Collect SUT audio until audio_done
      console.log(`${TAG} waiting for SUT audio (turn ${turn + 1})...`);
      const t0 = Date.now();
      const sutAudio = await collectSutAudio(sut, cfg);
      timing.sutAudioMs = Date.now() - t0;
      if (finished) break;
      if (!sutAudio || sutAudio.length === 0) {
        console.log(`${TAG} no SUT audio received, SUT may have closed`);
        break;
      }
      timing.sutBytes = sutAudio.length;
      console.log(`${TAG} collected ${sutAudio.length} bytes in ${timing.sutAudioMs}ms`);

      const nowMs = Date.now();
      const gapMs = nowMs - lastSegmentEndMs;
      if (gapMs > 100) {
        audioSegments.push({ side: "silence", pcm: Buffer.alloc(Math.round((sampleRate * 2 * gapMs) / 1000)) });
      }
      audioSegments.push({ side: "sut", pcm: sutAudio });
      lastSegmentEndMs = Date.now();

      // 2. STT
      console.log(`${TAG} transcribing SUT audio...`);
      const t1 = Date.now();
      const sutText = await transcribeAudio(speechConfig, sutAudio, sampleRate);
      timing.sttMs = Date.now() - t1;
      timing.sutText = sutText;
      console.log(`${TAG} SUT said (${timing.sttMs}ms): "${sutText.slice(0, 150)}"`);
      transcript.push({ role: "sut", text: sutText, ts: Date.now() });

      // 3. LLM
      messages.push({ role: "user", content: `[Bot said]: ${sutText}` });
      console.log(`${TAG} calling LLM (turn ${turn + 1})...`);
      const t2 = Date.now();

      const llmResult = await llm.chat.completions.create({
        model: aoaiDeployment,
        messages,
        tools: [
          {
            type: "function",
            function: {
              name: "submit_verdict",
              description: "Call exactly once when the test is done.",
              parameters: {
                type: "object",
                properties: {
                  verdict: { type: "string", enum: ["pass", "fail"] },
                  reasoning: { type: "string" },
                },
                required: ["verdict", "reasoning"],
              },
            },
          },
        ],
        tool_choice: "auto",
      });
      timing.llmMs = Date.now() - t2;

      const choice = llmResult.choices[0];
      const toolCall = choice.message.tool_calls?.[0];

      if (toolCall?.function.name === "submit_verdict") {
        const args = JSON.parse(toolCall.function.arguments);
        console.log(`${TAG} verdict=${args.verdict} (LLM ${timing.llmMs}ms) reasoning="${(args.reasoning ?? "").slice(0, 200)}"`);
        turnTimings.push(timing);
        await computeAndFinish(args.verdict === "pass" ? "passed" : "failed", { verdict: args.reasoning });
        return;
      }

      const testerText = choice.message.content ?? "";
      timing.testerText = testerText;
      console.log(`${TAG} tester will say (LLM ${timing.llmMs}ms): "${testerText.slice(0, 150)}"`);
      messages.push({ role: "assistant", content: testerText });
      transcript.push({ role: "tester", text: testerText, ts: Date.now() });

      // 4. TTS
      if (testerText && sut.readyState === WebSocket.OPEN) {
        console.log(`${TAG} synthesizing TTS...`);
        const t3 = Date.now();
        const ttsAudio = await synthesizeSpeech(speechConfig, testerText);
        timing.ttsMs = Date.now() - t3;
        console.log(`${TAG} TTS produced ${ttsAudio.length} bytes in ${timing.ttsMs}ms`);

        // Mix environment noise into TTS audio before sending to SUT
        let audioToSend = ttsAudio;
        if (noiseSamples) {
          const result = mixWithNoise(ttsAudio, noiseSamples, snrDb, noiseOffset);
          audioToSend = result.mixed;
          noiseOffset = result.newOffset;
        }
        timing.testerBytes = audioToSend.length;

        const nowMs2 = Date.now();
        const gapMs2 = nowMs2 - lastSegmentEndMs;
        if (gapMs2 > 100) {
          audioSegments.push({ side: "silence", pcm: Buffer.alloc(Math.round((sampleRate * 2 * gapMs2) / 1000)) });
        }
        audioSegments.push({ side: "tester", pcm: audioToSend });
        lastSegmentEndMs = Date.now();

        // 5. Stream audio to SUT
        const CHUNK_SIZE = 4800;
        for (let offset = 0; offset < audioToSend.length && sut.readyState === WebSocket.OPEN; offset += CHUNK_SIZE) {
          const chunk = audioToSend.subarray(offset, offset + CHUNK_SIZE);
          sut.send(JSON.stringify(buildOutgoingFrame(cfg.outputTemplate, cfg.inputAudioField ?? "audio", chunk.toString("base64"))));
        }
        sut.send(JSON.stringify({ type: "commit" }));
        console.log(`${TAG} sent tester audio + commit to SUT`);
      }

      turnTimings.push(timing);
    }

    if (!finished) {
      await computeAndFinish("failed", { verdict: "exceeded turn budget without verdict" });
    }
  } catch (err) {
    clearTimeout(timeoutHandle);
    await finishWithProps("errored", { error: `run error: ${err instanceof Error ? err.message : String(err)}` });
  }
}

// ── Collect SUT audio frames until audio_done ─────────────────────

function collectSutAudio(
  sut: WebSocket,
  cfg: BotConnectionConfig,
): Promise<Buffer | null> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    let resolved = false;

    const timeout = setTimeout(() => {
      if (!resolved) { resolved = true; cleanup(); resolve(chunks.length > 0 ? Buffer.concat(chunks) : null); }
    }, 30_000);

    const onMessage = (raw: RawData) => {
      if (resolved) return;
      let frame: Record<string, unknown>;
      try { frame = JSON.parse(raw.toString()); } catch { return; }
      const frameType = frame.type as string;

      if (frameType === "audio") {
        const audio = getAtPath(frame, cfg.outputAudioField ?? "audio");
        if (typeof audio === "string" && audio) {
          chunks.push(Buffer.from(audio, "base64"));
        }
      } else if (frameType === "audio_done") {
        if (!resolved) { resolved = true; cleanup(); resolve(Buffer.concat(chunks)); }
      }
    };

    const onClose = () => {
      if (!resolved) { resolved = true; cleanup(); resolve(chunks.length > 0 ? Buffer.concat(chunks) : null); }
    };

    const cleanup = () => {
      clearTimeout(timeout);
      sut.removeListener("message", onMessage);
      sut.removeListener("close", onClose);
    };

    sut.on("message", onMessage);
    sut.on("close", onClose);
  });
}

// ── STT via Azure Speech SDK ──────────────────────────────────────

function transcribeAudio(config: speechSdk.SpeechConfig, pcmAudio: Buffer, sampleRate: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const format = speechSdk.AudioStreamFormat.getWaveFormatPCM(sampleRate, 16, 1);
    const pushStream = speechSdk.AudioInputStream.createPushStream(format);
    pushStream.write(new Uint8Array(pcmAudio).buffer as ArrayBuffer);
    pushStream.close();

    const audioConfig = speechSdk.AudioConfig.fromStreamInput(pushStream);
    const recognizer = new speechSdk.SpeechRecognizer(config, audioConfig);

    let fullText = "";
    recognizer.recognized = (_s, e) => {
      if (e.result.reason === speechSdk.ResultReason.RecognizedSpeech) {
        fullText += (fullText ? " " : "") + e.result.text;
      }
    };

    recognizer.canceled = (_s, e) => {
      clearTimeout(timeout);
      recognizer.close();
      if (e.reason === speechSdk.CancellationReason.Error) {
        reject(new Error(`STT error: ${e.errorDetails}`));
      } else {
        resolve(fullText);
      }
    };

    recognizer.sessionStopped = () => {
      clearTimeout(timeout);
      recognizer.close();
      resolve(fullText);
    };

    const timeout = setTimeout(() => {
      recognizer.close();
      resolve(fullText || "(STT timeout)");
    }, 30_000);

    recognizer.startContinuousRecognitionAsync(
      () => {},
      (err) => { clearTimeout(timeout); recognizer.close(); reject(new Error(`STT start failed: ${err}`)); },
    );
  });
}

// ── TTS via Azure Speech SDK ──────────────────────────────────────

function synthesizeSpeech(config: speechSdk.SpeechConfig, text: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const synthesizer = new speechSdk.SpeechSynthesizer(config, undefined as unknown as speechSdk.AudioConfig);
    synthesizer.speakTextAsync(
      text,
      (result) => {
        synthesizer.close();
        if (result.reason === speechSdk.ResultReason.SynthesizingAudioCompleted) {
          resolve(Buffer.from(result.audioData));
        } else {
          reject(new Error(`TTS failed: ${speechSdk.ResultReason[result.reason]} — ${result.errorDetails ?? ""}`));
        }
      },
      (err) => {
        synthesizer.close();
        reject(new Error(`TTS error: ${err}`));
      },
    );
  });
}

// ── WS helper ─────────────────────────────────────────────────────

function connectWs(url: string, headers?: Record<string, string>): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url, headers ? { headers } : undefined);
    ws.once("open", () => resolve(ws));
    ws.once("error", reject);
  });
}

// ── Backend callback ──────────────────────────────────────────────

async function patchRun(runId: string, body: Record<string, unknown>): Promise<void> {
  const backendUrl = (process.env.BACKEND_INTERNAL_URL ?? "").replace(/\/$/, "");
  const secret = process.env.EXECUTOR_WEBHOOK_SECRET ?? "";
  if (!backendUrl) {
    console.warn(`[run ${runId}] BACKEND_INTERNAL_URL not set; skipping callback`);
    return;
  }
  try {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(body)) {
      out[k] = v instanceof Date ? v.toISOString() : v;
    }
    const res = await fetch(`${backendUrl}/api/internal/test-runs/${runId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", "x-webhook-secret": secret },
      body: JSON.stringify(out),
    });
    if (!res.ok) {
      console.error(`[run ${runId}] callback ${res.status}: ${await res.text()}`);
    }
  } catch (err) {
    console.error(`[run ${runId}] callback failed:`, err);
  }
}