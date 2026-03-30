import { VirgilError } from "@/lib/errors";
import { getOllamaBaseUrl, getOllamaConnectionErrorCause } from "./providers";

export type HealthCheckResult = {
  status: "healthy" | "degraded" | "error";
  timestamp: string;
  ollama: {
    reachable: boolean;
    baseUrl: string;
    error?: string;
  };
  apis: Record<string, { configured: boolean; valid: boolean; error?: string }>;
  errors: string[];
};

const CHECK_CACHE_TTL_MS = 30_000;
let lastCheckTime = 0;
let cachedResult: HealthCheckResult | null = null;

/**
 * Validate Ollama connectivity and model availability.
 * Returns null if OK, error message if not.
 */
async function checkOllama(): Promise<string | null> {
  const baseUrl = getOllamaBaseUrl();
  try {
    const response = await fetch(`${baseUrl}/api/tags`, {
      method: "GET",
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      return `Ollama returned status ${response.status}. Check if it's running at ${baseUrl}`;
    }

    const json = await response.json();
    const models = json.models ?? [];
    if (models.length === 0) {
      return `No models loaded in Ollama. Run 'ollama pull qwen2.5:3b' at ${baseUrl}`;
    }

    return null;
  } catch (error) {
    const connectionError = getOllamaConnectionErrorCause(error, baseUrl);
    if (connectionError) {
      return connectionError;
    }
    if (error instanceof Error) {
      if (error.name === "AbortError") {
        return `Ollama connection timeout at ${baseUrl}. Service may be overloaded.`;
      }
      return `Ollama error: ${error.message}`;
    }
    return `Ollama unreachable at ${baseUrl}`;
  }
}

/**
 * Validate required API keys are present (basic check, not deep validation).
 */
function checkApiKeys(): Record<
  string,
  { configured: boolean; valid: boolean; error?: string }
> {
  const checks: Record<
    string,
    { configured: boolean; valid: boolean; error?: string }
  > = {};

  // MEM0
  const mem0Key = process.env.MEM0_API_KEY?.trim();
  checks.mem0 = {
    configured: Boolean(mem0Key),
    valid: mem0Key ? mem0Key.length > 10 : true, // if not configured, consider valid (optional)
  };

  // JIRA
  const jiraToken = process.env.JIRA_API_TOKEN?.trim();
  const jiraEmail = process.env.JIRA_EMAIL?.trim();
  checks.jira = {
    configured: Boolean(jiraToken && jiraEmail),
    valid: jiraToken ? jiraToken.length > 5 : true,
  };

  // Upstash/QSTASH (for reminders)
  const qstashToken = process.env.QSTASH_TOKEN?.trim();
  checks.qstash = {
    configured: Boolean(qstashToken),
    valid: qstashToken ? qstashToken.length > 10 : true,
  };

  // GitHub
  const githubToken = process.env.GITHUB_PRODUCT_OPPORTUNITY_TOKEN?.trim();
  checks.github = {
    configured: Boolean(githubToken),
    valid: githubToken ? githubToken.length > 10 : true,
  };

  // AI Gateway
  const aiGatewayKey = process.env.AI_GATEWAY_API_KEY?.trim();
  checks.ai_gateway = {
    configured: Boolean(aiGatewayKey),
    valid: aiGatewayKey ? aiGatewayKey.length > 10 : true,
  };

  return checks;
}

/**
 * Run full health check (Ollama + API keys).
 * Cached for 30s to avoid spam on repeated requests.
 */
export async function performHealthCheck(): Promise<HealthCheckResult> {
  const now = Date.now();
  if (cachedResult && now - lastCheckTime < CHECK_CACHE_TTL_MS) {
    return cachedResult;
  }

  const baseUrl = getOllamaBaseUrl();
  const errors: string[] = [];
  let ollamaError: string | null = null;

  try {
    ollamaError = await checkOllama();
    if (ollamaError) {
      errors.push(`Ollama: ${ollamaError}`);
    }
  } catch (error) {
    const msg =
      error instanceof Error
        ? error.message
        : "Unknown Ollama error";
    errors.push(`Ollama check failed: ${msg}`);
    ollamaError = msg;
  }

  const apiChecks = checkApiKeys();
  const apiErrors = Object.entries(apiChecks)
    .filter(([_, check]) => check.configured && !check.valid)
    .map(([name, _]) => `${name}: invalid or truncated`);

  errors.push(...apiErrors);

  const result: HealthCheckResult = {
    status:
      errors.length === 0
        ? "healthy"
        : errors.some((e) => e.includes("Ollama"))
          ? "error"
          : "degraded",
    timestamp: new Date().toISOString(),
    ollama: {
      reachable: !ollamaError,
      baseUrl,
      error: ollamaError ?? undefined,
    },
    apis: apiChecks,
    errors,
  };

  cachedResult = result;
  lastCheckTime = now;
  return result;
}

/**
 * Called on app startup (or explicitly). Throws if critical checks fail.
 * Non-critical failures (optional APIs) are logged but don't block startup.
 */
export async function assertStartupReady(): Promise<void> {
  const check = await performHealthCheck();

  if (check.status === "error") {
    const ollamaError = check.ollama.error;
    throw new Error(
      `Virgil startup check failed: ${ollamaError || check.errors.join("; ")}`
    );
  }

  // Log degraded state but don't block
  if (check.status === "degraded" && check.errors.length > 0) {
    console.warn(
      `[Virgil] Startup check: some optional services unavailable:`,
      check.errors.join("; ")
    );
  }
}

/**
 * Clear the health check cache (e.g., after env reload).
 */
export function clearHealthCheckCache(): void {
  cachedResult = null;
  lastCheckTime = 0;
}
