import "server-only";

import { and, desc, eq, gte } from "drizzle-orm";
import { VirgilError } from "@/lib/errors";
import { db } from "../client";
import { flightDeckOperatorAudit } from "../schema";

export const FLIGHT_DECK_ACTION_RUN_DIGEST = "run_digest";

export type FlightDeckActionStatus =
  | "started"
  | "completed"
  | "failed"
  | "blocked";

export type FlightDeckActionRecord = {
  id: string;
  requestId: string;
  actionToken: string;
  status: FlightDeckActionStatus;
  reason: string | null;
  createdAt: Date;
  completedAt: Date | null;
};

function toActionRecord(
  row: typeof flightDeckOperatorAudit.$inferSelect
): FlightDeckActionRecord {
  return {
    id: row.id,
    requestId: row.requestId,
    actionToken: row.actionToken,
    status: row.status as FlightDeckActionStatus,
    reason: row.reason,
    createdAt: row.createdAt,
    completedAt: row.completedAt,
  };
}

export async function getFlightDeckActionByRequestId({
  userId,
  action,
  requestId,
}: {
  userId: string;
  action: string;
  requestId: string;
}): Promise<FlightDeckActionRecord | null> {
  try {
    const [row] = await db
      .select()
      .from(flightDeckOperatorAudit)
      .where(
        and(
          eq(flightDeckOperatorAudit.userId, userId),
          eq(flightDeckOperatorAudit.action, action),
          eq(flightDeckOperatorAudit.requestId, requestId)
        )
      )
      .limit(1);
    return row ? toActionRecord(row) : null;
  } catch (_error) {
    throw new VirgilError(
      "bad_request:database",
      "Failed to load flight deck action by request id"
    );
  }
}

export async function getFlightDeckActionByToken({
  userId,
  action,
  actionToken,
}: {
  userId: string;
  action: string;
  actionToken: string;
}): Promise<FlightDeckActionRecord | null> {
  try {
    const [row] = await db
      .select()
      .from(flightDeckOperatorAudit)
      .where(
        and(
          eq(flightDeckOperatorAudit.userId, userId),
          eq(flightDeckOperatorAudit.action, action),
          eq(flightDeckOperatorAudit.actionToken, actionToken)
        )
      )
      .limit(1);
    return row ? toActionRecord(row) : null;
  } catch (_error) {
    throw new VirgilError(
      "bad_request:database",
      "Failed to load flight deck action by token"
    );
  }
}

export async function getLatestFlightDeckAction({
  userId,
  action,
}: {
  userId: string;
  action: string;
}): Promise<FlightDeckActionRecord | null> {
  try {
    const [row] = await db
      .select()
      .from(flightDeckOperatorAudit)
      .where(
        and(
          eq(flightDeckOperatorAudit.userId, userId),
          eq(flightDeckOperatorAudit.action, action)
        )
      )
      .orderBy(desc(flightDeckOperatorAudit.createdAt))
      .limit(1);
    return row ? toActionRecord(row) : null;
  } catch (_error) {
    throw new VirgilError(
      "bad_request:database",
      "Failed to load latest flight deck action"
    );
  }
}

export async function hasFlightDeckActionInProgress({
  userId,
  action,
  since,
}: {
  userId: string;
  action: string;
  since: Date;
}): Promise<boolean> {
  try {
    const [row] = await db
      .select({ id: flightDeckOperatorAudit.id })
      .from(flightDeckOperatorAudit)
      .where(
        and(
          eq(flightDeckOperatorAudit.userId, userId),
          eq(flightDeckOperatorAudit.action, action),
          eq(flightDeckOperatorAudit.status, "started"),
          gte(flightDeckOperatorAudit.createdAt, since)
        )
      )
      .limit(1);
    return Boolean(row);
  } catch (_error) {
    throw new VirgilError(
      "bad_request:database",
      "Failed to check in-progress flight deck action"
    );
  }
}

export async function insertFlightDeckActionStart({
  userId,
  action,
  requestId,
  actionToken,
  metadata,
}: {
  userId: string;
  action: string;
  requestId: string;
  actionToken: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await db.insert(flightDeckOperatorAudit).values({
      userId,
      action,
      requestId,
      actionToken,
      status: "started",
      metadata: metadata ?? {},
    });
  } catch (_error) {
    throw new VirgilError(
      "bad_request:database",
      "Failed to insert flight deck action start"
    );
  }
}

export async function updateFlightDeckActionStatus({
  userId,
  action,
  requestId,
  status,
  reason,
  metadata,
}: {
  userId: string;
  action: string;
  requestId: string;
  status: FlightDeckActionStatus;
  reason?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await db
      .update(flightDeckOperatorAudit)
      .set({
        status,
        reason: reason ?? null,
        metadata: metadata ?? {},
        completedAt:
          status === "completed" || status === "failed" || status === "blocked"
            ? new Date()
            : null,
      })
      .where(
        and(
          eq(flightDeckOperatorAudit.userId, userId),
          eq(flightDeckOperatorAudit.action, action),
          eq(flightDeckOperatorAudit.requestId, requestId)
        )
      );
  } catch (_error) {
    throw new VirgilError(
      "bad_request:database",
      "Failed to update flight deck action status"
    );
  }
}
