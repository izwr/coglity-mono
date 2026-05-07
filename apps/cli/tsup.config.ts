import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: ['src/index.ts'],
    format: ['esm'],
    target: 'node22',
    splitting: false,
    clean: true,
    minify: true,
    external: [
      'playwright',
      'playwright-core',
      'playwright-core/lib/server',
      '@anthropic-ai/sdk',
      '@modelcontextprotocol/sdk',
      'ink',
      'ink-spinner',
      'react',
      'clipanion',
    ],
    banner: {
      js: '#!/usr/bin/env node',
    },
  },
  {
    entry: ['src/mcp/index.ts'],
    format: ['esm'],
    target: 'node22',
    splitting: false,
    clean: false,
    minify: true,
    external: [
      'playwright',
      'playwright-core',
      'playwright-core/lib/server',
      '@anthropic-ai/sdk',
      '@modelcontextprotocol/sdk',
      'ink',
      'ink-spinner',
      'react',
      'clipanion',
    ],
  },
]);
