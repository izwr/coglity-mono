import { Command, Option } from 'clipanion';
import fs from 'node:fs/promises';
import path from 'node:path';

const STOP_HOOK_PROMPT = [
  'You must respond with ONLY a JSON object, no other text.',
  '',
  'Evaluate if the work just completed involves UI, API, or app logic changes that need testing.',
  'Context: $ARGUMENTS',
  '',
  'If the changes touch UI, API, or app logic, respond exactly:',
  '{"ok": false, "reason": "Run Coglity tests before finishing: `npx coglity test`"}',
  '',
  'If the changes are trivial (docs, comments, config, reading files), respond exactly:',
  '{"ok": true}',
].join('\\n');

export class SetupClaudeCommand extends Command {
  static override paths = [['setup', 'claude']];

  static override usage = Command.Usage({
    description: 'Register the Coglity MCP server and stop hook in Claude Code settings',
    examples: [
      ['Add MCP server + stop hook to project', 'coglity setup claude'],
      ['Add to global Claude settings', 'coglity setup claude --global'],
    ],
  });

  global = Option.Boolean('--global', false, {
    description: 'Write to ~/.claude/settings.json instead of project .claude/settings.json',
  });

  async execute() {
    const mcpEntryPath = resolveMcpEntry();
    const settingsPath = this.global
      ? path.join(process.env.HOME ?? '~', '.claude', 'settings.json')
      : path.join(process.cwd(), '.claude', 'settings.json');

    const settings = await readJsonFile(settingsPath);

    // ── MCP server ──
    const mcpServers = (settings.mcpServers ?? {}) as Record<string, Record<string, unknown>>;
    mcpServers.coglity = {
      command: 'node',
      args: [mcpEntryPath],
    };
    settings.mcpServers = mcpServers;

    // ── Stop hook (prompt-based) ──
    const hooks = (settings.hooks ?? {}) as Record<string, unknown[]>;
    hooks.Stop = [
      {
        hooks: [
          {
            type: 'prompt',
            prompt: STOP_HOOK_PROMPT,
            timeout: 30,
          },
        ],
      },
    ];
    settings.hooks = hooks;

    await fs.mkdir(path.dirname(settingsPath), { recursive: true });
    await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2) + '\n');

    this.context.stdout.write(`Coglity configured in ${settingsPath}\n\n`);
    this.context.stdout.write(`  MCP server: ${mcpEntryPath}\n`);
    this.context.stdout.write(`  Tools:      run_web_test, dry_run, list_runs, get_run_result\n\n`);
    this.context.stdout.write(`  Stop hook:  prompt-based (evaluates if changes need testing)\n`);
    this.context.stdout.write(`              Trivial changes (docs, comments, config) pass through.\n`);
    this.context.stdout.write(`              UI/API/logic changes trigger a test suggestion.\n\n`);
    this.context.stdout.write(`Restart Claude Code to pick up the changes.\n`);
  }
}

function resolveMcpEntry(): string {
  const distDir = path.dirname(process.argv[1] ?? '');
  return path.resolve(distDir, 'mcp', 'index.js');
}

async function readJsonFile(filePath: string): Promise<Record<string, unknown>> {
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}
