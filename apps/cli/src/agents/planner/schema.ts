import { z } from 'zod';

export const clickInputSchema = z.object({
  selector: z
    .string()
    .describe(
      'Playwright locator string for the element (e.g. role=button[name="Submit"], text=Click me)',
    ),
});

export const fillInputSchema = z.object({
  selector: z.string().describe('Playwright locator for the input element'),
  value: z.string().describe('Text to type into the input'),
});

export const gotoInputSchema = z.object({
  url: z.string().url().describe('URL to navigate to'),
});

export const pressInputSchema = z.object({
  key: z.string().describe('Key to press (e.g. Enter, Tab, Escape, ArrowDown)'),
});

export const selectInputSchema = z.object({
  selector: z.string().describe('Playwright locator for the select element'),
  value: z.string().describe('Option value to select'),
});

export const waitForInputSchema = z.object({
  selector: z.string().describe('Playwright locator for the element to wait for'),
  state: z.enum(['visible', 'hidden', 'attached', 'detached']).default('visible'),
});

export const doneInputSchema = z.object({
  summary: z.string().describe('Brief summary of what was accomplished for this step'),
});
