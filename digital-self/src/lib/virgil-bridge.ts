import type { DigitalSelfEnv } from "../config.js";
import type { PendingApproval } from "../core/schemas.js";

export async function notifyVirgilApprovalQueued(input: {
  env: DigitalSelfEnv;
  approval: PendingApproval;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const url = input.env.VIRGIL_BRIDGE_WEBHOOK_URL;
  const secret = input.env.VIRGIL_BRIDGE_WEBHOOK_SECRET;
  if (!url || !secret) {
    return { ok: true };
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({
        type: "digital-self.approval.queued",
        approvalId: input.approval.id,
        channel: input.approval.draft.channel,
        threadId: input.approval.draft.externalThreadId,
        preview: input.approval.draft.text.slice(0, 280),
      }),
    });
    if (!response.ok) {
      return { ok: false, error: `Bridge HTTP ${response.status}` };
    }
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    return { ok: false, error: message };
  }
}
