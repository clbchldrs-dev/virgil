import { Resend } from "resend";
import { Webhook } from "svix";
import { saveMemoryRecord } from "@/lib/db/queries";
import { isVirgilEmailIngestEnabled } from "@/lib/virgil/integrations";

type EmailReceivedEvent = {
  type?: string;
  data?: {
    email_id?: string;
    from?: string;
    subject?: string;
  };
};

function extractEmail(fromHeader: string): string | null {
  const angle = fromHeader.match(/<([^>]+)>/);
  if (angle?.[1]) {
    return angle[1].trim().toLowerCase();
  }
  const t = fromHeader.trim().toLowerCase();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) {
    return t;
  }
  return null;
}

function parseAllowlist(raw: string | undefined): Set<string> {
  return new Set(
    (raw ?? "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
  );
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function truncate(s: string, max: number): string {
  if (s.length <= max) {
    return s;
  }
  return `${s.slice(0, max - 1)}…`;
}

type ReceivedEmailBody = {
  text?: string | null;
  html?: string | null;
  from?: string;
  subject?: string;
};

async function fetchReceivedEmailBody(
  emailId: string
): Promise<ReceivedEmailBody | null> {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) {
    return null;
  }
  const res = await fetch(
    `https://api.resend.com/emails/receiving/${encodeURIComponent(emailId)}`,
    {
      headers: { Authorization: `Bearer ${key}` },
    }
  );
  if (!res.ok) {
    return null;
  }
  return (await res.json()) as ReceivedEmailBody;
}

async function maybeSendIngestConfirmation(params: {
  toEmail: string;
  subjectLine: string;
}) {
  if (process.env.NIGHT_REVIEW_EMAIL_ON_FINDINGS !== "1") {
    return;
  }
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    return;
  }
  try {
    const resend = new Resend(apiKey);
    await resend.emails.send({
      from: "Virgil <onboarding@resend.dev>",
      to: params.toEmail,
      subject: "Virgil saved your email",
      text: `Saved to memory (subject: ${params.subjectLine.slice(0, 200)}).`,
    });
  } catch (e) {
    console.error("Email ingest confirmation failed:", e);
  }
}

/**
 * Resend inbound: webhook event `email.received` (configure in Resend dashboard).
 * Verifies Svix signature (`RESEND_WEBHOOK_SECRET`), loads body via Receiving API, allowlists `from`.
 * Writes to `Memory` for `VIRGIL_INGEST_USER_ID` (same single-owner id as `POST /api/ingest`).
 */
export async function POST(request: Request) {
  if (!isVirgilEmailIngestEnabled()) {
    return Response.json({ error: "email_ingest_disabled" }, { status: 403 });
  }

  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET?.trim();
  const userId = process.env.VIRGIL_INGEST_USER_ID?.trim();
  if (!webhookSecret || !userId) {
    return Response.json(
      { error: "email_ingest_misconfigured" },
      { status: 500 }
    );
  }

  const payload = await request.text();
  const svixId = request.headers.get("svix-id");
  const svixTimestamp = request.headers.get("svix-timestamp");
  const svixSignature = request.headers.get("svix-signature");
  if (!svixId || !svixTimestamp || !svixSignature) {
    return Response.json({ error: "missing_svix_headers" }, { status: 400 });
  }

  let evt: unknown;
  try {
    const wh = new Webhook(webhookSecret);
    evt = wh.verify(payload, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    });
  } catch {
    return Response.json({ error: "invalid_signature" }, { status: 400 });
  }

  const event = evt as EmailReceivedEvent;
  if (event.type !== "email.received") {
    return Response.json({ ok: true, ignored: true });
  }

  const emailId = event.data?.email_id;
  if (!emailId) {
    return Response.json({ error: "missing_email_id" }, { status: 400 });
  }

  const metaFrom = event.data?.from ?? "";
  const fromEmail = extractEmail(metaFrom);
  if (!fromEmail) {
    return Response.json({ error: "unparseable_from" }, { status: 400 });
  }

  const allow = parseAllowlist(process.env.VIRGIL_EMAIL_INGEST_ALLOWED_FROM);
  if (allow.size === 0 || !allow.has(fromEmail)) {
    return Response.json({ error: "from_not_allowed" }, { status: 403 });
  }

  const full = await fetchReceivedEmailBody(emailId);
  if (!full) {
    return Response.json({ error: "email_body_fetch_failed" }, { status: 502 });
  }

  const subject =
    (full.subject ?? event.data?.subject ?? "").trim() || "(no subject)";
  const textBody = (full.text ?? "").trim();
  const stripped = textBody.length > 0 ? textBody : stripHtml(full.html ?? "");
  const body = truncate(`${subject}\n${stripped}`.trim(), 4000);

  await saveMemoryRecord({
    userId,
    kind: "note",
    content: body,
    metadata: { source: "email", from: fromEmail, subject },
  });

  await maybeSendIngestConfirmation({
    toEmail: fromEmail,
    subjectLine: subject,
  });

  return Response.json({ ok: true });
}
