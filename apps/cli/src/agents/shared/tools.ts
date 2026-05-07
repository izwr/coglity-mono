import type Anthropic from '@anthropic-ai/sdk';

export interface ToolDef {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export function toAnthropicTools(defs: ToolDef[]): Anthropic.Tool[] {
  return defs.map((d) => ({
    name: d.name,
    description: d.description,
    input_schema: d.inputSchema as Anthropic.Tool['input_schema'],
  }));
}

export function extractToolUseBlocks(
  content: Anthropic.ContentBlock[],
): Anthropic.ToolUseBlock[] {
  return content.filter(
    (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
  );
}

export function extractTextContent(content: Anthropic.ContentBlock[]): string {
  return content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('');
}
