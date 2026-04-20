import { normalizeEmbeddingForStorage } from "@/lib/ai/embedding-normalize";
import {
  delegationListSkillNamesUnion,
  delegationPing,
  delegationSendIntent,
  getDelegationProvider,
} from "@/lib/integrations/delegation-provider";
import { isDelegationStrictSkillAllowlist } from "@/lib/integrations/delegation-skill-policy";
import type { ClawIntent } from "@/lib/integrations/openclaw-types";

const DEFAULT_EMBED_SKILL = "wiki-embed";
const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_TEXTS = 16;
const MAX_CHARS_PER_TEXT = 12_000;

export function getDelegationEmbedSkillName(): string {
  const raw = process.env.VIRGIL_DELEGATION_EMBED_SKILL?.trim();
  return raw && raw.length > 0 ? raw : DEFAULT_EMBED_SKILL;
}

export function getDelegationEmbedTimeoutMs(): number {
  const raw = process.env.VIRGIL_DELEGATION_EMBED_TIMEOUT_MS?.trim();
  if (!raw) {
    return DEFAULT_TIMEOUT_MS;
  }
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 3000 || n > 120_000) {
    return DEFAULT_TIMEOUT_MS;
  }
  return n;
}

export function isDelegationEmbedToolEnabled(): boolean {
  const raw = process.env.VIRGIL_DELEGATION_EMBED_ENABLED?.trim().toLowerCase();
  if (raw === "0" || raw === "false" || raw === "off") {
    return false;
  }
  return true;
}

export type DelegationEmbeddingsOk = {
  ok: true;
  embeddings: number[][];
  model?: string;
  backend: "openclaw" | "hermes";
};

export type DelegationEmbeddingsErr = {
  ok: false;
  error: string;
  reason:
    | "validation_failed"
    | "skill_not_advertised"
    | "backend_offline"
    | "execution_failed"
    | "parse_failed";
  errorCode: string;
  retryable: boolean;
  backend: "openclaw" | "hermes";
};

function isRetryableDelegationErrorCode(code: string | undefined): boolean {
  return (
    code === "primary_unreachable" ||
    code === "secondary_unreachable" ||
    code === "both_unreachable"
  );
}

function isNumberArray(value: unknown): value is number[] {
  return (
    Array.isArray(value) &&
    value.every((x) => typeof x === "number" && Number.isFinite(x))
  );
}

export function parseDelegationEmbeddingOutput(
  raw: string | undefined,
  expectedTextCount: number
):
  | { ok: true; embeddings: number[][]; model?: string }
  | { ok: false; error: string } {
  if (!raw || raw.trim().length === 0) {
    return { ok: false, error: "Empty response from delegation backend." };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {
      ok: false,
      error:
        "Delegation response was not valid JSON. Expected an object with an `embeddings` array.",
    };
  }

  let embeddingsUnknown: unknown;
  let model: string | undefined;

  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    const o = parsed as Record<string, unknown>;
    if ("embeddings" in o) {
      embeddingsUnknown = o.embeddings;
    } else if ("embedding" in o && expectedTextCount === 1) {
      embeddingsUnknown = [o.embedding];
    }
    if (typeof o.model === "string") {
      model = o.model;
    }
  } else if (Array.isArray(parsed)) {
    embeddingsUnknown = parsed;
  }

  if (!Array.isArray(embeddingsUnknown)) {
    return {
      ok: false,
      error:
        "JSON must include `embeddings` (array of number arrays) or a single `embedding` when one text is sent.",
    };
  }

  const out: number[][] = [];
  for (const row of embeddingsUnknown) {
    if (!isNumberArray(row)) {
      return {
        ok: false,
        error: "Each embedding must be an array of finite numbers.",
      };
    }
    out.push(normalizeEmbeddingForStorage(row));
  }

  if (out.length !== expectedTextCount) {
    return {
      ok: false,
      error: `Expected ${String(expectedTextCount)} embedding vector(s), got ${String(out.length)}.`,
    };
  }

  return { ok: true, embeddings: out, model };
}

export async function fetchDelegationEmbeddings(
  texts: string[]
): Promise<DelegationEmbeddingsOk | DelegationEmbeddingsErr> {
  const provider = getDelegationProvider();
  const backend = provider.backend;
  const trimmed = texts.map((t) => t.trim()).filter((t) => t.length > 0);
  if (trimmed.length === 0) {
    return {
      ok: false,
      error: "At least one non-empty text is required.",
      reason: "validation_failed",
      errorCode: "invalid_input",
      retryable: false,
      backend,
    };
  }
  if (trimmed.length > MAX_TEXTS) {
    return {
      ok: false,
      error: `At most ${String(MAX_TEXTS)} texts per call.`,
      reason: "validation_failed",
      errorCode: "invalid_input",
      retryable: false,
      backend,
    };
  }
  for (const t of trimmed) {
    if (t.length > MAX_CHARS_PER_TEXT) {
      return {
        ok: false,
        error: `Each text must be at most ${String(MAX_CHARS_PER_TEXT)} characters.`,
        reason: "validation_failed",
        errorCode: "invalid_input",
        retryable: false,
        backend,
      };
    }
  }

  const skill = getDelegationEmbedSkillName();
  if (isDelegationStrictSkillAllowlist()) {
    const skills = await delegationListSkillNamesUnion();
    if (skills.length > 0 && !skills.includes(skill)) {
      return {
        ok: false,
        error: `Delegation backend does not advertise skill "${skill}". Add it on the gateway or set VIRGIL_DELEGATION_EMBED_SKILL to a listed id.`,
        reason: "skill_not_advertised",
        errorCode: "embed_skill_not_advertised",
        retryable: false,
        backend,
      };
    }
  }

  const intent: ClawIntent = {
    skill,
    params: {
      texts: trimmed,
      source: "virgil-embed-tool",
    },
    priority: "normal",
    source: "chat",
    requiresConfirmation: false,
  };

  const online = await delegationPing();
  if (!online) {
    return {
      ok: false,
      error: "Delegation backend is offline.",
      reason: "backend_offline",
      errorCode: "backend_offline",
      retryable: true,
      backend,
    };
  }

  const result = await delegationSendIntent(intent, {
    timeoutMs: getDelegationEmbedTimeoutMs(),
  });

  if (!result.success) {
    const errorCode = result.errorCode ?? "embed_execution_failed";
    return {
      ok: false,
      error: result.error ?? "Delegation request failed.",
      reason: "execution_failed",
      errorCode,
      retryable: isRetryableDelegationErrorCode(result.errorCode),
      backend: result.routedVia ?? backend,
    };
  }

  const parsed = parseDelegationEmbeddingOutput(result.output, trimmed.length);
  if (!parsed.ok) {
    return {
      ok: false,
      error: parsed.error,
      reason: "parse_failed",
      errorCode: "embed_response_invalid",
      retryable: false,
      backend: result.routedVia ?? backend,
    };
  }

  return {
    ok: true,
    embeddings: parsed.embeddings,
    model: parsed.model,
    backend: result.routedVia ?? backend,
  };
}

export function delegationEmbedLimits(): {
  maxTexts: number;
  maxCharsPerText: number;
} {
  return { maxTexts: MAX_TEXTS, maxCharsPerText: MAX_CHARS_PER_TEXT };
}
