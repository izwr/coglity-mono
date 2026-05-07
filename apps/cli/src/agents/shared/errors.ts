export abstract class CoglityError extends Error {
  abstract readonly code: string;
  abstract readonly retryable: boolean;

  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = this.constructor.name;
  }
}

// ── Agent-layer errors ──

export class AgentSchemaError extends CoglityError {
  readonly code = 'AGENT_SCHEMA';
  readonly retryable = true;
}

export class AgentRefusalError extends CoglityError {
  readonly code = 'AGENT_REFUSAL';
  readonly retryable = false;
}

export class AgentApiError extends CoglityError {
  readonly code = 'AGENT_API';
  readonly retryable: boolean;

  constructor(message: string, retryable: boolean, options?: ErrorOptions) {
    super(message, options);
    this.retryable = retryable;
  }
}

export class UnknownToolError extends CoglityError {
  readonly code = 'UNKNOWN_TOOL';
  readonly retryable = false;
}

// ── Runner-layer errors ──

export class ElementNotFoundError extends CoglityError {
  readonly code = 'ELEMENT_NOT_FOUND';
  readonly retryable = true;
}

export class StepTimeoutError extends CoglityError {
  readonly code = 'STEP_TIMEOUT';
  readonly retryable = false;
}

export class NavigationError extends CoglityError {
  readonly code = 'NAVIGATION';
  readonly retryable = true;
}

// ── User-input errors ──

export class SpecParseError extends CoglityError {
  readonly code = 'SPEC_PARSE';
  readonly retryable = false;
}

export class SpecValidationError extends CoglityError {
  readonly code = 'SPEC_VALIDATION';
  readonly retryable = false;
}

export class AuthStateError extends CoglityError {
  readonly code = 'AUTH_STATE';
  readonly retryable = false;
}

// ── Helpers ──

export function isRetryable(err: unknown): boolean {
  return err instanceof CoglityError && err.retryable;
}
