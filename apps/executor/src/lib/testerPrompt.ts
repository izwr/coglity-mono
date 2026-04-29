import { SUPPORTED_LANGUAGES } from "@coglity/shared";

type PromptInput = {
  preCondition: string;
  testSteps: string;
  data: string;
  expectedResults: string;
  maxTurns: number;
  silenceMs: number;
  language?: string;
};

function buildLanguageInstruction(language?: string): string | null {
  if (!language || language === "en-US") return null;
  const langConfig = SUPPORTED_LANGUAGES.find((l) => l.code === language);
  const label = langConfig?.label ?? language;
  return `IMPORTANT: You are testing a ${label}-speaking voice bot. Speak ONLY in ${label}. All your utterances must be in ${label}. If test steps contain English terms (names, IDs, technical terms), use those exact values but frame sentences in ${label}.`;
}

export function buildTesterInstructions(input: PromptInput): string {
  const { preCondition, testSteps, data, expectedResults, maxTurns, silenceMs, language } = input;
  const silenceSeconds = Math.round(silenceMs / 1000);
  const langInstruction = buildLanguageInstruction(language);
  return [
    ...(langInstruction ? [langInstruction, ""] : []),
    "You are a QA tester on a voice call with a system-under-test (SUT). Your job is to execute ONE test case end-to-end and then decide pass or fail.",
    "",
    `Pre-conditions (assume already met): ${preCondition || "(none specified)"}`,
    `Test steps (execute in order, one utterance per turn): ${testSteps || "(none specified)"}`,
    `Test data (use these values when the SUT asks): ${data || "(none specified)"}`,
    `Expected results (what success looks like): ${expectedResults || "(none specified)"}`,
    "",
    "Rules for stopping — call `submit_verdict` EXACTLY ONCE, then stop speaking, as soon as ANY of these is true:",
    "1. You have finished all test steps AND observed whether the expected results occurred → verdict `pass` if they did, `fail` if they didn't.",
    "2. The SUT gave a response that makes the expected result impossible (refused, transferred, hung up, contradicted itself) → verdict `fail` with the specific reason.",
    `3. The SUT has been silent for more than ~${silenceSeconds} seconds after your last prompt, or repeated the same response twice with no progress → verdict \`fail\` with reason "SUT unresponsive" or "SUT looped".`,
    `4. You have been on the call for more than ${maxTurns} exchanges without finishing → verdict \`fail\` with reason "exceeded turn budget".`,
    "",
    "Do NOT: continue chatting after calling submit_verdict; invent pre-conditions not listed; go off-script. Stay on the test steps. Be concise — one short utterance per turn.",
    "",
    "When you call submit_verdict, `reasoning` must cite which step(s) passed/failed and which expected result was / wasn't observed.",
  ].join("\n");
}

export function buildTesterSystemPrompt(input: PromptInput): string {
  const { preCondition, testSteps, data, expectedResults, maxTurns, silenceMs, language } = input;
  const silenceSeconds = Math.round(silenceMs / 1000);
  const langInstruction = buildLanguageInstruction(language);
  return [
    ...(langInstruction ? [langInstruction, ""] : []),
    "You are a QA tester calling a voice bot (SUT). Each user message is what the bot said (transcribed). You reply with what you should say next — plain text, one short utterance.",
    "",
    `Pre-conditions (assume already met): ${preCondition || "(none)"}`,
    `Test steps (follow in order): ${testSteps || "(none)"}`,
    `Test data (use these values): ${data || "(none)"}`,
    `Expected results: ${expectedResults || "(none)"}`,
    "",
    "When to call submit_verdict (exactly once):",
    "1. All steps done AND expected results observed → pass.",
    "2. Bot made expected result impossible → fail with reason.",
    `3. Bot silent/looping → fail "SUT unresponsive".`,
    `4. More than ${maxTurns} exchanges → fail "exceeded turn budget".`,
    "",
    "Rules: one short utterance per turn. Don't go off-script. Don't chat after calling submit_verdict.",
  ].join("\n");
}
