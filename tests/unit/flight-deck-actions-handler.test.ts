import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { handleRunDigestAction } from "@/lib/reliability/flight-deck-actions-handler";

function buildRequest(headers: Record<string, string>) {
  return new Request("http://localhost/api/flight-deck/actions/digest", {
    method: "POST",
    headers,
  });
}

describe("handleRunDigestAction", () => {
  it("rejects non-operator roles", async () => {
    const response = await handleRunDigestAction(
      buildRequest({
        origin: "http://localhost",
        "x-idempotency-key": "req-1",
        "x-flightdeck-action-token": "token-token-token-1",
      }),
      {
        now: () => new Date("2026-04-18T12:00:00.000Z"),
        isAllowedRole: () => false,
        getActionByRequestId: async () => null,
        getActionByToken: async () => null,
        hasInProgressAction: async () => false,
        getLatestAction: async () => null,
        insertActionStart: async () => undefined,
        updateActionStatus: async () => undefined,
        executeDigest: async () => ({ ok: true, message: "ok" }),
      },
      {
        userId: "user-1",
        role: "user",
        requestOrigin: "http://localhost",
      }
    );

    assert.equal(response.status, 403);
  });

  it("returns 409 when a recent action is already in progress", async () => {
    const response = await handleRunDigestAction(
      buildRequest({
        origin: "http://localhost",
        "x-idempotency-key": "req-2",
        "x-flightdeck-action-token": "token-token-token-2",
      }),
      {
        now: () => new Date("2026-04-18T12:00:00.000Z"),
        isAllowedRole: () => true,
        getActionByRequestId: async () => null,
        getActionByToken: async () => null,
        hasInProgressAction: async () => true,
        getLatestAction: async () => null,
        insertActionStart: async () => undefined,
        updateActionStatus: async () => undefined,
        executeDigest: async () => ({ ok: true, message: "ok" }),
      },
      {
        userId: "user-1",
        role: "operator",
        requestOrigin: "http://localhost",
      }
    );

    assert.equal(response.status, 409);
  });

  it("records success and returns request id", async () => {
    const transitions: string[] = [];
    const response = await handleRunDigestAction(
      buildRequest({
        origin: "http://localhost",
        "x-idempotency-key": "req-3",
        "x-flightdeck-action-token": "token-token-token-3",
      }),
      {
        now: () => new Date("2026-04-18T12:00:00.000Z"),
        isAllowedRole: () => true,
        getActionByRequestId: async () => null,
        getActionByToken: async () => null,
        hasInProgressAction: async () => false,
        getLatestAction: async () => null,
        insertActionStart: async () => {
          await Promise.resolve();
          transitions.push("started");
        },
        updateActionStatus: async ({ status }) => {
          await Promise.resolve();
          transitions.push(status);
        },
        executeDigest: async () => ({
          ok: true,
          message: "Digest run completed.",
          details: { sent: 2 },
        }),
      },
      {
        userId: "user-1",
        role: "admin",
        requestOrigin: "http://localhost",
      }
    );

    assert.equal(response.status, 200);
    const payload = (await response.json()) as {
      ok: boolean;
      requestId: string;
      message: string;
    };
    assert.equal(payload.ok, true);
    assert.equal(payload.requestId, "req-3");
    assert.deepEqual(transitions, ["started", "completed"]);
  });
});
