import { auth } from "@/app/(auth)/auth";
import { buildDeploymentCapabilities } from "@/lib/deployment/capabilities";

/**
 * User-safe JSON describing what this deployment supports (inference modes,
 * companion tools). No secrets. Suitable for production.
 *
 * Query **`refresh=1`** (or `true` / `yes`) — re-fetch delegation reachability and
 * skill ids immediately (bypasses ~55s server cache). **Requires a signed-in session.**
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const refreshRaw = url.searchParams.get("refresh")?.trim().toLowerCase();
  const wantsDelegationRefresh = ["1", "true", "yes"].includes(
    refreshRaw ?? ""
  );
  if (wantsDelegationRefresh) {
    const session = await auth();
    if (!session?.user) {
      return Response.json(
        { error: "Unauthorized — sign in to refresh delegation snapshot." },
        { status: 401 }
      );
    }
  }

  const body = await buildDeploymentCapabilities({
    bypassDelegationCache: wantsDelegationRefresh,
  });
  return Response.json(body, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
