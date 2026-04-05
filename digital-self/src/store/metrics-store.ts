export type ServiceMetrics = {
  ingestCount: number;
  autoSendCount: number;
  approvalQueuedCount: number;
  blockedCount: number;
  heldCount: number;
  outboundSuccess: number;
  outboundFailure: number;
  dlqCount: number;
};

export type MetricsStore = {
  snapshot: () => ServiceMetrics;
  increment: (key: keyof ServiceMetrics) => void;
};

export function createInMemoryMetricsStore(): MetricsStore {
  const metrics: ServiceMetrics = {
    ingestCount: 0,
    autoSendCount: 0,
    approvalQueuedCount: 0,
    blockedCount: 0,
    heldCount: 0,
    outboundSuccess: 0,
    outboundFailure: 0,
    dlqCount: 0,
  };

  return {
    snapshot: () => ({ ...metrics }),
    increment: (key) => {
      metrics[key] += 1;
    },
  };
}
