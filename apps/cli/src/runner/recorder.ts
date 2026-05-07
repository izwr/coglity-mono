import fs from 'node:fs/promises';
import path from 'node:path';
import type { RunResult } from './events.js';
import type { ParsedSpec } from '../spec/types.js';

export async function finalizeRun(
  runDir: string,
  spec: ParsedSpec,
  result: RunResult,
): Promise<void> {
  const specContent = spec.rawContent;
  await fs.writeFile(path.join(runDir, 'spec.md'), specContent);
  await fs.writeFile(
    path.join(runDir, 'result.json'),
    JSON.stringify(result, null, 2),
  );
}
