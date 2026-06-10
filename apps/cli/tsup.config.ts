import { defineConfig } from 'tsup';

// Both entries are bin targets and must land at distinct paths. Using array entries makes
// tsup name each output by basename, so `src/index.ts` and `src/mcp/index.ts` BOTH emit
// `dist/index.js` — the second clobbers the first and `dist/mcp/index.js` (the coglity-mcp
// bin) is never produced. Object entries pin the output path explicitly.
//
// No `banner` shebang: each source entry already starts with `#!/usr/bin/env node`, which
// esbuild preserves. Adding a banner on top produced a doubled shebang and a SyntaxError.
const external = [
  'playwright',
  'playwright-core',
  'playwright-core/lib/server',
  '@anthropic-ai/sdk',
  '@modelcontextprotocol/sdk',
  'ink',
  'ink-spinner',
  'react',
  'clipanion',
];

export default defineConfig([
  {
    entry: { index: 'src/index.ts' },
    format: ['esm'],
    target: 'node22',
    splitting: false,
    clean: true,
    minify: true,
    external,
  },
  {
    entry: { 'mcp/index': 'src/mcp/index.ts' },
    format: ['esm'],
    target: 'node22',
    splitting: false,
    clean: false,
    minify: true,
    external,
  },
]);
