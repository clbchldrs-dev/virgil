/**
 * Local Hermes poll worker: outbound-only loop for VIRGIL_DELEGATION_POLL_PRIMARY.
 *
 * 1. GET hosted Virgil `/api/delegation/worker/claim`
 * 2. POST intent JSON to local Hermes execute (same contract as `lib/integrations/hermes-client.ts`)
 * 3. POST result to hosted Virgil `/api/delegation/worker/complete`
 *
 * Run on the Mac/manos where Hermes listens (e.g. 127.0.0.1:8765):
 *   pnpm delegation:poll-worker
 *
 * Env: see docs/virgil-manos-delegation.md (poll worker section).
 */

import { resolve } from "node:path";
import { config } from "dotenv";
import { sendHermesIntent } from "@/lib/integrations/hermes-client";
import type { ClawIntent, ClawResult } from "@/lib/integrations/openclaw-types";

config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

function parseClawIntent(raw: Record<string, unknown>): ClawIntent | null {
  const skill = raw.skill;
  const params = raw.params;
  const priority = raw.priority;
  const source = raw.source;
  const requiresConfirmation = raw.requiresConfirmation;
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

function workerBaseUrl(): string | null {
  const raw =
    process.env.VIRGIL_DELEGATION_WORKER_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!raw) {
    return null;
  }
  return raw.replace(/\/$/, "");
}

function workerSecret(): string | null {
  const s =
    process.env.VIRGIL_DELEGATION_WORKER_SECRET?.trim() ||
    process.env.HERMES_SHARED_SECRET?.trim();
  return s ?? null;
}

function pollIntervalMs(): number {
  const raw = process.env.VIRGIL_DELEGATION_POLL_INTERVAL_MS?.trim();
  if (!raw) {
    return 5000;
  }
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1000) {
    return 5000;
  }
  return Math.min(n, 120_000);
}

function executeTimeoutMs(): number {
  const raw = process.env.VIRGIL_DELEGATION_WORKER_EXECUTE_TIMEOUT_MS?.trim();
  if (!raw) {
    return 120_000;
  }
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 5000) {
    return 120_000;
  }
  return Math.min(n, 600_000);
}

type ClaimRow = {
  id: string;
  intent: Record<string, unknown>;
};

async function claim(base: string, secret: string): Promise<ClaimRow | null> {
  const res = await fetch(`${base}/api/delegation/worker/claim`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${secret}`,
    },
  });
  if (res.status === 204) {
    return null;
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`claim ${String(res.status)}: ${text}`);
  }
  return (await res.json()) as ClaimRow;
}

async function complete(
  base: string,
  secret: string,
  id: string,
  result: ClawResult
): Promise<void> {
  const res = await fetch(`${base}/api/delegation/worker/complete`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify({
      id,
      success: result.success,
      skill: result.skill,
      executedAt: result.executedAt,
      output: result.output,
      error: result.error,
      routedVia: result.routedVia,
      deferredToPollWorker: result.deferredToPollWorker,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`complete ${String(res.status)}: ${text}`);
  }
}

async function processOne(
  base: string,
  secret: string,
  row: ClaimRow
): Promise<void> {
  const intentRaw = row.intent;
  if (typeof intentRaw !== "object" || intentRaw === null) {
    const fail: ClawResult = {
      success: false,
      skill: "unknown",
      executedAt: new Date().toISOString(),
      error: "invalid intent on row",
    };
    await complete(base, secret, row.id, fail);
    return;
  }

  const parsed = parseClawIntent(intentRaw as Record<string, unknown>);
  if (!parsed) {
    const fail: ClawResult = {
      success: false,
      skill: "unknown",
      executedAt: new Date().toISOString(),
      error: "could not parse ClawIntent from stored row",
    };
    await complete(base, secret, row.id, fail);
    return;
  }

  const result = await sendHermesIntent(parsed, {
    timeoutMs: executeTimeoutMs(),
  });
  await complete(base, secret, row.id, result);
}

async function main(): Promise<void> {
  const base = workerBaseUrl();
  const secret = workerSecret();
  if (!base) {
    process.stderr.write(
      "Set VIRGIL_DELEGATION_WORKER_BASE_URL (or NEXT_PUBLIC_APP_URL) to your hosted Virgil origin, e.g. https://app.example.com\n"
    );
    process.exit(1);
  }
  if (!secret) {
    process.stderr.write(
      "Set VIRGIL_DELEGATION_WORKER_SECRET or HERMES_SHARED_SECRET (must match Vercel)\n"
    );
    process.exit(1);
  }

  const interval = pollIntervalMs();
  process.stderr.write(
    `delegation-poll-worker → ${base} (interval ${String(interval)}ms, Hermes execute timeout ${String(executeTimeoutMs())}ms). Ctrl+C to stop.\n`
  );

  let running = true;
  process.on("SIGINT", () => {
    running = false;
    process.stderr.write("\nStopping…\n");
  });

  while (running) {
    try {
      const row = await claim(base, secret);
      if (row) {
        await processOne(base, secret, row);
        continue;
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      process.stderr.write(`poll error: ${msg}\n`);
    }
    if (!running) {
      break;
    }
    await new Promise((r) => setTimeout(r, interval));
  }
}

main().catch((e) => {
  process.stderr.write(`${e instanceof Error ? e.message : String(e)}\n`);
  process.exit(1);
});
