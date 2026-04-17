import type { DelegationBackend } from "@/lib/integrations/delegation-provider";
import { getDelegationProvider } from "@/lib/integrations/delegation-provider";

export function delegationBackendDisplayName(
  backend: DelegationBackend
): "Hermes" | "OpenClaw" {
  return backend === "hermes" ? "Hermes" : "OpenClaw";
}

/** Short phrase for system prompts (tool names stay delegateTask / approveOpenClawIntent). */
export function delegationBackendShortPhrase(
  backend: DelegationBackend
): string {
  return backend === "hermes"
    ? "the Hermes HTTP bridge"
    : "the OpenClaw gateway";
}

export function buildDelegateTaskToolDescription(): string {
  const backend = getDelegationProvider().backend;
  const name = delegationBackendDisplayName(backend);
  const phrase = delegationBackendShortPhrase(backend);
  return (
    `Send a task to ${phrase} for execution (${name}). Use when the task involves messaging someone, running a shell command, file operations, or other actions Virgil cannot perform in-process. ` +
    "Specify the skill name if known; otherwise describe the task and the best-matching skill is chosen from the live skill list when available (keyword overlap). " +
    "Destructive or outbound actions may require owner confirmation before sending."
  );
}

export function buildApproveDelegationIntentToolDescription(): string {
  const backend = getDelegationProvider().backend;
  const name = delegationBackendDisplayName(backend);
  const phrase = delegationBackendShortPhrase(backend);
  return `Approve a queued delegation intent that required confirmation, then send it to ${phrase}. Use when the owner has agreed to the action. Backend: ${name}.`;
}

export function delegationUnreachableMessage(
  backend: DelegationBackend,
  backlog: number
): string {
  const name = delegationBackendDisplayName(backend);
  return (
    `${name} is unreachable. Intent queued (${String(backlog)} task(s) waiting). ` +
    "Approve in the app when the delegation backend is back, or retry later."
  );
}

export function delegationUnknownSkillMessage(
  backend: DelegationBackend,
  skillTrimmed: string,
  sample: string,
  suffix: string
): string {
  const name = delegationBackendDisplayName(backend);
  return (
    `No ${name} skill named "${skillTrimmed}". Available: ${sample}${suffix}. ` +
    "Omit `skill` so one can be inferred from the description, or use an id from that list."
  );
}
