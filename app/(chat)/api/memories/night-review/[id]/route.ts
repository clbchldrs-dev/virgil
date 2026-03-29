import type { NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import { setNightReviewMemoryDecision } from "@/lib/db/queries";
import { ChatbotError } from "@/lib/errors";

const bodySchema = z.object({
  decision: z.enum(["accepted", "dismissed"]),
});

export async function PATCH(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return new ChatbotError("unauthorized:chat").toResponse();
  }

  const { id } = await context.params;
  let json: unknown;
  try {
    json = await _request.json();
  } catch {
    return new ChatbotError("bad_request:api").toResponse();
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return new ChatbotError("bad_request:api").toResponse();
  }

  try {
    const memory = await setNightReviewMemoryDecision({
      userId: session.user.id,
      memoryId: id,
      decision: parsed.data.decision,
    });
    return Response.json({ memory });
  } catch (error) {
    if (error instanceof ChatbotError) {
      return error.toResponse();
    }
    return new ChatbotError("offline:chat").toResponse();
  }
}
