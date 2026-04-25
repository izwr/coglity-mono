import type { AzureOpenAI } from "openai";

type TranscriptTurn = { role: "tester" | "sut" | "system"; text: string; ts: number };
type TurnTiming = { turn: number; sutAudioMs: number; sttMs: number; llmMs: number; ttsMs: number; sutBytes: number; testerBytes: number; sutText: string; testerText: string };

export function computeRuleBasedMetrics(
  transcript: TranscriptTurn[],
  timings: TurnTiming[],
  totalDurationMs: number,
  sampleRate: number,
): Record<string, string | number> {
  const metrics: Record<string, string | number> = {};

  metrics.total_duration_ms = totalDurationMs;
  metrics.total_turns = timings.length;

  if (timings.length === 0) return metrics;

  // Bot latency: time from tester audio sent → SUT audio starts arriving.
  // Approximated as sutAudioMs (time to collect SUT audio) for first turn,
  // and the gap between turns for subsequent ones.
  const botLatencies = timings.map((t) => t.sutAudioMs);
  metrics.avg_bot_latency_ms = Math.round(botLatencies.reduce((a, b) => a + b, 0) / botLatencies.length);
  metrics.max_bot_latency_ms = Math.max(...botLatencies);
  metrics.min_bot_latency_ms = Math.min(...botLatencies);

  // Tester pipeline latency: STT + LLM + TTS
  const testerLatencies = timings.map((t) => t.sttMs + t.llmMs + t.ttsMs);
  metrics.avg_tester_pipeline_ms = Math.round(testerLatencies.reduce((a, b) => a + b, 0) / testerLatencies.length);
  metrics.avg_stt_ms = Math.round(timings.reduce((a, t) => a + t.sttMs, 0) / timings.length);
  metrics.avg_llm_ms = Math.round(timings.reduce((a, t) => a + t.llmMs, 0) / timings.length);
  metrics.avg_tts_ms = Math.round(timings.reduce((a, t) => a + t.ttsMs, 0) / timings.length);

  // Speaking rates (words per second of audio)
  const bytesPerSecond = sampleRate * 2; // 16-bit mono
  const sutSpeakingEntries = timings.filter((t) => t.sutBytes > 0 && t.sutText);
  if (sutSpeakingEntries.length > 0) {
    const sutWps = sutSpeakingEntries.map((t) => {
      const durationSec = t.sutBytes / bytesPerSecond;
      const words = t.sutText.split(/\s+/).filter(Boolean).length;
      return durationSec > 0 ? words / durationSec : 0;
    });
    metrics.avg_bot_speaking_rate_wps = Math.round(sutWps.reduce((a, b) => a + b, 0) / sutWps.length * 10) / 10;
  }

  const testerEntries = timings.filter((t) => t.testerBytes > 0 && t.testerText);
  if (testerEntries.length > 0) {
    const testerWps = testerEntries.map((t) => {
      const durationSec = t.testerBytes / bytesPerSecond;
      const words = t.testerText.split(/\s+/).filter(Boolean).length;
      return durationSec > 0 ? words / durationSec : 0;
    });
    metrics.avg_tester_speaking_rate_wps = Math.round(testerWps.reduce((a, b) => a + b, 0) / testerWps.length * 10) / 10;
  }

  // Total speaking time
  const botSpeakingMs = timings.reduce((a, t) => a + (t.sutBytes / bytesPerSecond) * 1000, 0);
  const testerSpeakingMs = timings.reduce((a, t) => a + (t.testerBytes / bytesPerSecond) * 1000, 0);
  metrics.bot_total_speaking_ms = Math.round(botSpeakingMs);
  metrics.tester_total_speaking_ms = Math.round(testerSpeakingMs);
  metrics.silence_percentage = Math.round(
    Math.max(0, (1 - (botSpeakingMs + testerSpeakingMs) / totalDurationMs)) * 100,
  );

  // Word counts
  metrics.bot_total_words = timings.reduce((a, t) => a + t.sutText.split(/\s+/).filter(Boolean).length, 0);
  metrics.tester_total_words = timings.reduce((a, t) => a + t.testerText.split(/\s+/).filter(Boolean).length, 0);

  return metrics;
}

export async function evaluateWithLlm(
  llm: AzureOpenAI,
  deployment: string,
  transcript: TranscriptTurn[],
  testSteps: string,
  expectedResults: string,
): Promise<Record<string, string | number>> {
  const conversationText = transcript
    .map((t) => `${t.role === "sut" ? "Bot" : "Tester"}: ${t.text}`)
    .join("\n");

  const response = await llm.chat.completions.create({
    model: deployment,
    messages: [
      {
        role: "system",
        content: [
          "You are a QA evaluator. Given a transcript of a voice bot test call, rate the bot on the following dimensions.",
          "Return ONLY a JSON object with metric names as keys and integer scores (0-10) as values. No markdown, no explanation.",
          "",
          "Metrics to evaluate:",
          "- greeting_quality: How natural and appropriate was the bot's greeting?",
          "- comprehension: Did the bot understand what the user was asking?",
          "- accuracy: Were the bot's responses factually correct and relevant?",
          "- helpfulness: Did the bot provide useful information or actions?",
          "- tone_professionalism: Was the tone appropriate and professional?",
          "- task_completion: Did the bot successfully complete the requested task?",
          "- error_handling: How well did the bot handle unexpected inputs or edge cases?",
          "- response_coherence: Were the bot's responses logically coherent and on-topic?",
          "- conversation_flow: Was the conversation natural and well-paced?",
          "- overall_experience: Overall quality of the interaction.",
        ].join("\n"),
      },
      {
        role: "user",
        content: [
          `Test steps: ${testSteps}`,
          `Expected results: ${expectedResults}`,
          "",
          "Transcript:",
          conversationText,
        ].join("\n"),
      },
    ],
    temperature: 0.2,
  });

  const raw = response.choices[0]?.message?.content ?? "{}";
  try {
    const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    return JSON.parse(cleaned) as Record<string, number>;
  } catch {
    return { evaluation_parse_error: raw.slice(0, 200) };
  }
}

export type { TurnTiming };