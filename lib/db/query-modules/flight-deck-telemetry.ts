import "server-only";

import { and, asc, eq, gte } from "drizzle-orm";
import { VirgilError } from "@/lib/errors";
import { db } from "../client";
import { backgroundJob, chatPathTelemetry } from "../schema";

export type ChatPath = "gateway" | "ollama";
export type TelemetryOutcome = "completed" | "error";
export type TelemetryFallbackTier = "gateway" | "gemini" | "ollama" | null;

export type ChatPathTelemetryInsert = {
  userId: string;
  chatId?: string | null;
  requestedModelId: string;
  effectiveModelId: string;
  requestedPath: ChatPath;
  effectivePath: ChatPath;
  fallbackTier: TelemetryFallbackTier;
  outcome: TelemetryOutcome;
  errorCode?: string | null;
};

export type ChatPathWindowCounts = {
  total: number;
  completed: number;
  error: number;
  byPath: Record<ChatPath, { total: number; errors: number }>;
  byErrorCode: Record<string, number>;
};

export type ChatPathTelemetryRollup = {
  current: ChatPathWindowCounts;
  previous: ChatPathWindowCounts;
  latestEventAt: Date | null;
};

export type BackgroundQueueSnapshot = {
  pending: number;
  running: number;
  failedRecent: number;
  latestEventAt: Date | null;
};

type TelemetryRow = {
  effectivePath: ChatPath;
  outcome: TelemetryOutcome;
  errorCode: string | null;
  createdAt: Date;
};

function emptyCounts(): ChatPathWindowCounts {
  return {
    total: 0,
    completed: 0,
    error: 0,
    byPath: {
      gateway: { total: 0, errors: 0 },
      ollama: { total: 0, errors: 0 },
    },
    byErrorCode: {},
  };
}

function accumulateCounts(rows: TelemetryRow[]): ChatPathWindowCounts {
  const counts = emptyCounts();

  for (const row of rows) {
    counts.total += 1;
    counts.byPath[row.effectivePath].total += 1;

    if (row.outcome === "error") {
      counts.error += 1;
      counts.byPath[row.effectivePath].errors += 1;
      const code = row.errorCode?.trim() || "unknown_error";
      counts.byErrorCode[code] = (counts.byErrorCode[code] ?? 0) + 1;
    } else {
      counts.completed += 1;
    }
  }

  return counts;
}

export async function insertChatPathTelemetry(
  input: ChatPathTelemetryInsert
): Promise<void> {
  try {
    await db.insert(chatPathTelemetry).values({
      userId: input.userId,
      chatId: input.chatId ?? null,
      requestedModelId: input.requestedModelId,
      effectiveModelId: input.effectiveModelId,
      requestedPath: input.requestedPath,
      effectivePath: input.effectivePath,
      fallbackTier: input.fallbackTier,
      outcome: input.outcome,
      errorCode: input.errorCode ?? null,
    });
  } catch (_error) {
    throw new VirgilError(
      "bad_request:database",
      "Failed to insert chat path telemetry"
    );
  }
}

export async function getChatPathTelemetryRollupForUser({
  userId,
  currentWindowStart,
  previousWindowStart,
}: {
  userId: string;
  currentWindowStart: Date;
  previousWindowStart: Date;
}): Promise<ChatPathTelemetryRollup> {
  try {
    const rows = await db
      .select({
        effectivePath: chatPathTelemetry.effectivePath,
        outcome: chatPathTelemetry.outcome,
        errorCode: chatPathTelemetry.errorCode,
        createdAt: chatPathTelemetry.createdAt,
      })
      .from(chatPathTelemetry)
      .where(
        and(
          eq(chatPathTelemetry.userId, userId),
          gte(chatPathTelemetry.createdAt, previousWindowStart)
        )
      )
      .orderBy(asc(chatPathTelemetry.createdAt));

    const validRows = rows.filter(
      (row): row is TelemetryRow =>
        (row.effectivePath === "gateway" || row.effectivePath === "ollama") &&
        (row.outcome === "completed" || row.outcome === "error")
    );
    const currentRows = validRows.filter(
      (row) => row.createdAt >= currentWindowStart
    );
    const previousRows = validRows.filter(
      (row) => row.createdAt < currentWindowStart
    );

    return {
      current: accumulateCounts(currentRows),
      previous: accumulateCounts(previousRows),
      latestEventAt: rows.length > 0 ? (rows.at(-1)?.createdAt ?? null) : null,
    };
  } catch (_error) {
    throw new VirgilError(
      "bad_request:database",
      "Failed to read chat path telemetry rollup"
    );
  }
}

export async function getBackgroundQueueSnapshotForUser({
  userId,
  since,
}: {
  userId: string;
  since: Date;
}): Promise<BackgroundQueueSnapshot> {
  try {
    const rows = await db
      .select({
        status: backgroundJob.status,
        updatedAt: backgroundJob.updatedAt,
      })
      .from(backgroundJob)
      .where(
        and(
          eq(backgroundJob.userId, userId),
          gte(backgroundJob.updatedAt, since)
        )
      )
      .orderBy(asc(backgroundJob.updatedAt));

    let pending = 0;
    let running = 0;
    let failedRecent = 0;
    for (const row of rows) {
      if (row.status === "pending") {
        pending += 1;
      } else if (row.status === "running") {
        running += 1;
      } else if (row.status === "failed") {
        failedRecent += 1;
      }
    }

    return {
      pending,
      running,
      failedRecent,
      latestEventAt: rows.length > 0 ? (rows.at(-1)?.updatedAt ?? null) : null,
    };
  } catch (_error) {
    throw new VirgilError(
      "bad_request:database",
      "Failed to read background queue snapshot"
    );
  }
}
