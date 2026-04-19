/**
 * In-app Hermes bridge forwarder: Virgil → OpenClaw Gateway.
 *
 * Implements the same forwarding contract as the legacy
 * `scripts/hermes-local-bridge.ts` stand-alone server, but as reusable
 * functions invoked by route handlers under `app/api/hermes-bridge/*`.
 *
 * When `OPENCLAW_HTTP_URL` is set and the execute path is the Gateway's
 * `/tools/invoke`, we map a Virgil ClawIntent to the Gateway's
 * `{ tool, args, sessionKey }` body, attach a Bearer token, and translate the
 * response into the Hermes-client-shaped JSON Virgil expects.
 */

import {
  fetchOpenClawWithTimeout,
  listOpenClawSkills,
  pingOpenClaw,
} from "@/lib/integrations/openclaw-client";
import {
  getOpenClawExecutePath,
  getOpenClawHttpOrigin,
} from "@/lib/integrations/openclaw-config";
import type { ClawIntent } from "@/lib/integrations/openclaw-types";

const EXECUTE_TIMEOUT_MS = 120_000;

export type HermesBridgeHealth = {
  ok: true;
  service: "hermes-bridge";
  mode: "in-app";
  openClawConfigured: boolean;
  openClawReachable: boolean | null;
  timestamp: string;
};

/** Shared-secret Bearer for the OpenClaw Gateway (token or password auth mode). */
function openClawBearerSecret(): string {
  return (
    process.env.OPENCLAW_GATEWAY_TOKEN?.trim() ||
    process.env.OPENCLAW_GATEWAY_PASSWORD?.trim() ||
    ""
  );
}

function openClawAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = { Accept: "application/json" };
  const bearer = openClawBearerSecret();
  if (bearer) {
    headers.Authorization = `Bearer ${bearer}`;
  }
  return headers;
}

/** The "generic" OpenClaw tool name used when a Virgil skill has no matching tool. */
function openClawDefaultTool(): string {
  return process.env.OPENCLAW_GENERIC_TASK_TOOL?.trim() || "web";
}

function usesOpenClawToolsInvoke(): boolean {
  if (process.env.OPENCLAW_GATEWAY_TOOLS_INVOKE === "1") {
    return true;
  }
  return getOpenClawExecutePath().toLowerCase().includes("tools/invoke");
}

/**
 * Single-tool mode (default when talking to the OpenClaw Gateway) maps every
 * Virgil delegation to one OpenClaw tool and passes the original skill inside
 * `args.virgilSkill`. Set `OPENCLAW_SINGLE_TOOL_MODE=0` to send skill ids as
 * OpenClaw tool names one-to-one (legacy mode).
 */
function openClawSingleToolMode(): boolean {
  if (!usesOpenClawToolsInvoke()) {
    return false;
  }
  const raw = process.env.OPENCLAW_SINGLE_TOOL_MODE?.trim().toLowerCase();
  if (raw === "0" || raw === "false" || raw === "off") {
    return false;
  }
  return true;
}

function openClawToolNameForIntent(intent: ClawIntent): string {
  if (openClawSingleToolMode()) {
    return openClawDefaultTool();
  }
  const trimmed = intent.skill.trim();
  if (trimmed === "generic-task") {
    return openClawDefaultTool();
  }
  return trimmed;
}

function openClawGatewayArgs(intent: ClawIntent): Record<string, unknown> {
  if (openClawSingleToolMode()) {
    return {
      ...intent.params,
      virgilSkill: intent.skill,
      virgilSource: intent.source,
      virgilPriority: intent.priority,
    };
  }
  return intent.params;
}

function formatGatewayResultPayload(raw: string): string {
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

export function parseBridgeIntent(body: unknown): ClawIntent | null {
  if (!body || typeof body !== "object") {
    return null;
  }
  const o = body as Record<string, unknown>;
  const skill = o.skill;
  const params = o.params;
  const priority = o.priority ?? "normal";
  const source = o.source ?? "chat";
  const requiresConfirmation = o.requiresConfirmation ?? false;
  if (typeof skill !== "string" || skill.length === 0) {
    return null;
  }
  if (typeof params !== "object" || params === null || Array.isArray(params)) {
    return null;
  }
  if (priority !== "low" && priority !== "normal" && priority !== "high") {
    return null;
  }
  if (typeof source !== "string") {
    return null;
  }
  if (typeof requiresConfirmation !== "boolean") {
    return null;
  }
  return {
    skill,
    params: params as Record<string, unknown>,
    priority,
    source,
    requiresConfirmation,
  };
}

export async function bridgeHealth(): Promise<HermesBridgeHealth> {
  const origin = getOpenClawHttpOrigin();
  const reachable = origin ? await pingOpenClaw() : null;
  return {
    ok: true,
    service: "hermes-bridge",
    mode: "in-app",
    openClawConfigured: Boolean(origin),
    openClawReachable: reachable,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Lists skill ids to advertise. Merges whatever OpenClaw returns (if JSON) with
 * `generic-task` as a sentinel catch-all. HTML responses (e.g. the OpenClaw
 * Control UI at `/v1/skills`) are ignored.
 */
export async function bridgeSkills(): Promise<{ id: string; name: string }[]> {
  const origin = getOpenClawHttpOrigin();
  const fromOpenClaw = origin ? await listOpenClawSkillsViaGateway() : [];
  const merged = new Set<string>(["generic-task", ...fromOpenClaw]);
  return [...merged].sort().map((id) => ({ id, name: id }));
}

/** Gateway-aware OpenClaw skills fetch: sends Bearer, ignores HTML payloads. */
async function listOpenClawSkillsViaGateway(): Promise<string[]> {
  const origin = getOpenClawHttpOrigin();
  if (!origin) {
    return [];
  }
  const path = process.env.OPENCLAW_SKILLS_PATH?.trim() || "/api/skills";
  try {
    const res = await fetchOpenClawWithTimeout(
      `${origin}${path}`,
      { method: "GET", headers: openClawAuthHeaders() },
      8000
    );
    if (!res.ok) {
      return [];
    }
    const ct = res.headers.get("content-type") ?? "";
    if (ct.includes("text/html")) {
      return [];
    }
    const text = await res.text();
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      return [];
    }
    return parseSkillIdsLoose(data);
  } catch {
    // Fall back to the un-authenticated openclaw-client helper in case the
    // bare-metal path returns JSON without auth (unlikely but harmless).
    return listOpenClawSkills();
  }
}

function parseSkillIdsLoose(payload: unknown): string[] {
  const out = new Set<string>();
  const add = (s: string | null) => {
    if (s) {
      out.add(s);
    }
  };
  const walk = (value: unknown) => {
    if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === "string") {
          add(item.trim() || null);
        } else if (item && typeof item === "object") {
          const o = item as { id?: unknown; name?: unknown; slug?: unknown };
          for (const v of [o.id, o.name, o.slug]) {
            if (typeof v === "string" && v.trim()) {
              add(v.trim());
              break;
            }
          }
        }
      }
    } else if (value && typeof value === "object" && "skills" in value) {
      walk((value as { skills: unknown }).skills);
    }
  };
  walk(payload);
  return [...out];
}

export type BridgeExecuteOutcome = {
  status: number;
  body: {
    success: boolean;
    output?: string;
    error?: string;
    skill: string;
    openClawTool?: string;
  };
};

export async function bridgeExecute(
  intent: ClawIntent
): Promise<BridgeExecuteOutcome> {
  const origin = getOpenClawHttpOrigin();
  if (!origin) {
    return {
      status: 503,
      body: {
        success: false,
        error:
          "OPENCLAW_HTTP_URL is not set; configure it to forward delegations.",
        skill: intent.skill,
      },
    };
  }

  const gatewayMode = usesOpenClawToolsInvoke();
  const toolName = gatewayMode
    ? openClawToolNameForIntent(intent)
    : intent.skill;
  const bodyJson = gatewayMode
    ? JSON.stringify({
        tool: toolName,
        args: openClawGatewayArgs(intent),
        sessionKey: "main",
      })
    : JSON.stringify(intent);

  try {
    const res = await fetchOpenClawWithTimeout(
      `${origin}${getOpenClawExecutePath()}`,
      {
        method: "POST",
        headers: {
          ...openClawAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: bodyJson,
      },
      EXECUTE_TIMEOUT_MS
    );
    const text = await res.text();
    if (gatewayMode) {
      if (res.ok) {
        return {
          status: 200,
          body: {
            success: true,
            output: formatGatewayResultPayload(text),
            skill: intent.skill,
            openClawTool: toolName,
          },
        };
      }
      return {
        status: res.status,
        body: {
          success: false,
          error:
            formatGatewayResultPayload(text) || `HTTP ${String(res.status)}`,
          skill: intent.skill,
          openClawTool: toolName,
        },
      };
    }
    // Legacy: pass through body/status from OpenClaw's own /api/execute.
    if (!res.ok) {
      return {
        status: res.status,
        body: {
          success: false,
          error: text || `HTTP ${String(res.status)}`,
          skill: intent.skill,
        },
      };
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { success: true, output: text };
    }
    const obj =
      parsed && typeof parsed === "object"
        ? (parsed as Record<string, unknown>)
        : {};
    return {
      status: 200,
      body: {
        success: obj.success !== false,
        output: typeof obj.output === "string" ? obj.output : text,
        skill: intent.skill,
      },
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "forward failed";
    return {
      status: 502,
      body: { success: false, error: msg, skill: intent.skill },
    };
  }
}

/** Dev-only flag: when the bridge receives a bearer, it matches this secret. */
export function isBridgeRequestAuthorized(request: Request): boolean {
  const shared = process.env.HERMES_SHARED_SECRET?.trim();
  if (!shared) {
    return true;
  }
  return request.headers.get("authorization") === `Bearer ${shared}`;
}
