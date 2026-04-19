import type { UserRole } from "@/app/(auth)/auth";

type ActionStatus = "started" | "completed" | "failed" | "blocked";
const FLIGHT_DECK_ACTION_RUN_DIGEST = "run_digest";

type ExistingAction = {
  requestId: string;
  status: ActionStatus;
  createdAt: Date;
  completedAt: Date | null;
};

type DigestExecutionResult = {
  ok: boolean;
  message: string;
  details?: Record<string, unknown>;
};

export type FlightDeckDigestActionDeps = {
  now: () => Date;
  isAllowedRole: (role: UserRole) => boolean;
  getActionByRequestId: (input: {
    userId: string;
    action: string;
    requestId: string;
  }) => Promise<ExistingAction | null>;
  getActionByToken: (input: {
    userId: string;
    action: string;
    actionToken: string;
  }) => Promise<ExistingAction | null>;
  hasInProgressAction: (input: {
    userId: string;
    action: string;
    since: Date;
  }) => Promise<boolean>;
  getLatestAction: (input: {
    userId: string;
    action: string;
  }) => Promise<ExistingAction | null>;
  insertActionStart: (input: {
    userId: string;
    action: string;
    requestId: string;
    actionToken: string;
    metadata?: Record<string, unknown>;
  }) => Promise<void>;
  updateActionStatus: (input: {
    userId: string;
    action: string;
    requestId: string;
    status: ActionStatus;
    reason?: string;
    metadata?: Record<string, unknown>;
  }) => Promise<void>;
  executeDigest: () => Promise<DigestExecutionResult>;
  cooldownMs?: number;
  inFlightWindowMs?: number;
};

function resolveRequestOrigin(request: Request): string | null {
  const origin = request.headers.get("origin");
  if (origin) {
    return origin;
  }
  const referer = request.headers.get("referer");
  if (!referer) {
    return null;
  }
  try {
    return new URL(referer).origin;
  } catch {
    return null;
  }
}

function isRecent(timestamp: Date, now: Date, windowMs: number): boolean {
  return now.getTime() - timestamp.getTime() <= windowMs;
}

export async function handleRunDigestAction(
  request: Request,
  deps: FlightDeckDigestActionDeps,
  input: {
    userId: string;
    role: UserRole;
    requestOrigin: string;
  }
): Promise<Response> {
  if (!deps.isAllowedRole(input.role)) {
    return Response.json(
      { ok: false, error: "forbidden", message: "Operator role required." },
      { status: 403 }
    );
  }

  const resolvedOrigin = resolveRequestOrigin(request);
  if (!resolvedOrigin || resolvedOrigin !== input.requestOrigin) {
    return Response.json(
      { ok: false, error: "invalid_origin", message: "Invalid action origin." },
      { status: 403 }
    );
  }

  const requestId = request.headers.get("x-idempotency-key")?.trim();
  if (!requestId) {
    return Response.json(
      {
        ok: false,
        error: "missing_idempotency_key",
        message: "Missing idempotency key.",
      },
      { status: 400 }
    );
  }

  const actionToken = request.headers.get("x-flightdeck-action-token")?.trim();
  if (!actionToken || actionToken.length < 16) {
    return Response.json(
      {
        ok: false,
        error: "invalid_action_token",
        message: "Action token is missing or invalid.",
      },
      { status: 400 }
    );
  }

  const action = FLIGHT_DECK_ACTION_RUN_DIGEST;
  const now = deps.now();
  const cooldownMs = deps.cooldownMs ?? 60_000;
  const inFlightWindowMs = deps.inFlightWindowMs ?? 5 * 60_000;

  const existingByRequest = await deps.getActionByRequestId({
    userId: input.userId,
    action,
    requestId,
  });
  if (existingByRequest) {
    const isCompleted = existingByRequest.status === "completed";
    return Response.json(
      {
        ok: isCompleted,
        requestId,
        message: isCompleted
          ? "Digest action already completed for this request."
          : "Digest action is already in progress or finished for this request.",
      },
      { status: isCompleted ? 200 : 409 }
    );
  }

  const existingByToken = await deps.getActionByToken({
    userId: input.userId,
    action,
    actionToken,
  });
  if (existingByToken) {
    return Response.json(
      {
        ok: false,
        error: "replayed_action_token",
        message: "This action token was already used.",
      },
      { status: 409 }
    );
  }

  const hasInProgress = await deps.hasInProgressAction({
    userId: input.userId,
    action,
    since: new Date(now.getTime() - inFlightWindowMs),
  });
  if (hasInProgress) {
    return Response.json(
      {
        ok: false,
        error: "action_in_progress",
        message: "Another digest action is still running.",
      },
      { status: 409 }
    );
  }

  const latest = await deps.getLatestAction({
    userId: input.userId,
    action,
  });
  if (
    latest &&
    latest.status === "completed" &&
    isRecent(latest.createdAt, now, cooldownMs)
  ) {
    return Response.json(
      {
        ok: false,
        error: "action_cooldown",
        message: "Digest action is in cooldown. Try again shortly.",
      },
      { status: 429 }
    );
  }

  await deps.insertActionStart({
    userId: input.userId,
    action,
    requestId,
    actionToken,
    metadata: {
      origin: resolvedOrigin,
    },
  });

  try {
    const digestResult = await deps.executeDigest();
    if (!digestResult.ok) {
      await deps.updateActionStatus({
        userId: input.userId,
        action,
        requestId,
        status: "failed",
        reason: digestResult.message,
        metadata: digestResult.details,
      });
      return Response.json(
        {
          ok: false,
          error: "digest_failed",
          requestId,
          message: digestResult.message,
          recoveryHint:
            "Use /command-center (Background section) and /night-insights for detailed diagnostics.",
        },
        { status: 502 }
      );
    }

    await deps.updateActionStatus({
      userId: input.userId,
      action,
      requestId,
      status: "completed",
      reason: "Digest action completed",
      metadata: digestResult.details,
    });

    return Response.json(
      {
        ok: true,
        requestId,
        message: digestResult.message,
      },
      { status: 200 }
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Digest action execution failed.";
    await deps.updateActionStatus({
      userId: input.userId,
      action,
      requestId,
      status: "failed",
      reason: message,
    });
    return Response.json(
      {
        ok: false,
        error: "digest_failed",
        requestId,
        message,
        recoveryHint:
          "Check Command center → Background for route and queue diagnostics.",
      },
      { status: 502 }
    );
  }
}
