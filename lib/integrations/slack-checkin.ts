/**
 * Optional mirror of the daily digest body to Slack (incoming webhook or chat.postMessage).
 * Failures are non-fatal; callers should log and continue.
 */

const SLACK_TEXT_SAFE_MAX = 3500;

export function truncateSlackCheckinText(text: string): string {
  if (text.length <= SLACK_TEXT_SAFE_MAX) {
    return text;
  }
  return `${text.slice(0, SLACK_TEXT_SAFE_MAX - 1)}…`;
}

export function isSlackDailyCheckinConfigured(): boolean {
  const webhook = process.env.VIRGIL_SLACK_CHECKIN_WEBHOOK_URL?.trim();
  if (webhook) {
    return true;
  }
  const token = process.env.SLACK_BOT_TOKEN?.trim();
  const channel = process.env.VIRGIL_SLACK_CHECKIN_CHANNEL_ID?.trim();
  return Boolean(token && channel);
}

export async function postDailyDigestToSlack(
  text: string
): Promise<
  | { ok: true; skipped: true }
  | { ok: true; skipped: false }
  | { ok: false; error: string }
> {
  if (!isSlackDailyCheckinConfigured()) {
    return { ok: true, skipped: true };
  }

  const payload = truncateSlackCheckinText(text);
  const webhook = process.env.VIRGIL_SLACK_CHECKIN_WEBHOOK_URL?.trim();
  if (webhook) {
    const res = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ text: payload }),
    });
    if (!res.ok) {
      const errBody = await res.text();
      return {
        ok: false,
        error: `webhook ${res.status}: ${errBody.slice(0, 200)}`,
      };
    }
    return { ok: true, skipped: false };
  }

  const token = process.env.SLACK_BOT_TOKEN?.trim();
  const channel = process.env.VIRGIL_SLACK_CHECKIN_CHANNEL_ID?.trim();
  if (!(token && channel)) {
    return { ok: true, skipped: true };
  }

  const res = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({ channel, text: payload }),
  });

  const data = (await res.json()) as { ok?: boolean; error?: string };
  if (!data.ok) {
    return {
      ok: false,
      error: data.error ?? "slack_chat_post_failed",
    };
  }
  return { ok: true, skipped: false };
}
