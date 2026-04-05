import "server-only";

import {
  and,
  asc,
  count,
  desc,
  eq,
  type InferInsertModel,
  inArray,
} from "drizzle-orm";
import { computeWallTimeMetrics } from "@/lib/background-jobs/wall-time-metrics";
import { VirgilError } from "@/lib/errors";
import { db } from "../client";
import {
  type BackgroundJob,
  backgroundJob,
  backgroundJobAudit,
} from "../schema";

type BackgroundJobInsert = InferInsertModel<typeof backgroundJob>;

const TERMINAL_STATUSES = ["completed", "failed", "cancelled"] as const;

function isTerminalStatus(status: string): boolean {
  return (TERMINAL_STATUSES as readonly string[]).includes(status);
}

export async function logJobAudit(
  jobId: string,
  userId: string,
  oldStatus: string,
  newStatus: string,
  actor = "system",
  reason = ""
): Promise<void> {
  try {
    await db.insert(backgroundJobAudit).values({
      jobId,
      userId,
      oldStatus,
      newStatus,
      actor,
      reason: reason || null,
    });
  } catch (_error) {
    throw new VirgilError("bad_request:database", "Failed to log job audit");
  }
}

export async function createJob(
  userId: string,
  kind: string,
  input: Record<string, unknown>
): Promise<BackgroundJob> {
  try {
    const [row] = await db
      .insert(backgroundJob)
      .values({
        userId,
        kind,
        input,
        status: "pending",
      })
      .returning();
    if (!row) {
      throw new VirgilError("bad_request:database", "Failed to create job");
    }
    return row;
  } catch (error) {
    if (error instanceof VirgilError) {
      throw error;
    }
    throw new VirgilError("bad_request:database", "Failed to create job");
  }
}

export async function getJob(jobId: string): Promise<BackgroundJob | null> {
  return await getBackgroundJobById(jobId);
}

export async function listUserJobs(
  userId: string,
  status?: string
): Promise<BackgroundJob[]> {
  try {
    const whereClause = status
      ? and(
          eq(backgroundJob.userId, userId),
          eq(backgroundJob.status, status as BackgroundJob["status"])
        )
      : eq(backgroundJob.userId, userId);
    return await db
      .select()
      .from(backgroundJob)
      .where(whereClause)
      .orderBy(desc(backgroundJob.createdAt));
  } catch (_error) {
    throw new VirgilError("bad_request:database", "Failed to list jobs");
  }
}

export async function updateJobStatus(
  jobId: string,
  newStatus: string,
  reason = "",
  updates?: {
    wallTimeMs?: number;
    result?: Record<string, unknown>;
    error?: string;
    proposalCount?: number;
    retryIncrement?: boolean;
  }
): Promise<void> {
  const existing = await getBackgroundJobById(jobId);
  if (!existing) {
    throw new VirgilError("bad_request:database", "Job not found");
  }
  const oldStatus = existing.status;
  const now = new Date();

  const setPayload: Partial<BackgroundJobInsert> = {
    status: newStatus as BackgroundJobInsert["status"],
    updatedAt: now,
  };

  if (updates?.retryIncrement) {
    setPayload.retryCount = existing.retryCount + 1;
  }
  if (updates?.wallTimeMs !== undefined) {
    setPayload.wallTimeMs = updates.wallTimeMs;
  }
  if (updates?.result !== undefined) {
    setPayload.result = updates.result;
  }
  if (updates?.error !== undefined) {
    setPayload.error = updates.error;
  }
  if (updates?.proposalCount !== undefined) {
    setPayload.proposalCount = updates.proposalCount;
  }

  if (newStatus === "running" && !existing.startedAt) {
    setPayload.startedAt = now;
  }

  if (isTerminalStatus(newStatus)) {
    setPayload.completedAt = now;
  }

  if (newStatus === "completed") {
    setPayload.error = null;
  }

  try {
    await db
      .update(backgroundJob)
      .set(setPayload)
      .where(eq(backgroundJob.id, jobId));
    await logJobAudit(
      jobId,
      existing.userId,
      oldStatus,
      newStatus,
      "system",
      reason
    );
  } catch (_error) {
    throw new VirgilError("bad_request:database", "Failed to update job");
  }
}

export async function cancelJob(jobId: string): Promise<void> {
  const existing = await getBackgroundJobById(jobId);
  if (!existing) {
    throw new VirgilError("bad_request:database", "Job not found");
  }
  const now = new Date();
  try {
    const [row] = await db
      .update(backgroundJob)
      .set({
        status: "cancelled",
        completedAt: now,
        updatedAt: now,
      })
      .where(
        and(eq(backgroundJob.id, jobId), eq(backgroundJob.status, "pending"))
      )
      .returning();
    if (!row) {
      throw new VirgilError("bad_request:database", "Job is not pending");
    }
    await logJobAudit(
      jobId,
      row.userId,
      "pending",
      "cancelled",
      "system",
      "Cancelled by user"
    );
  } catch (error) {
    if (error instanceof VirgilError) {
      throw error;
    }
    throw new VirgilError("bad_request:database", "Failed to cancel job");
  }
}

export async function getJobAuditTrail(jobId: string): Promise<
  Array<{
    oldStatus: string;
    newStatus: string;
    actor: string;
    reason: string | null;
    createdAt: Date;
  }>
> {
  try {
    const rows = await db
      .select({
        oldStatus: backgroundJobAudit.oldStatus,
        newStatus: backgroundJobAudit.newStatus,
        actor: backgroundJobAudit.actor,
        reason: backgroundJobAudit.reason,
        createdAt: backgroundJobAudit.createdAt,
      })
      .from(backgroundJobAudit)
      .where(eq(backgroundJobAudit.jobId, jobId))
      .orderBy(asc(backgroundJobAudit.createdAt));
    return rows;
  } catch (_error) {
    throw new VirgilError("bad_request:database", "Failed to load job audit");
  }
}

export async function getJobMetrics(kind: string): Promise<{
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  meanMs: number;
  sampleCount: number;
  successRate: number;
}> {
  try {
    const rows = await db
      .select({
        wallTimeMs: backgroundJob.wallTimeMs,
        status: backgroundJob.status,
      })
      .from(backgroundJob)
      .where(
        and(
          eq(backgroundJob.kind, kind),
          inArray(backgroundJob.status, ["completed", "failed"])
        )
      );

    const completed = rows.filter((r) => r.status === "completed");
    const failed = rows.filter((r) => r.status === "failed");
    const wallTimes = completed
      .map((r) => r.wallTimeMs)
      .filter((v): v is number => typeof v === "number" && Number.isFinite(v));

    const { p50Ms, p95Ms, p99Ms, meanMs } = computeWallTimeMetrics(wallTimes);
    const denom = completed.length + failed.length;
    const successRate = denom === 0 ? 1 : completed.length / denom;

    return {
      p50Ms,
      p95Ms,
      p99Ms,
      meanMs,
      sampleCount: wallTimes.length,
      successRate,
    };
  } catch (_error) {
    throw new VirgilError(
      "bad_request:database",
      "Failed to compute job metrics"
    );
  }
}

export async function listDistinctJobKinds(): Promise<string[]> {
  try {
    const rows = await db
      .selectDistinct({ kind: backgroundJob.kind })
      .from(backgroundJob);
    return rows.map((r) => r.kind);
  } catch (_error) {
    throw new VirgilError("bad_request:database", "Failed to list job kinds");
  }
}

export function insertBackgroundJob({
  userId,
  kind,
  input,
}: {
  userId: string;
  kind: string;
  input: Record<string, unknown>;
}): Promise<BackgroundJob> {
  return createJob(userId, kind, input);
}

export async function getBackgroundJobForUser({
  id,
  userId,
}: {
  id: string;
  userId: string;
}): Promise<BackgroundJob | null> {
  try {
    const [row] = await db
      .select()
      .from(backgroundJob)
      .where(and(eq(backgroundJob.id, id), eq(backgroundJob.userId, userId)))
      .limit(1);
    return row ?? null;
  } catch (_error) {
    throw new VirgilError("bad_request:database", "Failed to load job");
  }
}

/** Loads by id only — for signed worker invocations after verify. */
export async function getBackgroundJobById(
  id: string
): Promise<BackgroundJob | null> {
  try {
    const [row] = await db
      .select()
      .from(backgroundJob)
      .where(eq(backgroundJob.id, id))
      .limit(1);
    return row ?? null;
  } catch (_error) {
    throw new VirgilError("bad_request:database", "Failed to load job");
  }
}

export async function listBackgroundJobsForUser({
  userId,
  limit = 30,
}: {
  userId: string;
  limit?: number;
}): Promise<BackgroundJob[]> {
  try {
    return await db
      .select()
      .from(backgroundJob)
      .where(eq(backgroundJob.userId, userId))
      .orderBy(desc(backgroundJob.createdAt))
      .limit(Math.min(limit, 100));
  } catch (_error) {
    throw new VirgilError("bad_request:database", "Failed to list jobs");
  }
}

const ACTIVE_JOB_STATUSES = ["pending", "running", "approving"] as const;

/** Jobs still in flight (queued, running, or awaiting approval). */
export async function countActiveBackgroundJobsForUser({
  userId,
}: {
  userId: string;
}): Promise<number> {
  try {
    const [row] = await db
      .select({ c: count() })
      .from(backgroundJob)
      .where(
        and(
          eq(backgroundJob.userId, userId),
          inArray(backgroundJob.status, [...ACTIVE_JOB_STATUSES])
        )
      );
    return Number(row?.c ?? 0);
  } catch (_error) {
    throw new VirgilError(
      "bad_request:database",
      "Failed to count active background jobs"
    );
  }
}

/**
 * Moves pending → running. Returns the row if this invocation won the race.
 */
export async function claimBackgroundJob(
  id: string
): Promise<BackgroundJob | null> {
  try {
    const [row] = await db
      .update(backgroundJob)
      .set({
        status: "running",
        startedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(backgroundJob.id, id), eq(backgroundJob.status, "pending")))
      .returning();
    if (row) {
      await logJobAudit(
        id,
        row.userId,
        "pending",
        "running",
        "system",
        "Claimed"
      );
    }
    return row ?? null;
  } catch (_error) {
    throw new VirgilError("bad_request:database", "Failed to claim job");
  }
}

export async function completeBackgroundJob({
  id,
  result,
  wallTimeMs,
  proposalCount,
}: {
  id: string;
  result: Record<string, unknown>;
  wallTimeMs?: number;
  proposalCount?: number;
}): Promise<void> {
  try {
    await updateJobStatus(id, "completed", "Completed successfully", {
      result,
      wallTimeMs,
      proposalCount,
    });
  } catch (error) {
    if (error instanceof VirgilError) {
      throw error;
    }
    throw new VirgilError("bad_request:database", "Failed to complete job");
  }
}

export async function failBackgroundJob({
  id,
  message,
  wallTimeMs,
}: {
  id: string;
  message: string;
  wallTimeMs?: number;
}): Promise<void> {
  try {
    await updateJobStatus(id, "failed", message, {
      error: message,
      wallTimeMs,
    });
  } catch (error) {
    if (error instanceof VirgilError) {
      throw error;
    }
    throw new VirgilError("bad_request:database", "Failed to fail job");
  }
}
