import "server-only";

import {
  and,
  asc,
  count,
  desc,
  eq,
  isNotNull,
  isNull,
  lt,
  or,
  sql,
} from "drizzle-orm";
import { VirgilError } from "@/lib/errors";
import {
  getPendingIntentSkipReason,
  isPendingIntentRetryable,
} from "@/lib/integrations/delegation-idempotency";
import {
  getDelegationPollWaitMs,
  getDelegationProcessingReclaimAfterMs,
  isDelegationPollPrimaryActive,
} from "@/lib/integrations/delegation-poll-config";
import {
  delegationPing,
  delegationSendIntent,
} from "@/lib/integrations/delegation-provider";
import type { ClawIntent, ClawResult } from "@/lib/integrations/openclaw-types";
import { db } from "../client";
import { chat, type PendingIntent, pendingIntent } from "../schema";

/** Avoid FK violations: `PendingIntent.chatId` references `Chat` and must be null or a real row owned by the user. */
async function resolvePersistedChatIdForUser({
  userId,
  chatId,
}: {
  userId: string;
  chatId: string | undefined;
}): Promise<string | null> {
  if (!chatId) {
    return null;
  }
  const [row] = await db
    .select({ id: chat.id })
    .from(chat)
    .where(and(eq(chat.id, chatId), eq(chat.userId, userId)))
    .limit(1);
  return row ? chatId : null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildDeferredPollResult(skill: string): ClawResult {
  return {
    success: true,
    skill,
    executedAt: new Date().toISOString(),
    output:
      "Queued for your local Hermes worker (database poll). Execution runs when the worker is online; check this intent id for results.",
    deferredToPollWorker: true,
  };
}

function clawResultFromRowResult(
  raw: Record<string, unknown> | null | undefined,
  _skillFallback: string
): ClawResult | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const success = raw.success;
  const skill = raw.skill;
  const executedAt = raw.executedAt;
  if (typeof success !== "boolean") {
    return null;
  }
  if (typeof skill !== "string" || typeof executedAt !== "string") {
    return null;
  }
  return {
    success,
    skill,
    executedAt,
    output: typeof raw.output === "string" ? raw.output : undefined,
    error: typeof raw.error === "string" ? raw.error : undefined,
    routedVia:
      raw.routedVia === "openclaw" || raw.routedVia === "hermes"
        ? raw.routedVia
        : undefined,
    deferredToPollWorker: raw.deferredToPollWorker === true ? true : undefined,
  };
}

async function waitForPollWorkerCompletion({
  id,
  userId,
  timeoutMs,
}: {
  id: string;
  userId: string;
  timeoutMs: number;
}): Promise<{ row: PendingIntent } | { timedOut: true }> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const row = await getPendingIntentByIdForUser({ id, userId });
    if (!row) {
      return { timedOut: true };
    }
    if (row.status === "completed" || row.status === "failed") {
      return { row };
    }
    await sleep(400);
  }
  return { timedOut: true };
}

function pendingIntentInsertHint(pgMessage: string): string {
  const m = pgMessage.toLowerCase();
  if (
    m.includes("pendingintent_userid_fkey") ||
    (m.includes("violates foreign key constraint") &&
      (m.includes("userid") || m.includes('table "pendingintent"')))
  ) {
    return "Hint: this user id is not present in the `User` table for this database (auth/DB mismatch), or POSTGRES_URL points at the wrong database.";
  }
  if (m.includes("pendingintent_chatid_fkey")) {
    return "Hint: the chat id is not valid for this database.";
  }
  if (m.includes("does not exist") && m.includes("column")) {
    return "Hint: run `pnpm db:migrate` so `PendingIntent` matches the app schema.";
  }
  return "";
}

/**
 * Drizzle wraps driver errors in `DrizzleQueryError` with the Postgres message on `.cause`.
 * Do not use `instanceof DrizzleQueryError`: duplicate `drizzle-orm` copies in the Next.js
 * bundle break `instanceof`, and the raw "Failed query: …" string leaks to the UI.
 */
function unwrapPendingIntentInsertError(err: unknown): Error {
  if (!(err instanceof Error)) {
    return new Error(String(err));
  }

  const rawCause =
    "cause" in err ? (err as Error & { cause?: unknown }).cause : undefined;
  const pg =
    rawCause instanceof Error
      ? rawCause.message
      : rawCause == null
        ? null
        : String(rawCause);

  const looksLikeDrizzleQuery =
    err.message.startsWith("Failed query:") ||
    err.constructor?.name === "DrizzleQueryError";

  if (looksLikeDrizzleQuery && pg) {
    const hint = pendingIntentInsertHint(pg);
    const body = hint ? `${pg} ${hint}` : pg;
    return new Error(`PendingIntent queue failed: ${body}`);
  }

  return err;
}

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

export async function queuePendingIntent({
  userId,
  chatId,
  intent,
  skill,
  requiresConfirmation,
}: {
  userId: string;
  chatId?: string;
  intent: ClawIntent;
  skill: string;
  requiresConfirmation: boolean;
}) {
  const persistedChatId = await resolvePersistedChatIdForUser({
    userId,
    chatId,
  });
  try {
    const [row] = await db
      .insert(pendingIntent)
      .values({
        userId,
        chatId: persistedChatId,
        intent: intent as unknown as Record<string, unknown>,
        skill,
        requiresConfirmation,
        status: "pending",
      })
      .returning();
    return row;
  } catch (err) {
    throw unwrapPendingIntentInsertError(err);
  }
}

export function getPendingConfirmationsForUser(userId: string) {
  return db
    .select()
    .from(pendingIntent)
    .where(
      and(
        eq(pendingIntent.userId, userId),
        eq(pendingIntent.requiresConfirmation, true),
        or(
          eq(pendingIntent.status, "pending"),
          and(
            eq(pendingIntent.status, "confirmed"),
            isNull(pendingIntent.sentAt)
          )
        )
      )
    )
    .orderBy(desc(pendingIntent.createdAt));
}

export async function confirmPendingIntent({
  id,
  userId,
}: {
  id: string;
  userId: string;
}) {
  const [updated] = await db
    .update(pendingIntent)
    .set({ status: "confirmed" })
    .where(
      and(
        eq(pendingIntent.id, id),
        eq(pendingIntent.userId, userId),
        eq(pendingIntent.status, "pending"),
        eq(pendingIntent.requiresConfirmation, true)
      )
    )
    .returning();
  return updated ?? null;
}

export async function isAlreadyConfirmedUnsent({
  id,
  userId,
}: {
  id: string;
  userId: string;
}): Promise<boolean> {
  const [row] = await db
    .select({ id: pendingIntent.id })
    .from(pendingIntent)
    .where(
      and(
        eq(pendingIntent.id, id),
        eq(pendingIntent.userId, userId),
        eq(pendingIntent.status, "confirmed"),
        isNull(pendingIntent.sentAt)
      )
    )
    .limit(1);
  return Boolean(row);
}

export async function rejectPendingIntent({
  id,
  userId,
  reason,
}: {
  id: string;
  userId: string;
  reason?: string;
}) {
  const [updated] = await db
    .update(pendingIntent)
    .set({
      status: "rejected",
      rejectionReason: reason ?? null,
    })
    .where(
      and(
        eq(pendingIntent.id, id),
        eq(pendingIntent.userId, userId),
        or(
          eq(pendingIntent.status, "pending"),
          eq(pendingIntent.status, "confirmed")
        ),
        isNull(pendingIntent.sentAt)
      )
    )
    .returning();
  return updated ?? null;
}

/** Rows stuck in `processing` (worker died or never completed) past the reclaim TTL. */
function staleProcessingPollWhere() {
  const ms = getDelegationProcessingReclaimAfterMs();
  const staleBefore = new Date(Date.now() - ms);
  const longSentFallback = new Date(Date.now() - 2 * 60 * 60 * 1000);
  return and(
    eq(pendingIntent.status, "processing"),
    eq(pendingIntent.awaitingPollWorker, true),
    isNull(pendingIntent.result),
    or(
      lt(pendingIntent.processingStartedAt, staleBefore),
      and(
        isNull(pendingIntent.processingStartedAt),
        isNotNull(pendingIntent.sentAt),
        lt(pendingIntent.sentAt, longSentFallback)
      )
    )
  );
}

/**
 * Requeue poll intents that stayed in `processing` too long (e.g. worker crash mid-run).
 * Idempotent; safe to call frequently. Invoked before each poll-worker claim.
 */
export async function reclaimStaleProcessingPollIntents(): Promise<number> {
  const updated = await db
    .update(pendingIntent)
    .set({ status: "sent", processingStartedAt: null })
    .where(staleProcessingPollWhere())
    .returning({ id: pendingIntent.id });
  return updated.length;
}

/** Count of poll intents currently exceeding the processing TTL (matches reclaim predicate). */
export async function countStaleProcessingPollIntents(): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(pendingIntent)
    .where(staleProcessingPollWhere());
  return Number(row?.n ?? 0);
}

/**
 * Row counts grouped by `PendingIntent.status` (all time). No user ids — operator insight only.
 */
export async function countPendingIntentsByStatus(): Promise<
  Record<string, number>
> {
  const rows = await db
    .select({
      status: pendingIntent.status,
      n: count(),
    })
    .from(pendingIntent)
    .groupBy(pendingIntent.status);
  const out: Record<string, number> = {};
  for (const r of rows) {
    out[r.status] = Number(r.n);
  }
  return out;
}

// TODO: wire to retry cron — query for intents stuck in "sent" >5 min
export function getRetryableOpenClawIntents() {
  return db
    .select()
    .from(pendingIntent)
    .where(
      and(
        eq(pendingIntent.status, "sent"),
        eq(pendingIntent.awaitingPollWorker, false),
        isNull(pendingIntent.result),
        isNotNull(pendingIntent.sentAt),
        lt(pendingIntent.sentAt, sql<string>`(now() - interval '5 minutes')`)
      )
    )
    .then((rows) =>
      rows.filter((row) =>
        isPendingIntentRetryable({
          status: row.status,
          sentAt: row.sentAt,
          result: (row.result ?? null) as Record<string, unknown> | null,
        })
      )
    );
}

// TODO: wire to future intent detail view
export async function getPendingIntentByIdForUser({
  id,
  userId,
}: {
  id: string;
  userId: string;
}) {
  const [row] = await db
    .select()
    .from(pendingIntent)
    .where(and(eq(pendingIntent.id, id), eq(pendingIntent.userId, userId)))
    .limit(1);
  return row ?? null;
}

export async function trySendPendingIntentById({
  id,
  userId,
}: {
  id: string;
  userId: string;
}) {
  const [row] = await db
    .select()
    .from(pendingIntent)
    .where(and(eq(pendingIntent.id, id), eq(pendingIntent.userId, userId)))
    .limit(1);

  if (!row) {
    throw new VirgilError("not_found:api", "Intent not found.");
  }

  const skipReason = getPendingIntentSkipReason(row);
  if (skipReason) {
    return { skipped: true as const, reason: skipReason };
  }

  const parsed = parseClawIntent(row.intent);
  if (!parsed) {
    await db
      .update(pendingIntent)
      .set({
        status: "failed",
        result: { error: "invalid_intent_payload" },
      })
      .where(eq(pendingIntent.id, id));
    throw new VirgilError("bad_request:api", "Stored intent is invalid.");
  }

  if (isDelegationPollPrimaryActive()) {
    await db
      .update(pendingIntent)
      .set({
        status: "sent",
        sentAt: new Date(),
        awaitingPollWorker: true,
      })
      .where(eq(pendingIntent.id, id));

    const waitMs = getDelegationPollWaitMs();
    if (waitMs > 0) {
      const outcome = await waitForPollWorkerCompletion({
        id,
        userId,
        timeoutMs: waitMs,
      });
      if ("timedOut" in outcome) {
        const fail: ClawResult = {
          success: false,
          skill: parsed.skill,
          executedAt: new Date().toISOString(),
          error: `Local poll worker did not complete within ${String(waitMs)}ms. The task remains queued for Hermes.`,
        };
        return { skipped: false as const, result: fail };
      }
      const parsedResult = clawResultFromRowResult(
        outcome.row.result ?? undefined,
        parsed.skill
      );
      if (parsedResult) {
        return { skipped: false as const, result: parsedResult };
      }
      const fail: ClawResult = {
        success: false,
        skill: parsed.skill,
        executedAt: new Date().toISOString(),
        error: "Worker completed but result payload was invalid.",
      };
      return { skipped: false as const, result: fail };
    }

    return {
      skipped: false as const,
      result: buildDeferredPollResult(parsed.skill),
    };
  }

  const online = await delegationPing();
  if (!online) {
    return { skipped: true as const, reason: "backend_offline" as const };
  }

  await db
    .update(pendingIntent)
    .set({
      status: "sent",
      sentAt: new Date(),
      awaitingPollWorker: false,
    })
    .where(eq(pendingIntent.id, id));

  const result = await delegationSendIntent(parsed);

  await db
    .update(pendingIntent)
    .set({
      status: result.success ? "completed" : "failed",
      result: result as unknown as Record<string, unknown>,
      awaitingPollWorker: false,
    })
    .where(eq(pendingIntent.id, id));

  return { skipped: false as const, result };
}

/**
 * Hermes/Manos poll worker: claim the next intent released to the DB bus (outbound HTTPS only).
 */
export async function claimNextPendingIntentForPollWorker(): Promise<PendingIntent | null> {
  await reclaimStaleProcessingPollIntents();
  return db.transaction(async (tx) => {
    const picked = await tx
      .select({ id: pendingIntent.id })
      .from(pendingIntent)
      .where(
        and(
          eq(pendingIntent.status, "sent"),
          eq(pendingIntent.awaitingPollWorker, true),
          isNull(pendingIntent.result)
        )
      )
      .orderBy(asc(pendingIntent.sentAt))
      .limit(1)
      .for("update", { skipLocked: true });

    const first = picked[0];
    if (!first) {
      return null;
    }

    const [updated] = await tx
      .update(pendingIntent)
      .set({
        status: "processing",
        processingStartedAt: new Date(),
      })
      .where(eq(pendingIntent.id, first.id))
      .returning();

    return updated ?? null;
  });
}

/**
 * Hermes/Manos poll worker: mark a claimed intent complete (must be `processing`).
 */
export async function completePollWorkerIntent({
  id,
  result,
}: {
  id: string;
  result: ClawResult;
}): Promise<PendingIntent | null> {
  const [updated] = await db
    .update(pendingIntent)
    .set({
      status: result.success ? "completed" : "failed",
      result: result as unknown as Record<string, unknown>,
      awaitingPollWorker: false,
      processingStartedAt: null,
    })
    .where(
      and(eq(pendingIntent.id, id), eq(pendingIntent.status, "processing"))
    )
    .returning();
  return updated ?? null;
}

/** Delegation backlog: pending rows that never left the queue (for owner messaging). */
export async function countDelegationBacklogForUser(userId: string) {
  const rows = await db
    .select({ id: pendingIntent.id })
    .from(pendingIntent)
    .where(
      and(
        eq(pendingIntent.userId, userId),
        or(
          eq(pendingIntent.status, "pending"),
          eq(pendingIntent.status, "confirmed")
        ),
        isNull(pendingIntent.sentAt)
      )
    );
  return rows.length;
}

/** Backward-compatible alias while callers migrate naming. */
export const countOpenClawBacklogForUser = countDelegationBacklogForUser;
