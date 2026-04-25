// Dot-path helpers so we can honour bot_connection.config.inputAudioField / outputAudioField.
// Supports simple paths like "media.payload" or "data.audio.chunk".

export function getAtPath(obj: unknown, path: string): unknown {
  if (!path) return obj;
  const parts = path.split(".");
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur && typeof cur === "object" && p in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[p];
    } else {
      return undefined;
    }
  }
  return cur;
}

export function setAtPath(target: Record<string, unknown>, path: string, value: unknown): void {
  if (!path) return;
  const parts = path.split(".");
  let cur: Record<string, unknown> = target;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    const next = cur[key];
    if (!next || typeof next !== "object") {
      cur[key] = {};
    }
    cur = cur[key] as Record<string, unknown>;
  }
  cur[parts[parts.length - 1]] = value;
}

// Clone template and set audio payload. Template is optional; if absent, wrap as { <path>: audio }.
export function buildOutgoingFrame(
  templateJson: string | undefined,
  path: string,
  audioBase64: string,
): unknown {
  let frame: Record<string, unknown>;
  if (templateJson && templateJson.trim()) {
    try {
      frame = JSON.parse(templateJson) as Record<string, unknown>;
    } catch {
      frame = {};
    }
  } else {
    frame = {};
  }
  setAtPath(frame, path || "audio", audioBase64);
  return frame;
}
