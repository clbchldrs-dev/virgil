import type { AdapterOverrides } from "./adapters/registry.js";
import { createAdapterRegistry } from "./adapters/registry.js";
import type { DigitalSelfEnv } from "./config.js";
import { loadEnv } from "./config.js";
import { createApprovalActions } from "./core/approval-actions.js";
import { createOrchestrator } from "./core/orchestrator.js";
import { createSendGateway } from "./core/send-gateway.js";
import { createProcessSendJob } from "./jobs/process-send-job.js";
import { createInMemoryApprovalStore } from "./store/approval-store.js";
import { createInMemoryAuditStore } from "./store/audit-store.js";
import { createInMemoryConversationStore } from "./store/conversation-memory.js";
import { createInMemoryDlqStore } from "./store/dlq-store.js";
import { createInMemoryMetricsStore } from "./store/metrics-store.js";
import { createInMemoryReplayStore } from "./store/replay-store.js";

export type ServerContext = {
  env: DigitalSelfEnv;
  orchestrator: ReturnType<typeof createOrchestrator>;
  approvals: ReturnType<typeof createInMemoryApprovalStore>;
  approvalActions: ReturnType<typeof createApprovalActions>;
  audit: ReturnType<typeof createInMemoryAuditStore>;
  metrics: ReturnType<typeof createInMemoryMetricsStore>;
  dlq: ReturnType<typeof createInMemoryDlqStore>;
  replay: ReturnType<typeof createInMemoryReplayStore>;
  sendJob: ReturnType<typeof createProcessSendJob>;
};

export function createServerContext(input?: {
  env?: DigitalSelfEnv;
  adapterOverrides?: AdapterOverrides;
}): ServerContext {
  const env = input?.env ?? loadEnv(process.env);
  const conversation = createInMemoryConversationStore();
  const approvals = createInMemoryApprovalStore();
  const audit = createInMemoryAuditStore();
  const metrics = createInMemoryMetricsStore();
  const dlq = createInMemoryDlqStore();
  const replay = createInMemoryReplayStore();
  const adapters = createAdapterRegistry(input?.adapterOverrides);

  const gateway = createSendGateway({ adapters, audit, dlq, metrics });
  const sendJob = createProcessSendJob(gateway);
  const approvalActions = createApprovalActions({ approvals, audit, sendJob });

  const orchestrator = createOrchestrator({
    env,
    conversation,
    approvals,
    audit,
    metrics,
    sendJob,
  });

  return {
    env,
    orchestrator,
    approvals,
    approvalActions,
    audit,
    metrics,
    dlq,
    replay,
    sendJob,
  };
}
