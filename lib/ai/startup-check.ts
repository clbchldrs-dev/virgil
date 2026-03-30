import { getOllamaBaseUrl, getOllamaConnectionErrorCause } from "./providers";

export type HealthCheckResult = {
  status: "healthy" | "degraded" | "error";
  timestamp: string;
  ollama: {
    reachable: boolean;
    baseUrl: string;
    models?: string[];
    error?: string;
  };
  env: Record<string, { configured: boolean; error?: string }>;
  errors: string[];
};

const CHECK_CACHE_TTL_MS = 30_000;
let lastCheckTime = 0;
let cachedResult: HealthCheckResult | null = null;

async function checkOllama(): Promise<{
  error: string | null;
  models: string[];
}> {
  const baseUrl = getOllamaBaseUrl();
  try {
    const response = await fetch(`${baseUrl}/api/tags`, {
      method: "GET",
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      return {
        error: `Ollama returned status ${String(response.status)}. Is it running at ${baseUrl}?`,
        models: [],
      };
    }

    const json = (await response.json()) as { models?: { name: string }[] };
    const models = (json.models ?? []).map((m) => m.name);
    if (models.length === 0) {
      return {
        error: `No models loaded. Run 'ollama pull qwen2.5:3b' to get started.`,
        models: [],
      };
    }

    return { error: null, models };
  } catch (error) {
    const connectionError = getOllamaConnectionErrorCause(error, baseUrl);
    if (connectionError) {
      return { error: connectionError, models: [] };
    }
    if (error instanceof Error && error.name === "AbortError") {
      return {
        error: `Ollama timeout at ${baseUrl} — service may be overloaded.`,
        models: [],
      };
    }
    return {
      error: `Ollama unreachable at ${baseUrl}`,
      models: [],
    };
  }
}

type EnvSpec = {
  key: string;
  required: boolean;
  validate?: (v: string) => boolean;
};

const ENV_SPECS: EnvSpec[] = [
  {
    key: "POSTGRES_URL",
    required: true,
    validate: (v) =>
      v.startsWith("postgres://") || v.startsWith("postgresql://"),
  },
  {
    key: "REDIS_URL",
    required: true,
    validate: (v) => v.startsWith("redis://") || v.startsWith("rediss://"),
  },
  {
    key: "QSTASH_TOKEN",
    required: false,
    validate: (v) => v.startsWith("ey"),
  },
  {
    key: "QSTASH_CURRENT_SIGNING_KEY",
    required: false,
  },
  {
    key: "QSTASH_NEXT_SIGNING_KEY",
    required: false,
  },
  {
    key: "RESEND_API_KEY",
    required: false,
    validate: (v) => v.startsWith("re_"),
  },
  {
    key: "BLOB_READ_WRITE_TOKEN",
    required: false,
  },
  {
    key: "AI_GATEWAY_API_KEY",
    required: false,
  },
  {
    key: "CRON_SECRET",
    required: false,
  },
];

function checkEnvVars(): {
  results: Record<string, { configured: boolean; error?: string }>;
  errors: string[];
} {
  const results: Record<string, { configured: boolean; error?: string }> = {};
  const errors: string[] = [];

  for (const spec of ENV_SPECS) {
    const value = process.env[spec.key]?.trim();
    if (!value) {
      results[spec.key] = { configured: false };
      if (spec.required) {
        errors.push(`${spec.key} is missing (required)`);
      }
      continue;
    }

    if (spec.validate && !spec.validate(value)) {
      results[spec.key] = {
        configured: true,
        error: "unexpected format",
      };
      errors.push(`${spec.key}: unexpected format`);
      continue;
    }

    results[spec.key] = { configured: true };
  }

  return { results, errors };
}

/**
 * Full health check: Ollama connectivity + env var presence.
 * Cached for 30 s in long-running processes; harmless no-op on serverless cold starts.
 */
export async function performHealthCheck(): Promise<HealthCheckResult> {
  const now = Date.now();
  if (cachedResult && now - lastCheckTime < CHECK_CACHE_TTL_MS) {
    return cachedResult;
  }

  const baseUrl = getOllamaBaseUrl();
  const errors: string[] = [];

  const ollama = await checkOllama();
  if (ollama.error) {
    errors.push(`Ollama: ${ollama.error}`);
  }

  const env = checkEnvVars();
  errors.push(...env.errors);

  const hasOllamaError = Boolean(ollama.error);
  const hasRequiredEnvMissing = env.errors.some((e) => e.includes("required"));

  const result: HealthCheckResult = {
    status:
      hasOllamaError || hasRequiredEnvMissing
        ? "error"
        : errors.length > 0
          ? "degraded"
          : "healthy",
    timestamp: new Date().toISOString(),
    ollama: {
      reachable: !hasOllamaError,
      baseUrl,
      models: ollama.models.length > 0 ? ollama.models : undefined,
      error: ollama.error ?? undefined,
    },
    env: env.results,
    errors,
  };

  cachedResult = result;
  lastCheckTime = now;
  return result;
}

/**
 * Throws on critical failures (Ollama unreachable or required env missing).
 * Logs non-critical issues without blocking startup.
 */
export async function assertStartupReady(): Promise<void> {
  const check = await performHealthCheck();

  if (check.status === "error") {
    throw new Error(`Virgil startup check failed: ${check.errors.join("; ")}`);
  }

  if (check.status === "degraded" && check.errors.length > 0) {
    console.warn("[Virgil] Startup degraded:", check.errors.join("; "));
  }
}

export function clearHealthCheckCache(): void {
  cachedResult = null;
  lastCheckTime = 0;
}

/**
 * Strip internal details (baseUrl, model list, per-key breakdown)
 * for unauthenticated callers.
 */
export function redactHealthCheck(result: HealthCheckResult): Pick<
  HealthCheckResult,
  "status" | "timestamp" | "errors"
> & {
  ollama: { reachable: boolean };
} {
  return {
    status: result.status,
    timestamp: result.timestamp,
    errors: result.errors,
    ollama: { reachable: result.ollama.reachable },
  };
}
