import { performHealthCheck } from "@/lib/ai/startup-check";

export const maxDuration = 10;

/**
 * GET /api/health
 *
 * Public health check endpoint. Returns detailed status of:
 * - Ollama connectivity and loaded models
 * - API key configuration (MEM0, Jira, Qstash, GitHub, AI Gateway)
 *
 * Used by: monitoring, startup verification, admin dashboard
 *
 * Response:
 * {
 *   status: "healthy" | "degraded" | "error"
 *   timestamp: ISO string
 *   ollama: { reachable, baseUrl, error? }
 *   apis: { mem0, jira, qstash, github, ai_gateway }
 *   errors: []
 * }
 */
export async function GET() {
  try {
    const health = await performHealthCheck();
    const statusCode =
      health.status === "healthy"
        ? 200
        : health.status === "degraded"
          ? 206
          : 503;

    return Response.json(health, { status: statusCode });
  } catch (error) {
    return Response.json(
      {
        status: "error" as const,
        timestamp: new Date().toISOString(),
        errors: [
          error instanceof Error
            ? error.message
            : "Unknown health check error",
        ],
      },
      { status: 500 }
    );
  }
}
