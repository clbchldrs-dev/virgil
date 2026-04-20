/**
 * OpenClaw Gateway `POST /tools/invoke` — request shaping shared by the Hermes
 * bridge and direct OpenClaw delegation.
 */
import { usesOpenClawToolsInvokePath } from "@/lib/integrations/openclaw-config";
import type { ClawIntent } from "@/lib/integrations/openclaw-types";

export function openClawGatewayBearerSecret(): string {
  return (
    process.env.OPENCLAW_GATEWAY_TOKEN?.trim() ||
    process.env.OPENCLAW_GATEWAY_PASSWORD?.trim() ||
    ""
  );
}

export function openClawGatewayAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = { Accept: "application/json" };
  const bearer = openClawGatewayBearerSecret();
  if (bearer) {
    headers.Authorization = `Bearer ${bearer}`;
  }
  return headers;
}

/** Default OpenClaw tool when skill is `generic-task` or single-tool mode is on. */
export function openClawDefaultToolName(): string {
  return process.env.OPENCLAW_GENERIC_TASK_TOOL?.trim() || "web";
}

/**
 * When true, every delegation uses one OpenClaw tool (`OPENCLAW_GENERIC_TASK_TOOL`)
 * and passes the Virgil skill in `args.virgilSkill`.
 *
 * Default is **false** (direct mapping: Virgil `skill` → gateway `tool` name).
 * Set `OPENCLAW_SINGLE_TOOL_MODE=1` to bundle everything through one tool.
 */
export function openClawSingleToolModeEnabled(): boolean {
  if (!usesOpenClawToolsInvokePath()) {
    return false;
  }
  const raw = process.env.OPENCLAW_SINGLE_TOOL_MODE?.trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "on";
}

export function openClawGatewayToolNameForIntent(intent: ClawIntent): string {
  if (openClawSingleToolModeEnabled()) {
    return openClawDefaultToolName();
  }
  const trimmed = intent.skill.trim();
  if (trimmed === "generic-task") {
    return openClawDefaultToolName();
  }
  return trimmed;
}

export function openClawGatewayInvokeArgs(
  intent: ClawIntent
): Record<string, unknown> {
  if (openClawSingleToolModeEnabled()) {
    return {
      ...intent.params,
      virgilSkill: intent.skill,
      virgilSource: intent.source,
      virgilPriority: intent.priority,
    };
  }
  return intent.params;
}

export function buildOpenClawGatewayInvokeBody(intent: ClawIntent): string {
  return JSON.stringify({
    tool: openClawGatewayToolNameForIntent(intent),
    args: openClawGatewayInvokeArgs(intent),
    sessionKey: "main",
  });
}

export function formatOpenClawGatewayResultPayload(raw: string): string {
  try {
    const j: unknown = JSON.parse(raw);
    if (
      j &&
      typeof j === "object" &&
      "ok" in j &&
      (j as { ok?: unknown }).ok === true &&
      "result" in j
    ) {
      const r = (j as { result: unknown }).result;
      if (typeof r === "string") {
        return r;
      }
      return JSON.stringify(r, null, 2);
    }
    if (
      j &&
      typeof j === "object" &&
      "ok" in j &&
      (j as { ok?: unknown }).ok === false &&
      "error" in j
    ) {
      const err = (j as { error: unknown }).error;
      const msg =
        err && typeof err === "object" && err !== null && "message" in err
          ? String((err as { message: unknown }).message)
          : JSON.stringify(err);
      return msg;
    }
  } catch {
    /* fall through */
  }
  return raw;
}

/** True when execute path targets the Gateway invoke surface. */
export function isOpenClawGatewayExecutePath(): boolean {
  return usesOpenClawToolsInvokePath();
}
