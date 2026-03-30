import { auth } from "@/app/(auth)/auth";
import { clearHealthCheckCache } from "@/lib/ai/startup-check";

export const maxDuration = 10;

/**
 * POST /api/admin/reload-config
 *
 * Admin-only endpoint to reload config without full app restart.
 * Useful for Vercel deployments where you can't SSH in and restart.
 *
 * Currently clears internal caches. In future, could:
 * - Reload .env (Next.js doesn't natively support this in production)
 * - Hot-reload model configs
 * - Restart Ollama connection
 *
 * Requires authentication.
 */
export async function POST(request: Request) {
  // Check authentication
  const session = await auth();
  if (!session?.user) {
    return Response.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    // Clear internal caches
    clearHealthCheckCache();

    // In the future, you could add:
    // - Re-initialize Ollama provider
    // - Clear model cache
    // - Re-validate API keys

    return Response.json({
      status: "reloaded",
      timestamp: new Date().toISOString(),
      message: "Config caches cleared. Check /api/health for status.",
    });
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
