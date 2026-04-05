import { auth } from "@/app/(auth)/auth";
import { isGoogleCalendarSecretsConfigured } from "@/lib/integrations/google-calendar-readonly";
import { isVirgilCalendarIntegrationEnabled } from "@/lib/virgil/integrations";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  if (session.user.type === "guest") {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const integrationEnabled = isVirgilCalendarIntegrationEnabled();
  const secretsReady = isGoogleCalendarSecretsConfigured();

  return Response.json({
    integrationEnabled,
    secretsReady,
    ready: integrationEnabled && secretsReady,
    calendarId: "primary",
  });
}
