import { z } from "zod";
import {
  buildHermesStubOutput,
  hermesBridgeStubEnabled,
  isHermesBridgeRequestAuthorized,
} from "@/lib/integrations/hermes-bridge-stub";

const executeBodySchema = z.object({
  skill: z.string().min(1),
  params: z.record(z.string(), z.unknown()).default({}),
  priority: z.enum(["low", "normal", "high"]).optional(),
  source: z.string().optional(),
  requiresConfirmation: z.boolean().optional(),
});

export async function POST(request: Request) {
  if (!hermesBridgeStubEnabled()) {
    return Response.json({ error: "hermes_bridge_stub_disabled" }, { status: 403 });
  }
  if (!isHermesBridgeRequestAuthorized(request)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = executeBodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }

  return Response.json({
    success: true,
    output: buildHermesStubOutput(parsed.data),
    meta: {
      mode: "stub",
      acceptedAt: new Date().toISOString(),
      intent: {
        skill: parsed.data.skill,
        priority: parsed.data.priority ?? "normal",
      },
    },
  });
}
