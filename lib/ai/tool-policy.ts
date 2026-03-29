/**
 * Server-side policy helpers for LLM tools. Chat route still gates which tools
 * are registered; these checks defend against mistaken wiring or future call sites.
 */

export function chatOwnershipDenial(
  chat: { userId: string } | null,
  expectedUserId: string
): string | null {
  if (!chat) {
    return "Chat not found.";
  }
  if (chat.userId !== expectedUserId) {
    return "You cannot use tools in this chat.";
  }
  return null;
}

export function productOpportunityDeniedMessage(
  allowed: boolean
): string | null {
  if (!allowed) {
    return "Product opportunity submissions are not available in this context.";
  }
  return null;
}

export function escalationOwnersMismatch(
  ownerUserId: string,
  businessOwnerUserId: string
): boolean {
  return ownerUserId !== businessOwnerUserId;
}
