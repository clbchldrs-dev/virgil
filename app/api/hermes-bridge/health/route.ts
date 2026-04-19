import {
  bridgeHealth,
  isBridgeRequestAuthorized,
} from "@/lib/integrations/hermes-bridge";

export async function GET(request: Request) {
  if (!isBridgeRequestAuthorized(request)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const health = await bridgeHealth();
  return Response.json(health);
}
