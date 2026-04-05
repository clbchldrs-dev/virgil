import { auth } from "@/app/(auth)/auth";
import { pingDigitalSelfHealth } from "@/lib/integrations/digital-self-client";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = await pingDigitalSelfHealth();
  if (!result.configured) {
    return Response.json({
      configured: false,
      message: "Set DIGITAL_SELF_BASE_URL to enable bridge checks.",
    });
  }

  return Response.json({
    configured: true,
    reachable: result.reachable,
    status: result.status,
    digitalSelf: result.payload,
  });
}
