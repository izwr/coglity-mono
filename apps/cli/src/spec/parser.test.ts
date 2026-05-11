import { describe, it, expect } from 'vitest';
import { parseSpec, parseSpecContent } from './parser';
import { SpecParseError, SpecValidationError } from '../agents/shared/errors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const examplePath = path.resolve(__dirname, '../../examples/checkout.spec.md');

describe('parseSpec (file-based)', () => {
  it('parses examples/checkout.spec.md', async () => {
    const spec = await parseSpec(examplePath);

    expect(spec.name).toBe('Guest checkout flow');
    expect(spec.url).toBe('https://demo.playwright.dev/todomvc');
    expect(spec.viewport).toEqual({ width: 1280, height: 720 });
    expect(spec.timeout).toBe(30000);
    expect(spec.auth).toBeUndefined();
    expect(spec.filePath).toBe(examplePath);

    expect(spec.setup).toContain('TodoMVC application');
    expect(spec.steps).toHaveLength(6);
    expect(spec.steps[0]).toMatch(/Navigate to the app/);
    expect(spec.steps[5]).toMatch(/Filter to show all items/);
  });
});

describe('parseSpecContent', () => {
  const validSpec = `---
name: Test spec
url: https://example.com
---

# Setup

A simple web page.

# Steps

1. Go to the homepage
2. Click the login button
3. Verify the dashboard loads
`;

  it('parses minimal valid spec with default viewport and timeout', () => {
    const spec = parseSpecContent(validSpec, 'test.spec.md');

    expect(spec.name).toBe('Test spec');
    expect(spec.url).toBe('https://example.com');
    expect(spec.viewport).toEqual({ width: 1280, height: 720 });
    expect(spec.timeout).toBe(30000);
    expect(spec.setup).toBe('A simple web page.');
    expect(spec.steps).toEqual([
      'Go to the homepage',
      'Click the login button',
      'Verify the dashboard loads',
    ]);
    expect(spec.filePath).toBe('test.spec.md');
  });

  it('parses custom viewport and auth', () => {
    const raw = `---
name: Mobile test
url: https://m.example.com
viewport:
  width: 375
  height: 812
auth: .coglity/auth/session.json
timeout: 15000
---

# Setup

Mobile site.

# Steps

1. Open the menu
`;
    const spec = parseSpecContent(raw, 'mobile.spec.md');

    expect(spec.viewport).toEqual({ width: 375, height: 812 });
    expect(spec.auth).toBe('.coglity/auth/session.json');
    expect(spec.timeout).toBe(15000);
  });

  it('handles multi-paragraph setup', () => {
    const raw = `---
name: Multi setup
url: https://example.com
---

# Setup

First paragraph of context.

Second paragraph with more detail.

# Steps

1. Do something
`;
    const spec = parseSpecContent(raw, 'multi.spec.md');
    expect(spec.setup).toContain('First paragraph');
    expect(spec.setup).toContain('Second paragraph');
  });

  // ── Error cases ──

  it('throws SpecValidationError on missing name', () => {
    const raw = `---
url: https://example.com
---

# Setup

Context.

# Steps

1. Step one
`;
    expect(() => parseSpecContent(raw, 'bad.md')).toThrow(SpecValidationError);
  });

  it('throws SpecValidationError on missing url', () => {
    const raw = `---
name: No URL
---

# Setup

Context.

# Steps

1. Step one
`;
    expect(() => parseSpecContent(raw, 'bad.md')).toThrow(SpecValidationError);
  });

  it('throws SpecValidationError on invalid url', () => {
    const raw = `---
name: Bad URL
url: not-a-url
---

# Setup

Context.

# Steps

1. Step one
`;
    expect(() => parseSpecContent(raw, 'bad.md')).toThrow(SpecValidationError);
  });

  it('throws SpecValidationError on invalid viewport', () => {
    const raw = `---
name: Bad viewport
url: https://example.com
viewport:
  width: -100
  height: 720
---

# Setup

Context.

# Steps

1. Step one
`;
    expect(() => parseSpecContent(raw, 'bad.md')).toThrow(SpecValidationError);
  });

  it('throws SpecParseError on missing Setup section', () => {
    const raw = `---
name: No setup
url: https://example.com
---

# Steps

1. Step one
`;
    expect(() => parseSpecContent(raw, 'bad.md')).toThrow(SpecParseError);
  });

  it('throws SpecParseError on missing Steps section', () => {
    const raw = `---
name: No steps
url: https://example.com
---

# Setup

Context.
`;
    expect(() => parseSpecContent(raw, 'bad.md')).toThrow(SpecParseError);
  });

  it('throws SpecParseError on empty Steps list', () => {
    const raw = `---
name: Empty steps
url: https://example.com
---

# Setup

Context.

# Steps

No numbered items here, just a paragraph.
`;
    expect(() => parseSpecContent(raw, 'bad.md')).toThrow(SpecParseError);
  });

  it('ignores unknown frontmatter fields', () => {
    const raw = `---
name: Extra fields
url: https://example.com
customField: whatever
---

# Setup

Context.

# Steps

1. Step one
`;
    const spec = parseSpecContent(raw, 'extra.md');
    expect(spec.name).toBe('Extra fields');
  });

  it('ignores extra markdown sections', () => {
    const raw = `---
name: Extra sections
url: https://example.com
---

# Setup

Context.

# Steps

1. Step one
2. Step two

# Notes

These notes should be ignored.
`;
    const spec = parseSpecContent(raw, 'extra.md');
    expect(spec.steps).toHaveLength(2);
  });
});
