/**
 * Model-facing instructions for interpreting structured **delegateTask** outcomes.
 * Keep in sync with `lib/ai/tools/delegate-to-openclaw.ts` and
 * `lib/integrations/delegation-errors.ts`.
 */
export function buildDelegationToolFailurePromptSnippet(): string {
  return `Delegation tool results (**delegateTask** and **embedViaDelegation**):
When a tool result includes structured fields, treat them as authoritative:
- **error** — stable category (e.g. \`delegation_preflight_failed\`, \`delegation_backend_offline\`, \`delegation_execution_failed\`).
- **reason** — sub-category (\`preflight_failed\`, \`backend_offline\`, \`execution_failed\`, etc.).
- **errorCode** — machine-readable detail when present (e.g. \`provided_skill_not_advertised\`, \`resolved_skill_not_advertised\`, \`embed_skill_not_advertised\`, \`primary_unreachable\`, \`tool_runtime_error\`).
- **retryable** — whether a *same-args* retry may help after a short wait.

How to respond:
- **retryable: true** — You may retry **once** after a brief pause if the user still wants the same action. If it fails again, stop retrying; explain plainly and point them at **This deployment** (\`/deployment\`) for bridge reachability and advertised skill ids.
- **error** \`delegation_backend_offline\` — Gateway unreachable or poll-queue mode; do not insist the task ran. Say it is queued or blocked until the bridge is back; offer non-delegated alternatives if any.
- **errorCode** \`provided_skill_not_advertised\` or \`resolved_skill_not_advertised\` — Do not retry with the same skill. Either omit **skill** so routing can infer one, or ask the user to pick a skill that appears in the deployment snapshot / appendix. Do not invent skill ids.
- **error** \`delegation_execution_failed\` with **retryable: false** — The bridge responded but rejected execution; summarize **message** (and **result.error** if present). Do not loop identical calls.
- **errorCode** \`embed_skill_not_advertised\` — For **embedViaDelegation**, do not retry with the same skill configuration; ask the operator to set \`VIRGIL_DELEGATION_EMBED_SKILL\` to an advertised skill id.
- **ok: true**, **queued: true**, with text about confirmation — Tell the user to approve in-app or call **approveDelegationIntent** (alias **approveOpenClawIntent**) with **intentId**; do not resend **delegateTask** for the same work.
- **errorCode** \`tool_runtime_error\` — Unexpected server-side failure; retry at most once, then stop and report without fabricating success.`;
}
