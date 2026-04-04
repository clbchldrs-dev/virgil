import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import { getChatById, getVotesByChatId, voteMessage } from "@/lib/db/queries";
import { VirgilError } from "@/lib/errors";
import { chatVoteAccessVirgilError } from "@/lib/security/idor";

const voteSchema = z.object({
  chatId: z.string(),
  messageId: z.string(),
  type: z.enum(["up", "down"]),
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const chatId = searchParams.get("chatId");

  if (!chatId) {
    return new VirgilError(
      "bad_request:api",
      "Parameter chatId is required."
    ).toResponse();
  }

  const session = await auth();

  if (!session?.user) {
    return new VirgilError("unauthorized:vote").toResponse();
  }

  const chat = await getChatById({ id: chatId });

  const getErr = chatVoteAccessVirgilError({
    chat,
    sessionUserId: session.user.id,
    notFoundCode: "not_found:chat",
  });
  if (getErr) {
    return getErr.toResponse();
  }

  const votes = await getVotesByChatId({ id: chatId });

  return Response.json(votes, { status: 200 });
}

export async function PATCH(request: Request) {
  let chatId: string;
  let messageId: string;
  let type: "up" | "down";

  try {
    const parsed = voteSchema.parse(await request.json());
    chatId = parsed.chatId;
    messageId = parsed.messageId;
    type = parsed.type;
  } catch {
    return new VirgilError(
      "bad_request:api",
      "Parameters chatId, messageId, and type are required."
    ).toResponse();
  }

  const session = await auth();

  if (!session?.user) {
    return new VirgilError("unauthorized:vote").toResponse();
  }

  const chat = await getChatById({ id: chatId });

  const patchErr = chatVoteAccessVirgilError({
    chat,
    sessionUserId: session.user.id,
    notFoundCode: "not_found:vote",
  });
  if (patchErr) {
    return patchErr.toResponse();
  }

  await voteMessage({
    chatId,
    messageId,
    type,
  });

  return new Response("Message voted", { status: 200 });
}
