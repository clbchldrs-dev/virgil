import type { ErrorCode } from "@/lib/errors";
import { VirgilError } from "@/lib/errors";

/**
 * IDOR guards for API routes: every check is unit-tested so mutating handlers
 * cannot drift from “resource userId must match session userId”.
 */

/**
 * Chat-scoped vote routes: GET uses `not_found:chat`, PATCH uses `not_found:vote`.
 * Call only after `auth()` succeeds so unauthenticated requests do not hit `getChatById`.
 */
export function chatVoteAccessVirgilError(options: {
  chat: { userId: string } | null;
  sessionUserId: string;
  notFoundCode: Extract<ErrorCode, "not_found:chat" | "not_found:vote">;
}): VirgilError | null {
  if (!options.chat) {
    return new VirgilError(options.notFoundCode);
  }
  if (options.chat.userId !== options.sessionUserId) {
    return new VirgilError("forbidden:vote");
  }
  return null;
}

/**
 * Suggestions are keyed by document; call only after auth and when at least one row exists.
 */
export function suggestionWrongOwnerVirgilError(
  suggestion: { userId: string },
  sessionUserId: string
): VirgilError | null {
  if (suggestion.userId !== sessionUserId) {
    return new VirgilError("forbidden:api");
  }
  return null;
}

/**
 * Single document row read / delete by id.
 * Call only after `auth()` succeeds so unauthenticated requests do not hit `getDocumentsById`.
 */
export function documentRowAccessVirgilError(options: {
  document: { userId: string } | undefined;
  sessionUserId: string;
}): VirgilError | null {
  if (!options.document) {
    return new VirgilError("not_found:document");
  }
  if (options.document.userId !== options.sessionUserId) {
    return new VirgilError("forbidden:document");
  }
  return null;
}
