import assert from "node:assert/strict";
import { test } from "node:test";
import type { DigitalSelfEnv } from "../src/config.js";
import { createServerContext } from "../src/server-context.js";

const testEnv: DigitalSelfEnv = {
  PORT: 8790,
  DIGITAL_SELF_INGEST_SECRET: "ingest-secret-12345678",
  DIGITAL_SELF_SERVICE_TOKEN: "service-secret-12345678",
  SLACK_SIGNING_SECRET: undefined,
  WHATSAPP_APP_SECRET: undefined,
  WHATSAPP_VERIFY_TOKEN: undefined,
  TWILIO_AUTH_TOKEN: undefined,
  VIRGIL_BRIDGE_WEBHOOK_URL: undefined,
  VIRGIL_BRIDGE_WEBHOOK_SECRET: undefined,
};

const failingSend = () =>
  Promise.resolve({
    ok: false as const,
    error: "simulated_failure",
  });

test("autopilot auto-send enqueue hits DLQ when adapter keeps failing", async () => {
  const ctx = createServerContext({
    env: testEnv,
    adapterOverrides: {
      slack: { channel: "slack", send: failingSend },
      whatsapp: { channel: "whatsapp", send: failingSend },
      sms: { channel: "sms", send: failingSend },
    },
  });

  const result = await ctx.orchestrator.ingest({
    message: {
      channel: "slack",
      externalThreadId: "C123",
      externalMessageId: "1.0",
      senderId: "U1",
      bodyText: "ok",
      receivedAt: new Date().toISOString(),
    },
    ownerTrustTier: "trusted",
    mode: "autopilot-lite",
  });

  assert.equal(result.route, "auto");
  const dlq = ctx.dlq.list();
  assert.equal(dlq.length, 1);
  assert.equal(dlq[0]?.error, "simulated_failure");
});

test("assistant mode queues approval for unknown sender", async () => {
  const ctx = createServerContext({ env: testEnv });
  const result = await ctx.orchestrator.ingest({
    message: {
      channel: "slack",
      externalThreadId: "C999",
      externalMessageId: "2.0",
      senderId: "U9",
      bodyText: "Need your input on the roadmap priorities.",
      receivedAt: new Date().toISOString(),
    },
    mode: "assistant",
    ownerTrustTier: "unknown",
  });

  assert.equal(result.route, "approval");
  assert.ok(result.approvalId);
  assert.equal(ctx.approvals.listPending().length, 1);
});

test("approveAndSend invokes adapter", async () => {
  let sendCount = 0;
  const ctx = createServerContext({
    env: testEnv,
    adapterOverrides: {
      slack: {
        channel: "slack",
        send: () => {
          sendCount += 1;
          return Promise.resolve({
            ok: true as const,
            providerMessageId: "x",
          });
        },
      },
      whatsapp: { channel: "whatsapp", send: failingSend },
      sms: { channel: "sms", send: failingSend },
    },
  });

  const ingestResult = await ctx.orchestrator.ingest({
    message: {
      channel: "slack",
      externalThreadId: "C777",
      externalMessageId: "3.0",
      senderId: "U7",
      bodyText: "Longer question that should not auto-send in assistant mode.",
      receivedAt: new Date().toISOString(),
    },
    mode: "assistant",
    ownerTrustTier: "trusted",
  });

  assert.equal(ingestResult.route, "approval");
  const approvalId = ingestResult.approvalId;
  assert.ok(approvalId);

  const approved = await ctx.approvalActions.approveAndSend(approvalId);
  assert.equal(approved.ok, true);
  assert.equal(sendCount, 1);
});
