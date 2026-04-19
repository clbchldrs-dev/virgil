/**
 * Minimal Hermes HTTP bridge for local development (and optional poll-worker testing).
 *
 * Implements the contract Virgil expects: GET /health, GET /api/skills, POST /api/execute,
 * GET /api/pending (empty list). Optional Bearer auth via HERMES_SHARED_SECRET.
 *
 * When OPENCLAW_HTTP_URL is set, execute forwards the ClawIntent JSON to OpenClaw’s
 * execute path; skills merges OpenClaw’s catalog with a local `generic-task` entry.
 *
 * Run (separate terminal from `pnpm dev`):
 *   pnpm hermes:local-bridge
 *
 * Point Virgil at it: HERMES_HTTP_URL=http://127.0.0.1:8765, default HERMES_* paths,
 * VIRGIL_HERMES_BRIDGE_STUB_ENABLED=0. See .env.example (Hermes local bridge).
 */

import { createServer } from "node:http";
import { resolve } from "node:path";
import { config } from "dotenv";

config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

const PORT = Number.parseInt(
  process.env.HERMES_LOCAL_BRIDGE_PORT ?? "8765",
  10
);
const SHARED = process.env.HERMES_SHARED_SECRET?.trim() ?? "";

const OPENCLAW_ORIGIN = normalizeOrigin(
  process.env.OPENCLAW_HTTP_URL?.trim() ?? ""
);
const OPENCLAW_EXECUTE =
  process.env.OPENCLAW_EXECUTE_PATH?.trim() || "/api/execute";
const OPENCLAW_SKILLS =
  process.env.OPENCLAW_SKILLS_PATH?.trim() || "/api/skills";
const OPENCLAW_HEALTH = process.env.OPENCLAW_HEALTH_PATH?.trim() || "/health";

function normalizeOrigin(raw: string): string | null {
  if (!raw) {
    return null;
  }
  try {
    const u = new URL(raw);
    if (u.protocol !== "http:" && u.protocol !== "https:") {
      return null;
    }
    return u.origin;
  } catch {
    return null;
  }
}

function unauthorized(req: import("node:http").IncomingMessage): boolean {
  if (!SHARED) {
    return false;
  }
  const auth = req.headers.authorization;
  return auth !== `Bearer ${SHARED}`;
}

function parseSkillNames(payload: unknown): string[] {
  const out = new Set<string>();
  const add = (s: string | null) => {
    if (s) {
      out.add(s);
    }
  };
  if (Array.isArray(payload)) {
    for (const item of payload) {
      if (typeof item === "string") {
        add(item.trim() || null);
      } else if (item && typeof item === "object") {
        const o = item as { id?: unknown; name?: unknown; slug?: unknown };
        for (const k of [o.id, o.name, o.slug]) {
          if (typeof k === "string" && k.trim()) {
            add(k.trim());
            break;
          }
        }
      }
    }
  } else if (payload && typeof payload === "object" && "skills" in payload) {
    const skills = (payload as { skills: unknown }).skills;
    if (Array.isArray(skills)) {
      return parseSkillNames(skills);
    }
  }
  return [...out];
}

async function fetchOpenClawSkills(): Promise<string[]> {
  if (!OPENCLAW_ORIGIN) {
    return [];
  }
  try {
    const res = await fetch(`${OPENCLAW_ORIGIN}${OPENCLAW_SKILLS}`, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      return [];
    }
    const data: unknown = await res.json();
    return parseSkillNames(data);
  } catch {
    return [];
  }
}

type ClawIntent = {
  skill: string;
  params: Record<string, unknown>;
  priority: string;
  source: string;
  requiresConfirmation: boolean;
};

function parseIntent(body: unknown): ClawIntent | null {
  if (!body || typeof body !== "object") {
    return null;
  }
  const o = body as Record<string, unknown>;
  const skill = o.skill;
  const params = o.params;
  const priority = o.priority;
  const source = o.source;
  const requiresConfirmation = o.requiresConfirmation;
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

async function forwardToOpenClaw(intent: ClawIntent): Promise<Response> {
  if (!OPENCLAW_ORIGIN) {
    return Response.json(
      {
        success: false,
        error:
          "OPENCLAW_HTTP_URL is not set; configure it in .env.local to forward executes.",
        skill: intent.skill,
      },
      { status: 503 }
    );
  }
  try {
    const res = await fetch(`${OPENCLAW_ORIGIN}${OPENCLAW_EXECUTE}`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(intent),
      signal: AbortSignal.timeout(120_000),
    });
    const text = await res.text();
    const headers = new Headers({ "Content-Type": "application/json" });
    return new Response(text, { status: res.status, headers });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "forward failed";
    return Response.json(
      {
        success: false,
        error: msg,
        skill: intent.skill,
      },
      { status: 502 }
    );
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

  if (unauthorized(req)) {
    res.writeHead(401, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "unauthorized" }));
    return;
  }

  try {
    if (req.method === "GET" && url.pathname === "/health") {
      const oc =
        OPENCLAW_ORIGIN !== null
          ? await (async () => {
              try {
                const r = await fetch(`${OPENCLAW_ORIGIN}${OPENCLAW_HEALTH}`, {
                  signal: AbortSignal.timeout(5000),
                });
                return r.ok;
              } catch {
                return false;
              }
            })()
          : null;
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          ok: true,
          service: "hermes-local-bridge",
          mode: "local",
          openClawConfigured: Boolean(OPENCLAW_ORIGIN),
          openClawReachable: oc,
          timestamp: new Date().toISOString(),
        })
      );
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/skills") {
      const fromOc = await fetchOpenClawSkills();
      const merged = new Set<string>(["generic-task", ...fromOc]);
      const skills = [...merged].sort().map((id) => ({ id, name: id }));
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ skills }));
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/pending") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ pending: [] }));
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/execute") {
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(chunk as Buffer);
      }
      let body: unknown;
      try {
        body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      } catch {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "invalid_json" }));
        return;
      }
      const intent = parseIntent(body);
      if (!intent) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "invalid_body" }));
        return;
      }
      const out = await forwardToOpenClaw(intent);
      res.writeHead(out.status, {
        "Content-Type": out.headers.get("content-type") ?? "application/json",
      });
      res.end(await out.text());
      return;
    }

    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "not_found" }));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: msg }));
  }
});

server.listen(PORT, "127.0.0.1", () => {
  process.stderr.write(
    `[hermes-local-bridge] listening on http://127.0.0.1:${PORT}\n`
  );
  if (OPENCLAW_ORIGIN) {
    process.stderr.write(
      `[hermes-local-bridge] OpenClaw: ${OPENCLAW_ORIGIN}${OPENCLAW_EXECUTE}\n`
    );
  } else {
    process.stderr.write(
      "[hermes-local-bridge] OPENCLAW_HTTP_URL unset — execute returns 503 until set.\n"
    );
  }
});
