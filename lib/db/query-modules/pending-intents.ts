import "server-only";

import { and, desc, eq, isNotNull, isNull, lt, or, sql } from "drizzle-orm";
import { VirgilError } from "@/lib/errors";
import { getDelegationProvider } from "@/lib/integrations/delegation-provider";
import { pendingIntentBlocksImmediateSend } from "@/lib/integrations/openclaw-queue-gate";
import type { ClawIntent } from "@/lib/integrations/openclaw-types";
import { db } from "../client";
import { pendingIntent } from "../schema";

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
  const [row] = await db
    .insert(pendingIntent)
    .values({
      userId,
      chatId: chatId ?? null,
      intent: intent as unknown as Record<string, unknown>,
      skill,
      requiresConfirmation,
      status: "pending",
    })
    .returning();
  return row;
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

// TODO: wire to retry cron — query for intents stuck in "sent" >5 min
export function getRetryableOpenClawIntents() {
  return db
    .select()
    .from(pendingIntent)
    .where(
      and(
        eq(pendingIntent.status, "sent"),
        isNull(pendingIntent.result),
        isNotNull(pendingIntent.sentAt),
        lt(pendingIntent.sentAt, sql<string>`(now() - interval '5 minutes')`)
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

  if (pendingIntentBlocksImmediateSend(row)) {
    return { skipped: true as const, reason: "awaiting_confirmation" as const };
  }

  if (row.status !== "pending" && row.status !== "confirmed") {
    return { skipped: true as const, reason: "wrong_status" as const };
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

  const delegationProvider = getDelegationProvider();
  const online = await delegationProvider.ping();
  if (!online) {
    return { skipped: true as const, reason: "backend_offline" as const };
  }

  await db
    .update(pendingIntent)
    .set({ status: "sent", sentAt: new Date() })
    .where(eq(pendingIntent.id, id));

  const result = await delegationProvider.sendIntent(parsed);

  await db
    .update(pendingIntent)
    .set({
      status: result.success ? "completed" : "failed",
      result: result as unknown as Record<string, unknown>,
    })
    .where(eq(pendingIntent.id, id));

  return { skipped: false as const, result };
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
