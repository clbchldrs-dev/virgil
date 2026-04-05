import type { ProcessSendJob } from "../jobs/process-send-job.js";
import type { ApprovalStore } from "../store/approval-store.js";
import type { AuditStore } from "../store/audit-store.js";
import { buildOutboundFromDraft } from "./send-gateway.js";

export type ApprovalActions = {
  approveAndSend: (
    id: string
  ) => Promise<
    | { ok: true; outboundId: string }
    | { ok: false; error: "not_found" | "not_pending" | "send_failed" }
  >;
  reject: (
    id: string
  ) => Promise<
    { ok: true } | { ok: false; error: "not_found" | "not_pending" }
  >;
};

export function createApprovalActions(input: {
  approvals: ApprovalStore;
  audit: AuditStore;
  sendJob: ProcessSendJob;
}): ApprovalActions {
  return {
    approveAndSend: async (id) => {
      const pending = input.approvals.get(id);
      if (!pending) {
        return { ok: false, error: "not_found" };
      }
      if (pending.status !== "pending") {
        return { ok: false, error: "not_pending" };
      }
      const approved = input.approvals.approve(id);
      if (!approved) {
        return { ok: false, error: "not_pending" };
      }
      input.audit.append({
        type: "approval.resolved",
        payload: { approvalId: id, status: "approved" },
      });
      const outbound = buildOutboundFromDraft({
        draftText: approved.draft.text,
        channel: approved.draft.channel,
        externalThreadId: approved.draft.externalThreadId,
        sourceApprovalId: id,
        idempotencyKey: `approval:${id}`,
      });
      const sendResult = await input.sendJob.run(outbound);
      if (!sendResult.ok) {
        return { ok: false, error: "send_failed" };
      }
      return { ok: true, outboundId: outbound.id };
    },
    reject: (id) => {
      const pending = input.approvals.get(id);
      if (!pending) {
        return Promise.resolve({ ok: false, error: "not_found" });
      }
      if (pending.status !== "pending") {
        return Promise.resolve({ ok: false, error: "not_pending" });
      }
      const rejected = input.approvals.reject(id);
      if (!rejected) {
        return Promise.resolve({ ok: false, error: "not_pending" });
      }
      input.audit.append({
        type: "approval.resolved",
        payload: { approvalId: id, status: "rejected" },
      });
      return Promise.resolve({ ok: true });
    },
  };
}
