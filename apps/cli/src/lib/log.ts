const DEBUG = process.env.COGLITY_DEBUG === '1';

export function debug(msg: string): void {
  if (DEBUG) {
    process.stderr.write(`[coglity:debug] ${msg}\n`);
  }
}
