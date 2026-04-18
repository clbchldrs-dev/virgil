import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { handleDigestGet } from "@/lib/reliability/digest-route-handler";

describe("handleDigestGet", () => {
  it("returns 401 when cron auth is invalid", async () => {
    const response = await handleDigestGet(
      new Request("http://localhost/api/digest"),
      {
        cronSecret: "secret",
        appOrigin: "http://localhost:3000",
        now: () => new Date("2026-04-18T00:00:00.000Z"),
        getOwners: async () => [],
        getRecentMemories: async () => [],
        countPendingProposals: async () => 0,
        getProposalMemories: async () => [],
        sendEmail: async () => undefined,
        postSlack: async () => ({ ok: true }),
      }
    );

    assert.equal(response.status, 401);
  });

  it("returns structured summary for owner processing outcomes", async () => {
    const response = await handleDigestGet(
      new Request("http://localhost/api/digest", {
        headers: { authorization: "Bearer secret" },
      }),
      {
        cronSecret: "secret",
        appOrigin: "http://localhost:3000",
        now: () => new Date("2026-04-18T00:00:00.000Z"),
        getOwners: async () => [
          { id: "guest-id", email: "guest-123" },
          { id: "active-id", email: "owner@example.com" },
          { id: "empty-id", email: "quiet@example.com" },
        ],
        getRecentMemories: ({ userId }) => {
          if (userId === "active-id") {
            return Promise.resolve([
              { kind: "note", content: "Captured note" },
            ]);
          }
          return Promise.resolve([]);
        },
        countPendingProposals: async ({ userId }) =>
          userId === "active-id" ? 1 : 0,
        getProposalMemories: async () => [{ content: "Proposal preview" }],
        sendEmail: async () => undefined,
        postSlack: async (body) =>
          body.length > 0 ? { ok: true } : { ok: false, error: "empty" },
      }
    );

    assert.equal(response.status, 200);
    const body = (await response.json()) as {
      summary: Record<string, number>;
      failures: unknown[];
      ok: boolean;
    };
    assert.equal(body.ok, true);
    assert.equal(body.summary.ownersScanned, 3);
    assert.equal(body.summary.guestOwnersSkipped, 1);
    assert.equal(body.summary.ownersProcessed, 1);
    assert.equal(body.summary.ownersSkippedNoData, 1);
    assert.equal(body.summary.emailSent, 1);
    assert.equal(body.summary.slackPosted, 1);
    assert.equal(body.failures.length, 0);
  });

  it("records email/slack/fetch failures in diagnostics", async () => {
    const response = await handleDigestGet(
      new Request("http://localhost/api/digest", {
        headers: { authorization: "Bearer secret" },
      }),
      {
        cronSecret: "secret",
        appOrigin: "http://localhost:3000",
        now: () => new Date("2026-04-18T00:00:00.000Z"),
        getOwners: async () => [
          { id: "fetch-fail", email: "fetch@example.com" },
          { id: "notify-fail", email: "notify@example.com" },
        ],
        getRecentMemories: ({ userId }) => {
          if (userId === "fetch-fail") {
            return Promise.reject(new Error("db_unavailable"));
          }
          return Promise.resolve([{ kind: "note", content: "Has content" }]);
        },
        countPendingProposals: async () => 0,
        getProposalMemories: async () => [],
        sendEmail: () => Promise.reject(new Error("email_down")),
        postSlack: async () => ({ ok: false, error: "slack_down" }),
      }
    );

    assert.equal(response.status, 200);
    const body = (await response.json()) as {
      summary: Record<string, number>;
      failures: Array<{ stage: string; ownerId: string; message: string }>;
    };
    assert.equal(body.summary.ownerFailures, 1);
    assert.equal(body.summary.emailFailures, 1);
    assert.equal(body.summary.slackFailures, 1);
    assert.equal(
      body.failures.some((entry) => entry.stage === "fetch"),
      true
    );
    assert.equal(
      body.failures.some((entry) => entry.stage === "email"),
      true
    );
    assert.equal(
      body.failures.some((entry) => entry.stage === "slack"),
      true
    );
  });
});
