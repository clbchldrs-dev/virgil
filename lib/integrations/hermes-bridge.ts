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
  getOpenClawStaticSkillNames,
  mergeOpenClawSkillNameLists,
} from "@/lib/integrations/openclaw-config";
import {
  buildOpenClawGatewayInvokeBody,
  formatOpenClawGatewayResultPayload,
  isOpenClawGatewayExecutePath,
  openClawGatewayAuthHeaders,
  openClawGatewayToolNameForIntent,
} from "@/lib/integrations/openclaw-gateway";
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
      { method: "GET", headers: openClawGatewayAuthHeaders() },
      8000
    );
    if (!res.ok) {
      return getOpenClawStaticSkillNames();
    }
    const ct = res.headers.get("content-type") ?? "";
    if (ct.includes("text/html")) {
      return getOpenClawStaticSkillNames();
    }
    const text = await res.text();
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      return getOpenClawStaticSkillNames();
    }
    return mergeOpenClawSkillNameLists(
      parseSkillIdsLoose(data),
      getOpenClawStaticSkillNames()
    );
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

function formatToolList(tools: string[]): string {
  if (tools.length === 0) {
    return "(none)";
  }
  return tools.slice(0, 12).join(", ");
}

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

  const gatewayMode = isOpenClawGatewayExecutePath();
  const toolName = gatewayMode
    ? openClawGatewayToolNameForIntent(intent)
    : intent.skill;
  const bodyJson = gatewayMode
    ? buildOpenClawGatewayInvokeBody(intent)
    : JSON.stringify(intent);

  if (gatewayMode) {
    const advertisedTools = await listOpenClawSkillsViaGateway();
    if (advertisedTools.length === 0) {
      return {
        status: 503,
        body: {
          success: false,
          error:
            "No OpenClaw tools are advertised for /tools/invoke. Set OPENCLAW_SKILLS_STATIC to the invokable tool ids (and set OPENCLAW_GENERIC_TASK_TOOL to one of them for generic-task).",
          skill: intent.skill,
          openClawTool: toolName,
        },
      };
    }
    if (!advertisedTools.includes(toolName)) {
      return {
        status: 503,
        body: {
          success: false,
          error:
            `Mapped tool "${toolName}" is not advertised by OpenClaw for /tools/invoke. ` +
            `Advertised tools: ${formatToolList(advertisedTools)}. ` +
            "Set OPENCLAW_GENERIC_TASK_TOOL or OPENCLAW_SKILLS_STATIC to a compatible tool id.",
          skill: intent.skill,
          openClawTool: toolName,
        },
      };
    }
  }

  try {
    const res = await fetchOpenClawWithTimeout(
      `${origin}${getOpenClawExecutePath()}`,
      {
        method: "POST",
        headers: {
          ...openClawGatewayAuthHeaders(),
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
            output: formatOpenClawGatewayResultPayload(text),
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
            formatOpenClawGatewayResultPayload(text) ||
            `HTTP ${String(res.status)}`,
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
