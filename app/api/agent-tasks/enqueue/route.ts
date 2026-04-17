import { NextResponse } from "next/server";
import { isAgentTaskTriageEnabled } from "@/lib/agent-tasks/config";
import { getQStashPublishClient } from "@/lib/qstash/publish-client";

function getBaseUrl(): string {
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  if (!isAgentTaskTriageEnabled()) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: "disabled",
    });
  }

  const qstashToken = process.env.QSTASH_TOKEN;
  if (!qstashToken) {
    return NextResponse.json(
      { ok: false, error: "QSTASH_TOKEN is not set" },
      { status: 500 }
    );
  }

  const qstash = getQStashPublishClient();
  const base = getBaseUrl();

  await qstash.publishJSON({
    url: `${base}/api/agent-tasks/triage`,
    body: { trigger: "cron" },
  });

  return NextResponse.json({ ok: true, enqueued: true });
}
