import type Anthropic from '@anthropic-ai/sdk';
import type { AgentContext, AgentResult } from '../shared/types';
import type { Verdict, StepResult } from '../../runner/events';
import type { ParsedSpec } from '../../spec/types';
import { JUDGE_SYSTEM_PROMPT } from './prompt';
import { verdictSchema } from './schema';
import { extractToolUseBlocks } from '../shared/tools';
import { AgentSchemaError } from '../shared/errors';

export interface JudgeInput {
  spec: ParsedSpec;
  stepResults: StepResult[];
  finalAccessibilityTree: string;
}

const VERDICT_TOOL: Anthropic.Tool = {
  name: 'verdict',
  description: 'Return your verdict on whether the test passed, failed, or is inconclusive.',
  input_schema: {
    type: 'object' as const,
    properties: {
      outcome: {
        type: 'string',
        enum: ['pass', 'fail', 'inconclusive'],
        description: 'The test outcome',
      },
      reasoning: {
        type: 'string',
        description: 'Explanation of why this verdict was chosen, referencing specific page elements',
      },
    },
    required: ['outcome', 'reasoning'],
  },
};

export const judgeAgent = {
  name: 'judge',
  version: '0.1.0',

  async run(
    input: JudgeInput,
    ctx: AgentContext,
  ): Promise<AgentResult<Verdict>> {
    const start = Date.now();

    const response = await ctx.client.messages.create({
      model: ctx.model,
      system: JUDGE_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildJudgeMessage(input) }],
      tools: [VERDICT_TOOL],
      tool_choice: { type: 'tool', name: 'verdict' },
      max_tokens: 1024,
    });

    await ctx.trace.writeSidecar('judge.json', {
      response: response.content,
      usage: response.usage,
    });

    const toolUses = extractToolUseBlocks(response.content);
    if (toolUses.length === 0) {
      throw new AgentSchemaError('Judge did not call the verdict tool');
    }

    const parsed = verdictSchema.safeParse(toolUses[0].input);
    if (!parsed.success) {
      throw new AgentSchemaError(`Invalid judge verdict: ${parsed.error.message}`);
    }

    return {
      output: parsed.data,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
      durationMs: Date.now() - start,
    };
  },
};

function buildJudgeMessage(input: JudgeInput): string {
  const parts = [
    '## Test specification',
    `**Name:** ${input.spec.name}`,
    `**URL:** ${input.spec.url}`,
    '',
    '### Setup',
    input.spec.setup,
    '',
    '### Steps',
  ];

  input.spec.steps.forEach((step, i) => {
    const result = input.stepResults[i];
    const status = result ? ` [${result.status}${result.error ? ': ' + result.error : ''}]` : '';
    parts.push(`${i + 1}. ${step}${status}`);
  });

  parts.push('', '## Final page accessibility tree', input.finalAccessibilityTree);

  return parts.join('\n');
}
