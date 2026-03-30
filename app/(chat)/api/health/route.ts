import { auth } from "@/app/(auth)/auth";
import { performHealthCheck, redactHealthCheck } from "@/lib/ai/startup-check";

export const maxDuration = 10;

export async function GET() {
  try {
    const health = await performHealthCheck();
    const statusCode = health.status === "error" ? 503 : 200;

    const session = await auth();
    const body = session?.user ? health : redactHealthCheck(health);

    return Response.json(body, { status: statusCode });
  } catch (error) {
    return Response.json(
      {
        status: "error" as const,
        timestamp: new Date().toISOString(),
        errors: [
          error instanceof Error ? error.message : "Unknown health check error",
        ],
      },
      { status: 500 }
    );
  }
}
