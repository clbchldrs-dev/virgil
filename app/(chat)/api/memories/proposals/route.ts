import type { NextRequest } from "next/server";
import { auth } from "@/app/(auth)/auth";
import { getProposalMemoriesForUser } from "@/lib/db/queries";
import { VirgilError } from "@/lib/errors";

/**
 * Lists Memory rows with tier = "propose" (ADR-002 Tier 2 — needs explicit approval).
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
      Number.parseInt(request.nextUrl.searchParams.get("days") || "90", 10)
    )
  );
  const includeDismissed =
    request.nextUrl.searchParams.get("includeDismissed") === "1" ||
    request.nextUrl.searchParams.get("includeDismissed") === "true";
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  try {
    const memories = await getProposalMemoriesForUser({
      userId: session.user.id,
      since,
      limit: 60,
      includeDismissed,
    });
    return Response.json({ memories });
  } catch (error) {
    if (error instanceof VirgilError) {
      return error.toResponse();
    }
    return new VirgilError("offline:chat").toResponse();
  }
}
