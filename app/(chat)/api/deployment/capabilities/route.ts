import { buildDeploymentCapabilities } from "@/lib/deployment/capabilities";

/**
 * User-safe JSON describing what this deployment supports (inference modes,
 * companion tools). No secrets. Suitable for production.
 */
export async function GET() {
  const body = await buildDeploymentCapabilities();
  return Response.json(body, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
