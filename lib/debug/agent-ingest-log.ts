import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { ChatMessage } from "@/lib/types";

const DEBUG_INGEST =
  "http://127.0.0.1:7838/ingest/7925a257-7797-4a8d-9c5b-1a308b2155f1";
const DEBUG_SESSION = "2f5d3d";
const DEBUG_SESSION_308EF5 = "308ef5";

const TRIM_MARKER_SUB = "[earlier conversation trimmed]";

type IngestPayload = {
  location: string;
  message: string;
  hypothesisId: string;
  data: Record<string, unknown>;
};

/** Debug-mode NDJSON ingest (session 2f5d3d). No secrets / PII. */
export function agentIngestLog(payload: IngestPayload): void {
  if (process.env.NODE_ENV === "production") {
    return;
  }
  fetch(DEBUG_INGEST, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": DEBUG_SESSION,
    },
    body: JSON.stringify({
      sessionId: DEBUG_SESSION,
      timestamp: Date.now(),
      ...payload,
    }),
  }).catch(() => {
    /* debug ingest is fire-and-forget */
  });
}

type IngestPayload308ef5 = IngestPayload & { runId?: string };

/** Debug session 308ef5: ingest + append `.cursor/debug-308ef5.log` (recallMemory / FTS). */
export function agentIngestLogSession308ef5(
  payload: IngestPayload308ef5
): void {
  if (process.env.NODE_ENV === "production") {
    return;
  }
  const bodyObj = {
    sessionId: DEBUG_SESSION_308EF5,
    timestamp: Date.now(),
    runId: payload.runId ?? "verify",
    location: payload.location,
    message: payload.message,
    hypothesisId: payload.hypothesisId,
    data: payload.data,
  };
  const line = JSON.stringify(bodyObj);
  fetch(DEBUG_INGEST, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": DEBUG_SESSION_308EF5,
    },
    body: line,
  }).catch(() => {
    /* debug ingest is fire-and-forget */
  });
  try {
    const dir = join(process.cwd(), ".cursor");
    mkdirSync(dir, { recursive: true });
    appendFileSync(join(dir, `debug-${DEBUG_SESSION_308EF5}.log`), `${line}\n`);
  } catch {
    /* local log is optional */
  }
}

type LocalContextMessage = { role: string; content: unknown };

function contentHasTrimMarker(content: unknown): boolean {
  if (typeof content === "string") {
    return content.includes(TRIM_MARKER_SUB);
  }
  if (!Array.isArray(content)) {
    return false;
  }
  for (const part of content) {
    if (
      typeof part === "object" &&
      part !== null &&
      "text" in part &&
      typeof (part as { text?: string }).text === "string" &&
      (part as { text: string }).text.includes(TRIM_MARKER_SUB)
    ) {
      return true;
    }
  }
  return false;
}

/** Summarize tool-related UI parts for MissingToolResults debugging (no message bodies). */
export function summarizeUiMessagesToolState(messages: ChatMessage[]): {
  messageCount: number;
  roleCounts: Record<string, number>;
  toolPartsSample: Array<{
    messageRole: string;
    partType: string;
    toolCallId?: string;
    state?: string;
  }>;
  pendingToolCallIds: string[];
} {
  const roleCounts: Record<string, number> = {};
  const toolPartsSample: Array<{
    messageRole: string;
    partType: string;
    toolCallId?: string;
    state?: string;
  }> = [];
  const pendingToolCallIds: string[] = [];

  for (const m of messages) {
    roleCounts[m.role] = (roleCounts[m.role] ?? 0) + 1;
    if (!m.parts) {
      continue;
    }
    if (m.role !== "assistant") {
      continue;
    }
    for (const part of m.parts) {
      const p = part as Record<string, unknown>;
      const partType = typeof p.type === "string" ? p.type : "";
      if (!partType.startsWith("tool-")) {
        continue;
      }
      const toolCallId =
        typeof p.toolCallId === "string" ? p.toolCallId : undefined;
      const state = typeof p.state === "string" ? p.state : "";
      if (toolPartsSample.length < 24) {
        toolPartsSample.push({
          messageRole: m.role,
          partType,
          toolCallId,
          state: state || undefined,
        });
      }
      if (
        toolCallId &&
        state !== "output-available" &&
        state !== "output-error" &&
        state !== "approval-responded"
      ) {
        pendingToolCallIds.push(toolCallId);
      }
    }
  }

  return {
    messageCount: messages.length,
    roleCounts,
    toolPartsSample,
    pendingToolCallIds,
  };
}

export function summarizeModelMessageRoles(messages: LocalContextMessage[]): {
  roles: string[];
  hasTrimMarker: boolean;
} {
  const roles = messages.map((m) => m.role);
  const hasTrimMarker = messages.some(
    (m) => m.role === "user" && contentHasTrimMarker(m.content)
  );
  return { roles, hasTrimMarker };
}
