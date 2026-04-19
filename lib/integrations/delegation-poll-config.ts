/**
 * DB-backed delegation (Hermes/Manos polls Postgres via Virgil HTTPS worker routes).
 * Avoids inbound tunnels from Vercel to the LAN. See docs/virgil-manos-delegation.md.
 */

const TRUTHY = new Set(["1", "true", "on", "yes"]);

export function isDelegationPollPrimaryEnabled(): boolean {
  const raw = process.env.VIRGIL_DELEGATION_POLL_PRIMARY?.trim().toLowerCase();
  return raw !== undefined && TRUTHY.has(raw);
}

/** Shared secret for `Authorization: Bearer …` on `/api/delegation/worker/*`. */
export function getDelegationWorkerSecret(): string | null {
  const explicit = process.env.VIRGIL_DELEGATION_WORKER_SECRET?.trim();
  if (explicit) {
    return explicit;
  }
  const legacy = process.env.HERMES_SHARED_SECRET?.trim();
  return legacy ?? null;
}

/** Poll delivery is active: feature on and worker auth is configured. */
export function isDelegationPollPrimaryActive(): boolean {
  return (
    isDelegationPollPrimaryEnabled() && getDelegationWorkerSecret() !== null
  );
}

/**
 * Optional: block until the local worker writes a result (bounded wait).
 * Default 0 = return immediately with a queued success message.
 * Capped internally to avoid serverless timeouts.
 */
export function getDelegationPollWaitMs(): number {
  const raw = process.env.VIRGIL_DELEGATION_POLL_WAIT_MS?.trim();
  if (!raw) {
    return 0;
  }
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 0) {
    return 0;
  }
  return Math.min(n, 60_000);
}
