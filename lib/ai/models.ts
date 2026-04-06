export const DEFAULT_CHAT_MODEL = "deepseek/deepseek-v3.2";

/** Picker id: server resolves to a concrete gateway or Ollama model per {@link resolveAutoChatModel}. */
export const VIRGIL_AUTO_MODEL_ID = "virgil/auto";

export const titleModel = {
  id: "mistral/mistral-small",
  name: "Mistral Small",
  provider: "mistral",
  description: "Fast model for title generation",
  gatewayOrder: ["mistral"],
};

export function isLocalModel(modelId: string): boolean {
  return modelId.startsWith("ollama/");
}

/** True for direct Gemini API models (prefix `gemini/`), as opposed to gateway-routed `google/…` ids. */
export function isGeminiModel(modelId: string): boolean {
  return modelId.startsWith("gemini/");
}

/**
 * Rough capability bucket for local Ollama weights (prompt copy only).
 * Parsed from tag names like `qwen2.5:3b` / `llama3.1:8b` when not set explicitly on {@link ChatModel}.
 */
export type LocalModelClass = "3b" | "7b";

/** Maps `…3b`, `…1.5b`, `…4b` → `3b`; larger parameter counts → `7b`. Unknown tags default to `3b` (conservative). */
export function inferLocalModelClassFromOllamaTag(
  tag: string
): LocalModelClass {
  const m = tag.match(/(\d+(?:\.\d+)?)\s*b\b/i);
  if (!m) {
    return "3b";
  }
  const n = Number.parseFloat(m[1]);
  if (Number.isNaN(n)) {
    return "3b";
  }
  return n <= 4 ? "3b" : "7b";
}

/**
 * Effective class for slim/compact prompts: explicit {@link ChatModel.localModelClass}, else inferred from the Ollama tag.
 * Non-local ids return `7b` (unused for gateway prompt selection).
 */
export function getResolvedLocalModelClass(
  modelId: string,
  config?: ChatModel | null
): LocalModelClass {
  if (config?.localModelClass) {
    return config.localModelClass;
  }
  if (!isLocalModel(modelId)) {
    return "7b";
  }
  const tag = modelId.replace(/^ollama\//, "");
  return inferLocalModelClassFromOllamaTag(tag);
}

export type ModelCapabilities = {
  tools: boolean;
  vision: boolean;
  reasoning: boolean;
};

export type ChatModel = {
  id: string;
  name: string;
  provider: string;
  description: string;
  runtimeModelId?: string;
  gatewayOrder?: string[];
  reasoningEffort?: "none" | "minimal" | "low" | "medium" | "high";
  maxContextTokens?: number;
  ollamaOptions?: {
    num_ctx?: number;
    num_predict?: number;
    temperature?: number;
    repeat_penalty?: number;
  };
  /** `compact` is a minimal local prompt for the weakest hardware; default local path uses `slim`. */
  promptVariant?: "full" | "slim" | "compact";
  /** When set, selects 3B- vs 7B-class slim/compact copy; otherwise inferred from the tag (e.g. `qwen2.5:3b` vs `…7b`). */
  localModelClass?: LocalModelClass;
};

export const chatModels: ChatModel[] = [
  {
    id: "ollama/qwen2.5:3b",
    name: "Qwen 2.5 3B (Local)",
    provider: "ollama",
    description: "Free local model — runs on your machine",
    maxContextTokens: 1600,
    ollamaOptions: {
      num_ctx: 2048,
      num_predict: 512,
      temperature: 0.6,
      repeat_penalty: 1.1,
    },
    promptVariant: "slim",
    localModelClass: "3b",
  },
  {
    id: "ollama/qwen2.5:3b-turbo",
    runtimeModelId: "ollama/qwen2.5:3b",
    name: "Qwen 2.5 3B Turbo (Local)",
    provider: "ollama",
    description:
      "Aggressive speed preset for weaker laptops — same qwen2.5:3b weights, shorter context/output",
    maxContextTokens: 1024,
    ollamaOptions: {
      num_ctx: 1280,
      num_predict: 256,
      temperature: 0.45,
      repeat_penalty: 1.15,
    },
    promptVariant: "compact",
    localModelClass: "3b",
  },
  {
    id: "ollama/qwen2.5:7b-instruct",
    name: "Qwen 2.5 7B (Local)",
    provider: "ollama",
    description:
      "Heavier instruct-tuned Qwen — run: ollama pull qwen2.5:7b-instruct (LAN: set OLLAMA_BASE_URL)",
    maxContextTokens: 3200,
    ollamaOptions: {
      num_ctx: 4096,
      num_predict: 768,
      temperature: 0.7,
      repeat_penalty: 1.1,
    },
    promptVariant: "slim",
    localModelClass: "7b",
  },
  {
    id: "ollama/qwen2.5:7b-lean",
    runtimeModelId: "ollama/qwen2.5:7b-instruct",
    name: "Qwen 2.5 7B Lean (Local)",
    provider: "ollama",
    description:
      "Aggressive keep-it-moving preset for 7B — same qwen2.5:7b-instruct weights with tighter limits",
    maxContextTokens: 2048,
    ollamaOptions: {
      num_ctx: 2560,
      num_predict: 384,
      temperature: 0.55,
      repeat_penalty: 1.15,
    },
    promptVariant: "slim",
    localModelClass: "7b",
  },
  {
    id: "ollama/qwen2.5:7b-review",
    runtimeModelId: "ollama/qwen2.5:7b-instruct",
    name: "Qwen 2.5 7B Night review (Local)",
    provider: "ollama",
    description:
      "Preset for scheduled night-review job (structured JSON) — same weights as 7B instruct; set NIGHT_REVIEW_MODEL to this id or override in env",
    maxContextTokens: 8192,
    ollamaOptions: {
      num_ctx: 8192,
      num_predict: 2048,
      temperature: 0.4,
      repeat_penalty: 1.1,
    },
    promptVariant: "slim",
    localModelClass: "7b",
  },
  {
    id: VIRGIL_AUTO_MODEL_ID,
    name: "Auto (local if up, else lite hosted)",
    provider: "virgil",
    description:
      "Picks a small local model when Ollama is reachable from the server, otherwise a lightweight gateway model. Optional client hints are sent for future tuning.",
    maxContextTokens: 8192,
  },
  {
    id: "deepseek/deepseek-v3.2",
    name: "DeepSeek V3.2",
    provider: "deepseek",
    description: "Fast and capable model with tool use",
    gatewayOrder: ["bedrock", "deepinfra"],
  },
  {
    id: "mistral/codestral",
    name: "Codestral",
    provider: "mistral",
    description: "Code-focused model with tool use",
    gatewayOrder: ["mistral"],
  },
  {
    id: "mistral/mistral-small",
    name: "Mistral Small",
    provider: "mistral",
    description: "Fast vision model with tool use",
    gatewayOrder: ["mistral"],
  },
  {
    id: "moonshotai/kimi-k2-0905",
    name: "Kimi K2 0905",
    provider: "moonshotai",
    description: "Fast model with tool use",
    gatewayOrder: ["baseten", "fireworks"],
  },
  {
    id: "moonshotai/kimi-k2.5",
    name: "Kimi K2.5",
    provider: "moonshotai",
    description: "Moonshot AI flagship model",
    gatewayOrder: ["fireworks", "bedrock"],
  },
  {
    id: "openai/gpt-oss-20b",
    name: "GPT OSS 20B",
    provider: "openai",
    description: "Compact reasoning model",
    gatewayOrder: ["groq", "bedrock"],
    reasoningEffort: "low",
  },
  {
    id: "openai/gpt-oss-120b",
    name: "GPT OSS 120B",
    provider: "openai",
    description: "Open-source 120B parameter model",
    gatewayOrder: ["fireworks", "bedrock"],
    reasoningEffort: "low",
  },
  {
    id: "xai/grok-4.1-fast-non-reasoning",
    name: "Grok 4.1 Fast",
    provider: "xai",
    description: "Fast non-reasoning model with tool use",
    gatewayOrder: ["xai"],
  },
  {
    id: "google/gemini-2.5-flash-lite",
    name: "Gemini 2.5 Flash Lite",
    provider: "google",
    description: "Gemini model via Vercel AI Gateway",
  },
];

const localModelCapabilities: Record<string, ModelCapabilities> = {
  /** Chat uses a text-only stream for Ollama — small models rarely handle full tool schemas reliably. */
  "ollama/qwen2.5:3b": { tools: false, vision: false, reasoning: false },
  "ollama/qwen2.5:7b-instruct": {
    tools: false,
    vision: false,
    reasoning: false,
  },
};

const defaultLocalCapabilities: ModelCapabilities = {
  tools: false,
  vision: false,
  reasoning: false,
};

export function getChatModel(modelId: string): ChatModel | undefined {
  return chatModels.find((model) => model.id === modelId);
}

/** Curated roster entry, or a conservative synthetic profile for discovered `ollama/…` ids. */
export function getChatModelWithLocalFallback(
  modelId: string
): ChatModel | undefined {
  const known = getChatModel(modelId);
  if (known) {
    return known;
  }
  if (!isLocalModel(modelId)) {
    return undefined;
  }
  const tag = modelId.replace(/^ollama\//, "");
  if (!tag) {
    return undefined;
  }
  return {
    id: modelId,
    name: `${tag} (local)`,
    provider: "ollama",
    description: "Local Ollama model",
    maxContextTokens: 2048,
    ollamaOptions: {
      num_ctx: 2048,
      num_predict: 512,
      temperature: 0.6,
      repeat_penalty: 1.1,
    },
    promptVariant: "slim",
    localModelClass: inferLocalModelClassFromOllamaTag(tag),
  };
}

export function resolveRuntimeModelId(modelId: string): string {
  return getChatModel(modelId)?.runtimeModelId ?? modelId;
}

const gatewayCapabilitiesCache = new Map<
  string,
  { caps: ModelCapabilities; expiresAt: number }
>();
/** Aligns with previous per-endpoint fetch revalidate (24h). */
const GATEWAY_CAPABILITIES_TTL_MS = 86_400_000;

async function fetchGatewayCapabilities(
  modelId: string
): Promise<ModelCapabilities> {
  const now = Date.now();
  const hit = gatewayCapabilitiesCache.get(modelId);
  if (hit && hit.expiresAt > now) {
    return hit.caps;
  }

  const fallback: ModelCapabilities = {
    tools: false,
    vision: false,
    reasoning: false,
  };

  try {
    const res = await fetch(
      `https://ai-gateway.vercel.sh/v1/models/${modelId}/endpoints`,
      { next: { revalidate: 86_400 } }
    );
    if (!res.ok) {
      gatewayCapabilitiesCache.set(modelId, {
        caps: fallback,
        expiresAt: now + GATEWAY_CAPABILITIES_TTL_MS,
      });
      return fallback;
    }

    const json = await res.json();
    const endpoints = json.data?.endpoints ?? [];
    const params = new Set(
      endpoints.flatMap(
        (e: { supported_parameters?: string[] }) => e.supported_parameters ?? []
      )
    );
    const inputModalities = new Set(
      json.data?.architecture?.input_modalities ?? []
    );

    const caps: ModelCapabilities = {
      tools: params.has("tools"),
      vision: inputModalities.has("image"),
      reasoning: params.has("reasoning"),
    };
    gatewayCapabilitiesCache.set(modelId, {
      caps,
      expiresAt: now + GATEWAY_CAPABILITIES_TTL_MS,
    });
    return caps;
  } catch {
    gatewayCapabilitiesCache.set(modelId, {
      caps: fallback,
      expiresAt: now + GATEWAY_CAPABILITIES_TTL_MS,
    });
    return fallback;
  }
}

/**
 * Capabilities for a single model. Ollama ids use static tables (no network).
 * Gateway ids fetch once per model with in-memory TTL (shared with getCapabilities).
 */
export function getCapabilitiesForModel(
  modelId: string
): Promise<ModelCapabilities> {
  if (modelId === VIRGIL_AUTO_MODEL_ID) {
    return Promise.resolve({
      tools: true,
      vision: false,
      reasoning: false,
    });
  }
  if (isLocalModel(modelId)) {
    const runtimeModelId = resolveRuntimeModelId(modelId);
    return Promise.resolve(
      localModelCapabilities[runtimeModelId] ?? defaultLocalCapabilities
    );
  }
  return fetchGatewayCapabilities(modelId);
}

export async function getCapabilities(): Promise<
  Record<string, ModelCapabilities>
> {
  const results = await Promise.all(
    chatModels.map(
      async (model) =>
        [model.id, await getCapabilitiesForModel(model.id)] as const
    )
  );

  return Object.fromEntries(results);
}

export const isDemo = process.env.IS_DEMO === "1";

type GatewayModel = {
  id: string;
  name: string;
  type?: string;
  tags?: string[];
};

export type GatewayModelWithCapabilities = ChatModel & {
  capabilities: ModelCapabilities;
};

export async function getAllGatewayModels(): Promise<
  GatewayModelWithCapabilities[]
> {
  try {
    const res = await fetch("https://ai-gateway.vercel.sh/v1/models", {
      next: { revalidate: 86_400 },
    });
    if (!res.ok) {
      return [];
    }

    const json = await res.json();
    return (json.data ?? [])
      .filter((m: GatewayModel) => m.type === "language")
      .map((m: GatewayModel) => ({
        id: m.id,
        name: m.name,
        provider: m.id.split("/")[0],
        description: "",
        capabilities: {
          tools: m.tags?.includes("tool-use") ?? false,
          vision: m.tags?.includes("vision") ?? false,
          reasoning: m.tags?.includes("reasoning") ?? false,
        },
      }));
  } catch {
    return [];
  }
}

export function getActiveModels(): ChatModel[] {
  return chatModels;
}

export const allowedModelIds = new Set(chatModels.map((m) => m.id));

export const modelsByProvider = chatModels.reduce(
  (acc, model) => {
    if (!acc[model.provider]) {
      acc[model.provider] = [];
    }
    acc[model.provider].push(model);
    return acc;
  },
  {} as Record<string, ChatModel[]>
);
