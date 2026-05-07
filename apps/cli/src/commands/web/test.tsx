import { Command, Option } from 'clipanion';
import { render } from 'ink';
import { parseSpec } from '../../spec/index.js';
import { runSpec } from '../../runner/index.js';
import { fakeRun } from '../../runner/fake.js';
import { App } from '../../ui/App.js';
import type { RunEvent, RunEventEmitter, PlaywrightAction, RunResult } from '../../runner/events.js';
import type { ParsedSpec } from '../../spec/types.js';
import type { RunOptions } from '../../runner/events.js';

type RunFn = (spec: ParsedSpec, opts: RunOptions, onEvent: RunEventEmitter) => Promise<RunResult>;

export class WebTestCommand extends Command {
  static override paths = [['web', 'test']];

  static override usage = Command.Usage({
    description: 'Run a web test spec against a live site',
    examples: [
      ['Run a spec', 'coglity web test checkout.spec.md'],
      ['Run headed with JSON output', 'coglity web test --headed --json checkout.spec.md'],
      ['Use a fake run for UI dev', 'coglity web test --fake checkout.spec.md'],
    ],
  });

  specFile = Option.String({ required: true, name: 'spec' });
  json = Option.Boolean('--json', false, { description: 'Output NDJSON to stdout' });
  headed = Option.Boolean('--headed', false, { description: 'Run browser in headed mode' });
  fake = Option.Boolean('--fake', false, { description: 'Use fake events (for UI development)' });
  plannerModel = Option.String('--planner-model', { description: 'Override planner model' });
  judgeModel = Option.String('--judge-model', { description: 'Override judge model' });

  async execute() {
    const spec = await parseSpec(this.specFile);

    const opts: RunOptions = {
      headed: this.headed,
      plannerModel: this.plannerModel,
      judgeModel: this.judgeModel,
    };

    const runner: RunFn = this.fake
      ? (_spec, _opts, onEvent) => fakeRun(onEvent)
      : runSpec;

    if (this.json) {
      await runner(spec, opts, (event) => {
        this.context.stdout.write(JSON.stringify(event) + '\n');
      });
    } else if (process.stdout.isTTY) {
      const instance = render(<App spec={spec} opts={opts} run={runner} />);
      await instance.waitUntilExit();
    } else {
      await runner(spec, opts, (event) => {
        this.context.stdout.write(formatPlainEvent(event) + '\n');
      });
    }
  }
}

function formatPlainEvent(event: RunEvent): string {
  switch (event.kind) {
    case 'run.start':
      return `> ${event.spec.name} (${event.runId})`;
    case 'step.start':
      return `  ${event.index + 1}. ${event.text}`;
    case 'step.thinking':
      return `     thinking...`;
    case 'step.action':
      return `     -> ${event.action.tool} ${formatActionArgs(event.action)}`;
    case 'step.snapshot':
      return `     screenshot: ${event.screenshot}`;
    case 'step.end':
      return `     ${event.status === 'ok' ? 'ok' : 'FAIL'} (${event.durationMs}ms)${event.error ? ' -- ' + event.error : ''}`;
    case 'judge.start':
      return `  Judging...`;
    case 'judge.end':
      return `  ${event.verdict.outcome.toUpperCase()}: ${event.verdict.reasoning}`;
    case 'run.end':
      return `Done in ${event.result.durationMs}ms -- ${event.result.verdict.outcome}`;
  }
}

function formatActionArgs(action: PlaywrightAction): string {
  switch (action.tool) {
    case 'click':
    case 'wait_for':
      return `"${action.selector}"`;
    case 'fill':
    case 'select':
      return `"${action.selector}" "${action.value}"`;
    case 'goto':
      return action.url;
    case 'press':
      return action.key;
  }
}
