import fs from 'node:fs/promises';
import path from 'node:path';

export function runDir(runId: string): string {
  return path.join('.coglity', 'runs', runId);
}

export async function ensureRunDir(runId: string): Promise<string> {
  const dir = runDir(runId);
  await fs.mkdir(path.join(dir, 'snapshots'), { recursive: true });
  await fs.mkdir(path.join(dir, 'llm'), { recursive: true });
  return dir;
}

export function generateRunId(): string {
  return new Date().toISOString().replace(/[:.]/g, '-');
}
