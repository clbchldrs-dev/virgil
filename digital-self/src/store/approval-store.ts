import { nanoid } from "nanoid";
import type { DraftReply, PendingApproval } from "../core/schemas.js";

export type ApprovalStore = {
  createPending: (draft: DraftReply) => PendingApproval;
  listPending: () => PendingApproval[];
  get: (id: string) => PendingApproval | undefined;
  approve: (id: string) => PendingApproval | undefined;
  reject: (id: string) => PendingApproval | undefined;
};

export function createInMemoryApprovalStore(): ApprovalStore {
  const items = new Map<string, PendingApproval>();

  return {
    createPending: (draft) => {
      const record: PendingApproval = {
        id: nanoid(),
        status: "pending",
        draft,
        createdAt: new Date().toISOString(),
      };
      items.set(record.id, record);
      return record;
    },
    listPending: () =>
      [...items.values()].filter((item) => item.status === "pending"),
    get: (id) => items.get(id),
    approve: (id) => {
      const current = items.get(id);
      if (!current || current.status !== "pending") {
        return undefined;
      }
      const next: PendingApproval = {
        ...current,
        status: "approved",
        resolvedAt: new Date().toISOString(),
      };
      items.set(id, next);
      return next;
    },
    reject: (id) => {
      const current = items.get(id);
      if (!current || current.status !== "pending") {
        return undefined;
      }
      const next: PendingApproval = {
        ...current,
        status: "rejected",
        resolvedAt: new Date().toISOString(),
      };
      items.set(id, next);
      return next;
    },
  };
}
