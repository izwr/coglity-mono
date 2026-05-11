import type Anthropic from '@anthropic-ai/sdk';
import type { TraceWriter } from './trace';

export interface AgentContext {
  client: Anthropic;
  model: string;
  trace: TraceWriter;
  signal?: AbortSignal;
}

export interface AgentResult<O> {
  output: O;
  usage: { inputTokens: number; outputTokens: number };
  durationMs: number;
}

export interface Agent<Input, Output> {
  name: string;
  version: string;
  run(input: Input, ctx: AgentContext): Promise<AgentResult<Output>>;
}
