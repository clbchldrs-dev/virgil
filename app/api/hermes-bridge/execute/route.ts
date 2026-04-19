import {
  bridgeExecute,
  isBridgeRequestAuthorized,
  parseBridgeIntent,
} from "@/lib/integrations/hermes-bridge";

export async function POST(request: Request) {
  if (!isBridgeRequestAuthorized(request)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const intent = parseBridgeIntent(body);
  if (!intent) {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }

  const outcome = await bridgeExecute(intent);
  return Response.json(outcome.body, { status: outcome.status });
}
