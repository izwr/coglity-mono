import fs from 'node:fs/promises';
import path from 'node:path';

export interface TraceEvent {
  kind: string;
  timestamp: string;
  [key: string]: unknown;
}

export interface TraceWriter {
  log(event: TraceEvent): void;
  writeSidecar(name: string, data: unknown): Promise<string>;
  flush(): Promise<void>;
}

export function createTraceWriter(runDir: string): TraceWriter {
  const buffer: string[] = [];
  const eventsPath = path.join(runDir, 'events.jsonl');

  return {
    log(event: TraceEvent) {
      buffer.push(
        JSON.stringify({ ...event, timestamp: event.timestamp || new Date().toISOString() }),
      );
    },

    async writeSidecar(name: string, data: unknown): Promise<string> {
      const filePath = path.join(runDir, 'llm', name);
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, JSON.stringify(data, null, 2));
      return filePath;
    },

    async flush() {
      if (buffer.length === 0) return;
      await fs.mkdir(path.dirname(eventsPath), { recursive: true });
      await fs.appendFile(eventsPath, buffer.join('\n') + '\n');
      buffer.length = 0;
    },
  };
}

export function createNoopTraceWriter(): TraceWriter {
  return {
    log() {},
    async writeSidecar(_name: string, _data: unknown) {
      return '';
    },
    async flush() {},
  };
}
