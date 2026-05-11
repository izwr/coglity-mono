#!/usr/bin/env node

import { Cli } from 'clipanion';
import { WebTestCommand } from './commands/web/test';
import { SetupClaudeCommand } from './commands/setup/claude';

const cli = new Cli({
  binaryLabel: 'coglity',
  binaryName: 'coglity',
  binaryVersion: '0.0.1',
});

cli.register(WebTestCommand);
cli.register(SetupClaudeCommand);
cli.runExit(process.argv.slice(2));
