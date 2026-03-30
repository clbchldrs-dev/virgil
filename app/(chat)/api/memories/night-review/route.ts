import type { NextRequest } from "next/server";
import { auth } from "@/app/(auth)/auth";
import { getNightReviewMemoriesForUser } from "@/lib/db/queries";
import { VirgilError } from "@/lib/errors";

/**
 * In-app surfacing of recent night-review memories (last 14 days by default).
 * `includeDismissed=1|true` includes rows with `metadata.reviewDecision === 'dismissed'` (for audit UI).
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return new VirgilError("unauthorized:chat").toResponse();
  }

  const days = Math.min(
    90,
    Math.max(
      1,
      Number.parseInt(request.nextUrl.searchParams.get("days") || "14", 10)
    )
  );
  const includeDismissed =
    request.nextUrl.searchParams.get("includeDismissed") === "1" ||
    request.nextUrl.searchParams.get("includeDismissed") === "true";
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const memories = await getNightReviewMemoriesForUser({
    userId: session.user.id,
    since,
    limit: 60,
    includeDismissed,
  });

  return Response.json({ memories });
}
