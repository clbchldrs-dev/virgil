import {
  hermesBridgeStubEnabled,
  isHermesBridgeRequestAuthorized,
} from "@/lib/integrations/hermes-bridge-stub";

export async function GET(request: Request) {
  if (!hermesBridgeStubEnabled()) {
    return Response.json({ error: "hermes_bridge_stub_disabled" }, { status: 403 });
  }
  if (!isHermesBridgeRequestAuthorized(request)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  return Response.json({
    ok: true,
    mode: "stub",
    service: "hermes-bridge",
    timestamp: new Date().toISOString(),
  });
}
