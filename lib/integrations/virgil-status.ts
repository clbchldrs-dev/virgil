/**
 * Feature-grouped status for Virgil.
 *
 * One data shape, three consumers:
 *  - `pnpm virgil:status` (scripts/virgil-status.ts) — human-readable terminal output
 *  - `GET /api/virgil/status` — in-browser banner JSON
 *  - tests — pure data assertions
 *
 * Keeps env-var plumbing out of product code; each feature is one row telling
 * the developer what's configured, what's missing, and exactly how to fix it.
 */

import { isDelegationPollPrimaryActive } from "@/lib/integrations/delegation-poll-config";
import { getHermesHttpOrigin } from "@/lib/integrations/hermes-config";
import { getOpenClawHttpOrigin } from "@/lib/integrations/openclaw-config";

export type StatusState = "ok" | "missing" | "offline" | "info";

export type StatusRow = {
  feature: string;
  state: StatusState;
  note: string;
  /** Optional, actionable next-step instruction. */
  fix?: string;
  /** Optional link to docs. */
  docs?: string;
};

export type StatusGroup = {
  group: string;
  rows: StatusRow[];
};

export type VirgilStatusSnapshot = {
  generatedAt: string;
  groups: StatusGroup[];
  criticalMissing: number;
};

function has(name: string): boolean {
  return Boolean(process.env[name]?.trim());
}

function coreRows(): StatusRow[] {
  const rows: StatusRow[] = [];
  rows.push(
    has("AUTH_SECRET") || has("NEXTAUTH_SECRET")
      ? {
          feature: "Auth secret",
          state: "ok",
          note: "Set (AUTH_SECRET or NEXTAUTH_SECRET).",
        }
      : {
          feature: "Auth secret",
          state: "missing",
          note: "Required for production. Dev uses an insecure fallback.",
          fix: "openssl rand -base64 32  →  AUTH_SECRET=…  in .env.local",
        }
  );
  rows.push(
    has("POSTGRES_URL")
      ? { feature: "Postgres", state: "ok", note: "POSTGRES_URL set." }
      : {
          feature: "Postgres",
          state: "missing",
          note: "Required for login, chat history, delegation queue.",
          fix: "Set POSTGRES_URL (Neon/Supabase free tier OK).",
        }
  );
  rows.push(
    has("REDIS_URL")
      ? { feature: "Redis", state: "ok", note: "REDIS_URL set." }
      : {
          feature: "Redis",
          state: "missing",
          note: "Required for rate limits.",
          fix: "Set REDIS_URL (Upstash free tier OK).",
        }
  );
  rows.push(
    has("AI_GATEWAY_API_KEY") || has("VERCEL_OIDC_TOKEN")
      ? {
          feature: "AI Gateway",
          state: "ok",
          note: "Hosted models reachable.",
        }
      : {
          feature: "AI Gateway",
          state: "info",
          note: "Hosted models unavailable. OK if only using Ollama locally.",
          fix: "Set AI_GATEWAY_API_KEY or run under `vercel dev` for OIDC.",
        }
  );
  return rows;
}

async function delegationRows(): Promise<StatusRow[]> {
  const rows: StatusRow[] = [];
  const hermesOrigin = getHermesHttpOrigin();
  const openClawOrigin = getOpenClawHttpOrigin();

  rows.push(
    hermesOrigin
      ? {
          feature: "Hermes bridge",
          state: "ok",
          note: `In-app bridge resolved to ${hermesOrigin}/api/hermes-bridge/*`,
        }
      : {
          feature: "Hermes bridge",
          state: "offline",
          note: "Bridge origin unresolved.",
          fix: "Leave HERMES_HTTP_URL unset to use the in-app bridge, or set it explicitly.",
        }
  );

  if (openClawOrigin) {
    const reachable = await quickPing(`${openClawOrigin}/health`);
    rows.push(
      reachable
        ? {
            feature: "OpenClaw gateway",
            state: "ok",
            note: `Reachable at ${openClawOrigin}`,
          }
        : {
            feature: "OpenClaw gateway",
            state: "offline",
            note: `Configured but not reachable at ${openClawOrigin}`,
            fix: "Start the tunnel: OPENCLAW_SSH_HOST=user@lan-host pnpm virgil:start",
          }
    );
  } else {
    rows.push({
      feature: "OpenClaw gateway",
      state: "info",
      note: "OPENCLAW_HTTP_URL not set — delegation forwards will return 503.",
      fix: "Set OPENCLAW_HTTP_URL (e.g. http://127.0.0.1:18789) to enable forwarding.",
    });
  }

  const pollActive = isDelegationPollPrimaryActive();
  if (pollActive) {
    rows.push({
      feature: "Poll worker (prod drain)",
      state: "ok",
      note: "VIRGIL_DELEGATION_POLL_PRIMARY=1 with worker secret present.",
    });
  } else if (has("VIRGIL_DELEGATION_POLL_PRIMARY")) {
    rows.push({
      feature: "Poll worker (prod drain)",
      state: "missing",
      note: "VIRGIL_DELEGATION_POLL_PRIMARY=1 but no worker secret.",
      fix: "Set VIRGIL_DELEGATION_WORKER_SECRET (and VIRGIL_DELEGATION_WORKER_BASE_URL on the Mac).",
    });
  } else {
    rows.push({
      feature: "Poll worker (prod drain)",
      state: "info",
      note: "Disabled — set VIRGIL_DELEGATION_POLL_PRIMARY=1 on Vercel to drain via a local Mac worker.",
    });
  }

  return rows;
}

function remindersRows(): StatusRow[] {
  const rows: StatusRow[] = [];
  rows.push(
    has("QSTASH_TOKEN")
      ? { feature: "QStash", state: "ok", note: "QSTASH_TOKEN set." }
      : {
          feature: "QStash",
          state: "missing",
          note: "Reminders and night review won't schedule.",
          fix: "Sign up at https://console.upstash.com/qstash and set QSTASH_TOKEN + signing keys.",
        }
  );
  rows.push(
    has("RESEND_API_KEY")
      ? { feature: "Resend (email)", state: "ok", note: "RESEND_API_KEY set." }
      : {
          feature: "Resend (email)",
          state: "missing",
          note: "Reminder and digest emails will fail to send.",
          fix: "Set RESEND_API_KEY (https://resend.com).",
        }
  );
  rows.push(
    has("CRON_SECRET")
      ? { feature: "Cron secret", state: "ok", note: "CRON_SECRET set." }
      : {
          feature: "Cron secret",
          state: "missing",
          note: "Protects /api/digest and /api/night-review/enqueue.",
          fix: "openssl rand -base64 32  →  CRON_SECRET=…",
        }
  );
  return rows;
}

function integrationsRows(): StatusRow[] {
  const rows: StatusRow[] = [];
  rows.push(
    has("GOOGLE_CALENDAR_CLIENT_ID") &&
      has("GOOGLE_CALENDAR_CLIENT_SECRET") &&
      has("GOOGLE_CALENDAR_REFRESH_TOKEN")
      ? {
          feature: "Google Calendar",
          state: "ok",
          note: "OAuth creds present.",
        }
      : {
          feature: "Google Calendar",
          state: "missing",
          note: "Calendar reads disabled.",
          fix: "See docs/google-calendar-integration.md for the OAuth flow.",
          docs: "docs/google-calendar-integration.md",
        }
  );
  rows.push(
    has("MEM0_API_KEY")
      ? { feature: "Mem0", state: "ok", note: "MEM0_API_KEY set." }
      : {
          feature: "Mem0",
          state: "info",
          note: "Optional — falls back to Postgres FTS.",
        }
  );
  rows.push(
    has("BLOB_READ_WRITE_TOKEN")
      ? {
          feature: "Vercel Blob",
          state: "ok",
          note: "BLOB_READ_WRITE_TOKEN set.",
        }
      : {
          feature: "Vercel Blob",
          state: "missing",
          note: "File uploads will fail.",
          fix: "Set BLOB_READ_WRITE_TOKEN from your Vercel Blob store.",
        }
  );
  rows.push(
    has("GITHUB_PRODUCT_OPPORTUNITY_TOKEN") && has("GITHUB_REPOSITORY")
      ? { feature: "GitHub issues", state: "ok", note: "Token + repo set." }
      : {
          feature: "GitHub issues",
          state: "info",
          note: "Optional — product-opportunity issue tool unavailable.",
        }
  );
  rows.push(
    has("JIRA_BASE_URL") && has("JIRA_EMAIL") && has("JIRA_API_TOKEN")
      ? { feature: "Jira", state: "ok", note: "Jira creds set." }
      : { feature: "Jira", state: "info", note: "Optional — tool disabled." }
  );
  return rows;
}

function ollamaRows(): StatusRow[] {
  const base = process.env.OLLAMA_BASE_URL?.trim();
  return [
    {
      feature: "Ollama",
      state: "info",
      note: base
        ? `Configured: ${base} (must be reachable from the Next.js process, not the browser).`
        : "Defaults to http://127.0.0.1:11434. Vercel deploys cannot see your LAN.",
    },
  ];
}

async function quickPing(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: "GET",
      signal: AbortSignal.timeout(2500),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function buildVirgilStatus(): Promise<VirgilStatusSnapshot> {
  const [delegation] = await Promise.all([delegationRows()]);
  const groups: StatusGroup[] = [
    { group: "Core", rows: coreRows() },
    {
      group: "Delegation (Virgil → Hermes → OpenClaw)",
      rows: delegation,
    },
    { group: "Reminders / email", rows: remindersRows() },
    { group: "Integrations", rows: integrationsRows() },
    { group: "Ollama (local models)", rows: ollamaRows() },
  ];
  const criticalMissing = groups
    .flatMap((g) => g.rows)
    .filter((r) => r.state === "missing").length;
  return {
    generatedAt: new Date().toISOString(),
    groups,
    criticalMissing,
  };
}
