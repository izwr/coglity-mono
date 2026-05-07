import Anthropic from '@anthropic-ai/sdk';

let instance: Anthropic | null = null;

export function getClient(): Anthropic {
  if (!instance) {
    instance = new Anthropic();
  }
  return instance;
}
