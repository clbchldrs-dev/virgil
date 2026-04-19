import type { Memory } from "@/lib/db/schema";

export type MemoryBridgeJson = {
  id: string;
  userId: string;
  chatId: string | null;
  kind: Memory["kind"];
  tier: Memory["tier"];
  content: string;
  metadata: Record<string, unknown>;
  proposedAt: string | null;
  approvedAt: string | null;
  appliedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export function serializeMemoryForBridge(row: Memory): MemoryBridgeJson {
  return {
    id: row.id,
    userId: row.userId,
    chatId: row.chatId ?? null,
    kind: row.kind,
    tier: row.tier,
    content: row.content,
    metadata: row.metadata,
    proposedAt: row.proposedAt?.toISOString() ?? null,
    approvedAt: row.approvedAt?.toISOString() ?? null,
    appliedAt: row.appliedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
