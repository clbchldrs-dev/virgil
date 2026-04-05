import { Hono } from "hono";
import { z } from "zod";
import { verifySlackSignature } from "./adapters/slack.js";
import { verifyTwilioSignature } from "./adapters/sms.js";
import { verifyWhatsAppSignature } from "./adapters/whatsapp.js";
import { ingestRequestSchema } from "./core/schemas.js";
import type { ServerContext } from "./server-context.js";
import { parseSlackEventPayload } from "./webhooks/slack-parser.js";
import { parseTwilioSmsForm } from "./webhooks/twilio-parser.js";
import { parseWhatsAppWebhookPayload } from "./webhooks/whatsapp-parser.js";

function bearerMatches(header: string | undefined, expected: string): boolean {
  if (!header?.startsWith("Bearer ")) {
    return false;
  }
  return header.slice("Bearer ".length) === expected;
}

function snapshotHeaders(
  getHeader: (name: string) => string | undefined,
  names: string[]
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const name of names) {
    const value = getHeader(name);
    if (value) {
      out[name] = value;
    }
  }
  return out;
}

export function createApp(ctx: ServerContext): Hono {
  const app = new Hono();

  app.get("/health", (c) =>
    c.json({
      ok: true,
      service: "virgil-digital-self",
      metrics: ctx.metrics.snapshot(),
    })
  );

  app.post("/v1/ingest", async (c) => {
    if (
      !bearerMatches(
        c.req.header("authorization"),
        ctx.env.DIGITAL_SELF_INGEST_SECRET
      )
    ) {
      return c.json({ error: "unauthorized" }, 401);
    }
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "invalid json" }, 400);
    }
    const parsed = ingestRequestSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(
        { error: "invalid body", details: parsed.error.flatten() },
        400
      );
    }
    const result = await ctx.orchestrator.ingest(parsed.data);
    return c.json(result);
  });

  app.get("/v1/approvals", (c) => {
    if (
      !bearerMatches(
        c.req.header("authorization"),
        ctx.env.DIGITAL_SELF_SERVICE_TOKEN
      )
    ) {
      return c.json({ error: "unauthorized" }, 401);
    }
    return c.json({ pending: ctx.approvals.listPending() });
  });

  app.patch("/v1/approvals/:id", async (c) => {
    if (
      !bearerMatches(
        c.req.header("authorization"),
        ctx.env.DIGITAL_SELF_SERVICE_TOKEN
      )
    ) {
      return c.json({ error: "unauthorized" }, 401);
    }
    const id = c.req.param("id");
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "invalid json" }, 400);
    }
    const patchBodySchema = z.object({
      action: z.enum(["approve", "reject"]),
    });
    const parsed = patchBodySchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: "invalid body" }, 400);
    }
    if (parsed.data.action === "reject") {
      const res = await ctx.approvalActions.reject(id);
      if (!res.ok) {
        return c.json({ error: res.error }, 404);
      }
      return c.json({ ok: true });
    }
    const res = await ctx.approvalActions.approveAndSend(id);
    if (!res.ok) {
      const status = res.error === "not_found" ? 404 : 409;
      return c.json({ error: res.error }, status);
    }
    return c.json({ ok: true, outboundId: res.outboundId });
  });

  app.get("/v1/audit", (c) => {
    if (
      !bearerMatches(
        c.req.header("authorization"),
        ctx.env.DIGITAL_SELF_SERVICE_TOKEN
      )
    ) {
      return c.json({ error: "unauthorized" }, 401);
    }
    const limit = Number.parseInt(c.req.query("limit") ?? "100", 10);
    const safeLimit = Number.isFinite(limit)
      ? Math.min(500, Math.max(1, limit))
      : 100;
    return c.json({ events: ctx.audit.list(safeLimit) });
  });

  app.get("/v1/metrics", (c) => {
    if (
      !bearerMatches(
        c.req.header("authorization"),
        ctx.env.DIGITAL_SELF_SERVICE_TOKEN
      )
    ) {
      return c.json({ error: "unauthorized" }, 401);
    }
    return c.json(ctx.metrics.snapshot());
  });

  app.get("/v1/dlq", (c) => {
    if (
      !bearerMatches(
        c.req.header("authorization"),
        ctx.env.DIGITAL_SELF_SERVICE_TOKEN
      )
    ) {
      return c.json({ error: "unauthorized" }, 401);
    }
    return c.json({ items: ctx.dlq.list() });
  });

  app.post("/v1/dlq/:id/retry", async (c) => {
    if (
      !bearerMatches(
        c.req.header("authorization"),
        ctx.env.DIGITAL_SELF_SERVICE_TOKEN
      )
    ) {
      return c.json({ error: "unauthorized" }, 401);
    }
    const id = c.req.param("id");
    const item = ctx.dlq.get(id);
    if (!item) {
      return c.json({ error: "not_found" }, 404);
    }
    ctx.dlq.dequeue(id);
    const result = await ctx.sendJob.run(item.message);
    if (!result.ok) {
      ctx.dlq.enqueue({
        message: item.message,
        error: "retry_failed",
        attempts: item.attempts + 1,
      });
      return c.json({ ok: false, error: "send_failed" }, 502);
    }
    return c.json({ ok: true });
  });

  app.post("/v1/replay/:id", async (c) => {
    if (
      !bearerMatches(
        c.req.header("authorization"),
        ctx.env.DIGITAL_SELF_SERVICE_TOKEN
      )
    ) {
      return c.json({ error: "unauthorized" }, 401);
    }
    const id = c.req.param("id");
    const record = ctx.replay.get(id);
    if (!record) {
      return c.json({ error: "not_found" }, 404);
    }
    ctx.audit.append({
      type: "replay.replayed",
      payload: { replayId: id, source: record.source },
    });
    if (record.source === "slack") {
      const parsed = parseSlackEventPayload(record.body);
      if (parsed.kind !== "message") {
        return c.json({ ok: false, reason: parsed.kind }, 400);
      }
      await ctx.orchestrator.ingest({ message: parsed.message });
      return c.json({ ok: true });
    }
    if (record.source === "whatsapp") {
      const parsed = parseWhatsAppWebhookPayload(record.body);
      if (parsed.kind !== "message") {
        return c.json({ ok: false, reason: parsed.kind }, 400);
      }
      await ctx.orchestrator.ingest({ message: parsed.message });
      return c.json({ ok: true });
    }
    if (record.source === "twilio") {
      const params = new URLSearchParams(record.body);
      const parsed = parseTwilioSmsForm(params);
      if (parsed.kind !== "message") {
        return c.json({ ok: false, reason: parsed.kind }, 400);
      }
      await ctx.orchestrator.ingest({ message: parsed.message });
      return c.json({ ok: true });
    }
    return c.json({ error: "unknown_source" }, 400);
  });

  app.post("/webhooks/slack/events", async (c) => {
    const raw = await c.req.text();
    ctx.replay.record({
      source: "slack",
      body: raw,
      headers: snapshotHeaders(c.req.header.bind(c.req), [
        "x-slack-request-timestamp",
        "x-slack-signature",
      ]),
    });
    ctx.audit.append({
      type: "webhook.received",
      payload: { channel: "slack", bytes: raw.length },
    });
    const secret = ctx.env.SLACK_SIGNING_SECRET;
    if (secret) {
      const ts = c.req.header("x-slack-request-timestamp") ?? "";
      const sig = c.req.header("x-slack-signature");
      const ok = verifySlackSignature({
        signingSecret: secret,
        timestamp: ts,
        body: raw,
        signatureHeader: sig,
      });
      if (!ok) {
        return c.text("invalid signature", 401);
      }
    }
    const parsed = parseSlackEventPayload(raw);
    if (parsed.kind === "url_verification") {
      return c.json({ challenge: parsed.challenge });
    }
    if (parsed.kind === "ignored") {
      return c.json({ ok: true, ignored: parsed.reason });
    }
    await ctx.orchestrator.ingest({ message: parsed.message });
    return c.json({ ok: true });
  });

  app.get("/webhooks/whatsapp", (c) => {
    const mode = c.req.query("hub.mode");
    const token = c.req.query("hub.verify_token");
    const challenge = c.req.query("hub.challenge");
    const expected = ctx.env.WHATSAPP_VERIFY_TOKEN;
    if (mode === "subscribe" && expected && token === expected && challenge) {
      return c.text(challenge, 200);
    }
    return c.text("forbidden", 403);
  });

  app.post("/webhooks/whatsapp", async (c) => {
    const raw = await c.req.text();
    ctx.replay.record({
      source: "whatsapp",
      body: raw,
      headers: snapshotHeaders(c.req.header.bind(c.req), [
        "x-hub-signature-256",
      ]),
    });
    ctx.audit.append({
      type: "webhook.received",
      payload: { channel: "whatsapp", bytes: raw.length },
    });
    const appSecret = ctx.env.WHATSAPP_APP_SECRET;
    if (appSecret) {
      const sig = c.req.header("x-hub-signature-256");
      const ok = verifyWhatsAppSignature({
        appSecret,
        body: raw,
        signatureHeader: sig,
      });
      if (!ok) {
        return c.text("invalid signature", 401);
      }
    }
    const parsed = parseWhatsAppWebhookPayload(raw);
    if (parsed.kind === "ignored") {
      return c.json({ ok: true, ignored: parsed.reason });
    }
    await ctx.orchestrator.ingest({ message: parsed.message });
    return c.json({ ok: true });
  });

  app.post("/webhooks/twilio/sms", async (c) => {
    const raw = await c.req.text();
    ctx.replay.record({
      source: "twilio",
      body: raw,
      headers: snapshotHeaders(c.req.header.bind(c.req), [
        "x-twilio-signature",
      ]),
    });
    ctx.audit.append({
      type: "webhook.received",
      payload: { channel: "sms", bytes: raw.length },
    });
    const params = new URLSearchParams(raw);
    const authToken = ctx.env.TWILIO_AUTH_TOKEN;
    if (authToken) {
      const record: Record<string, string> = {};
      for (const [key, value] of params.entries()) {
        record[key] = value;
      }
      const sig = c.req.header("x-twilio-signature");
      const url = new URL(c.req.url);
      url.search = "";
      const ok = verifyTwilioSignature({
        authToken,
        url: url.toString(),
        params: record,
        signatureHeader: sig,
      });
      if (!ok) {
        return c.text("invalid signature", 401);
      }
    }
    const parsed = parseTwilioSmsForm(params);
    if (parsed.kind === "ignored") {
      return c.json({ ok: true, ignored: parsed.reason });
    }
    await ctx.orchestrator.ingest({ message: parsed.message });
    return c.json({ ok: true });
  });

  return app;
}
