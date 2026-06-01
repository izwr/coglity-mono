import type Anthropic from '@anthropic-ai/sdk';

export const PLANNER_TOOLS: Anthropic.Tool[] = [
  {
    name: 'click',
    description:
      'Click on an element. Use Playwright locator syntax based on the accessibility tree (e.g. role=button[name="Submit"], role=link[name="Home"]).',
    input_schema: {
      type: 'object' as const,
      properties: {
        selector: { type: 'string', description: 'Playwright locator string' },
      },
      required: ['selector'],
    },
  },
  {
    name: 'fill',
    description: 'Clear and type text into an input field.',
    input_schema: {
      type: 'object' as const,
      properties: {
        selector: { type: 'string', description: 'Playwright locator for the input' },
        value: { type: 'string', description: 'Text to type' },
      },
      required: ['selector', 'value'],
    },
  },
  {
    name: 'goto',
    description: 'Navigate the browser to a URL.',
    input_schema: {
      type: 'object' as const,
      properties: {
        url: { type: 'string', description: 'URL to navigate to' },
      },
      required: ['url'],
    },
  },
  {
    name: 'press',
    description: 'Press a keyboard key (e.g. Enter, Tab, Escape).',
    input_schema: {
      type: 'object' as const,
      properties: {
        key: { type: 'string', description: 'Key name' },
      },
      required: ['key'],
    },
  },
  {
    name: 'select',
    description: 'Select an option from a <select> dropdown.',
    input_schema: {
      type: 'object' as const,
      properties: {
        selector: { type: 'string', description: 'Playwright locator for the select' },
        value: { type: 'string', description: 'Option value to select' },
      },
      required: ['selector', 'value'],
    },
  },
  {
    name: 'wait_for',
    description: 'Wait for an element to reach a given state.',
    input_schema: {
      type: 'object' as const,
      properties: {
        selector: { type: 'string', description: 'Playwright locator for the element' },
        state: {
          type: 'string',
          enum: ['visible', 'hidden', 'attached', 'detached'],
          description: 'Target state (default: visible)',
        },
      },
      required: ['selector'],
    },
  },
  {
    name: 'done',
    description:
      'Signal that the current test step has been completed. Call this once you believe the step goal is achieved.',
    input_schema: {
      type: 'object' as const,
      properties: {
        summary: { type: 'string', description: 'Brief summary of what was done' },
      },
      required: ['summary'],
    },
  },
];
