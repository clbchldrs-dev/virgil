import { auth } from "@/app/(auth)/auth";
import {
  getBackgroundQueueSnapshotForUser,
  getChatPathTelemetryRollupForUser,
} from "@/lib/db/queries";
import { handleFlightDeckGet } from "@/lib/reliability/flight-deck-handler";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  return handleFlightDeckGet(
    request,
    {
      isAuthorized: async () => session.user.type === "regular",
      getFallbackRollup: async (input) =>
        getChatPathTelemetryRollupForUser(input),
      getQueueSnapshot: async (input) =>
        getBackgroundQueueSnapshotForUser(input),
      now: () => new Date(),
    },
    userId
  );
}
