import type Anthropic from '@anthropic-ai/sdk';
import type { AgentContext, AgentResult } from '../shared/types';
import type { PlaywrightAction } from '../../runner/events';
import { PLANNER_TOOLS } from './tools';
import { PLANNER_SYSTEM_PROMPT } from './prompt';
import { extractToolUseBlocks } from '../shared/tools';
import { AgentSchemaError, AgentRefusalError, UnknownToolError } from '../shared/errors';
import { MAX_ACTIONS_PER_STEP } from '../../lib/config';

export interface PlannerInput {
  step: string;
  stepIndex: number;
  setup: string;
  previousSteps: string[];
  accessibilityTree: string;
}

export interface PlannerCallbacks {
  onThinking: () => void;
  onAction: (action: PlaywrightAction) => void;
  executeAction: (action: PlaywrightAction) => Promise<string>;
  takeSnapshot: () => Promise<string>;
}

export interface PlannerOutput {
  actions: PlaywrightAction[];
  summary: string;
}

export const plannerAgent = {
  name: 'planner',
  version: '0.1.0',

  async run(
    input: PlannerInput,
    callbacks: PlannerCallbacks,
    ctx: AgentContext,
  ): Promise<AgentResult<PlannerOutput>> {
    const start = Date.now();
    const actions: PlaywrightAction[] = [];
    let totalInput = 0;
    let totalOutput = 0;
    let summary = '';

    const messages: Anthropic.MessageParam[] = [
      { role: 'user', content: buildUserMessage(input) },
    ];

    for (let turn = 0; turn < MAX_ACTIONS_PER_STEP; turn++) {
      callbacks.onThinking();

      const response = await ctx.client.messages.create({
        model: ctx.model,
        system: PLANNER_SYSTEM_PROMPT,
        messages,
        tools: PLANNER_TOOLS,
        max_tokens: 2048,
      });

      totalInput += response.usage.input_tokens;
      totalOutput += response.usage.output_tokens;

      await ctx.trace.writeSidecar(
        `planner-step${input.stepIndex}-turn${turn}.json`,
        { request: messages.slice(-2), response: response.content, usage: response.usage },
      );

      const toolUses = extractToolUseBlocks(response.content);

      if (toolUses.length === 0 || response.stop_reason === 'end_turn') {
        break;
      }

      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const block of toolUses) {
        if (block.name === 'done') {
          summary = (block.input as { summary?: string }).summary ?? '';
          return {
            output: { actions, summary },
            usage: { inputTokens: totalInput, outputTokens: totalOutput },
            durationMs: Date.now() - start,
          };
        }

        const action = parseToolUseToAction(block);
        callbacks.onAction(action);
        actions.push(action);

        const result = await callbacks.executeAction(action);
        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: result,
        });
      }

      messages.push({ role: 'assistant', content: response.content });

      const newTree = await callbacks.takeSnapshot();
      const userContent: Anthropic.ContentBlockParam[] = [
        ...toolResults,
        { type: 'text', text: `Updated accessibility tree:\n${newTree}` },
      ];
      messages.push({ role: 'user', content: userContent });
    }

    return {
      output: { actions, summary },
      usage: { inputTokens: totalInput, outputTokens: totalOutput },
      durationMs: Date.now() - start,
    };
  },
};

function buildUserMessage(input: PlannerInput): string {
  const parts = [
    `## Test step ${input.stepIndex + 1}`,
    input.step,
    '',
    '## Setup context',
    input.setup,
  ];

  if (input.previousSteps.length > 0) {
    parts.push('', '## Previously completed steps');
    input.previousSteps.forEach((s, i) => parts.push(`${i + 1}. ${s}`));
  }

  parts.push('', '## Current page accessibility tree', input.accessibilityTree);

  return parts.join('\n');
}

function parseToolUseToAction(block: Anthropic.ToolUseBlock): PlaywrightAction {
  const input = block.input as Record<string, unknown>;

  switch (block.name) {
    case 'click':
      return { tool: 'click', selector: String(input.selector) };
    case 'fill':
      return { tool: 'fill', selector: String(input.selector), value: String(input.value) };
    case 'goto':
      return { tool: 'goto', url: String(input.url) };
    case 'press':
      return { tool: 'press', key: String(input.key) };
    case 'select':
      return { tool: 'select', selector: String(input.selector), value: String(input.value) };
    case 'wait_for':
      return {
        tool: 'wait_for',
        selector: String(input.selector),
        state: (input.state as PlaywrightAction & { tool: 'wait_for' })['state'],
      };
    default:
      throw new UnknownToolError(`Planner called unknown tool: ${block.name}`);
  }
}
