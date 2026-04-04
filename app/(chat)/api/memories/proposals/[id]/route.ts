import type { NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import { setProposalMemoryDecision } from "@/lib/db/queries";
import { VirgilError } from "@/lib/errors";

const bodySchema = z.object({
  decision: z.enum(["accepted", "dismissed"]),
});

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return new VirgilError("unauthorized:chat").toResponse();
  }

  const { id } = await context.params;
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return new VirgilError("bad_request:api").toResponse();
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return new VirgilError("bad_request:api").toResponse();
  }

  try {
    const memory = await setProposalMemoryDecision({
      userId: session.user.id,
      memoryId: id,
      decision: parsed.data.decision,
    });
    return Response.json({ memory });
  } catch (error) {
    if (error instanceof VirgilError) {
      return error.toResponse();
    }
    return new VirgilError("offline:chat").toResponse();
  }
}
