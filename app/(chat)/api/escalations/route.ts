import { auth } from "@/app/(auth)/auth";
import {
  getBusinessProfileByUserId,
  getEscalationRecords,
  updateEscalationStatus,
} from "@/lib/db/queries";
import { ChatbotError } from "@/lib/errors";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return new ChatbotError("unauthorized:chat").toResponse();
  }

  const profile = await getBusinessProfileByUserId({
    userId: session.user.id,
  });
  if (!profile) {
    return Response.json({ escalations: [] });
  }

  const escalations = await getEscalationRecords({
    businessProfileId: profile.id,
  });

  return Response.json({ escalations });
}

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new ChatbotError("unauthorized:chat").toResponse();
  }

  const { id, status } = await request.json();
  if (!id || !["pending", "acknowledged", "resolved"].includes(status)) {
    return new ChatbotError("bad_request:api").toResponse();
  }

  const updated = await updateEscalationStatus({ id, status });
  return Response.json(updated);
}
