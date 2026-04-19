import { buildVirgilStatus } from "@/lib/integrations/virgil-status";

/**
 * Dev-only feature status endpoint.
 *
 * Production deploys don't expose this — there's nothing for an end user to do
 * with "MISSING" rows on a hosted deployment, and we don't want to advertise
 * internal env state. The UI banner should only call this when running in
 * development mode.
 */
export async function GET() {
  if (
    process.env.NODE_ENV === "production" &&
    !process.env.VIRGIL_EXPOSE_STATUS
  ) {
    return Response.json(
      { error: "not_enabled_in_production" },
      { status: 404 }
    );
  }
  const snapshot = await buildVirgilStatus();
  return Response.json(snapshot);
}
