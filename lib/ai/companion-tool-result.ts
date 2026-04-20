/**
 * Normalized failure payloads for in-process companion tools (hosted chat path).
 * Matches the additive pattern used by delegation tools: stable **error** / **errorCode**
 * plus **retryable** and a human **message** (optional **hint** for operators).
 */
export type CompanionToolFailure = {
  ok: false;
  /** Short category for routing (snake_case). */
  error: string;
  /** Stable machine-readable code; safe to branch on in prompts or clients. */
  errorCode: string;
  retryable: boolean;
  /** User- and model-facing explanation. */
  message: string;
  /** Optional operator hint (env, config). */
  hint?: string;
};

export function companionToolFailure(args: {
  error: string;
  errorCode: string;
  retryable: boolean;
  message: string;
  hint?: string;
}): CompanionToolFailure {
  return {
    ok: false,
    error: args.error,
    errorCode: args.errorCode,
    retryable: args.retryable,
    message: args.message,
    ...(args.hint ? { hint: args.hint } : {}),
  };
}
