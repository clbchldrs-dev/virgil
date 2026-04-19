import { isBridgeRequestAuthorized } from "@/lib/integrations/hermes-bridge";

export function GET(request: Request) {
  if (!isBridgeRequestAuthorized(request)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  // The in-app bridge is stateless; Virgil stores pending intents in Postgres
  // via /api/delegation/* routes, so there's nothing to list here.
  return Response.json({ pending: [] });
}
