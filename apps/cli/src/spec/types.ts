export interface Viewport {
  width: number;
  height: number;
}

export interface ParsedSpec {
  name: string;
  url: string;
  viewport: Viewport;
  auth?: string;
  timeout: number;
  setup: string;
  steps: string[];
  filePath: string;
  rawContent: string;
}
