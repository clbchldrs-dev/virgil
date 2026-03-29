import "server-only";

import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  gte,
  inArray,
  lt,
  type SQL,
} from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import type { ArtifactKind } from "@/components/chat/artifact";
import type { VisibilityType } from "@/components/chat/visibility-selector";
import { ChatbotError } from "../errors";
import { generateUUID } from "../utils";
import {
  type Chat,
  chat,
  type DBMessage,
  document,
  message,
  type Suggestion,
  stream,
  suggestion,
  type User,
  user,
  vote,
  businessProfile,
  type BusinessProfile,
  priorityNote,
  type PriorityNote,
  intakeSubmission,
  type IntakeSubmission,
  escalationRecord,
  type EscalationRecord,
  memory,
  type Memory,
} from "./schema";
import { generateHashedPassword } from "./utils";

const client = postgres(process.env.POSTGRES_URL ?? "");
const db = drizzle(client);

export async function getUser(email: string): Promise<User[]> {
  try {
    return await db.select().from(user).where(eq(user.email, email));
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get user by email"
    );
  }
}

export async function getUserById({ id }: { id: string }): Promise<User | null> {
  try {
    const [found] = await db.select().from(user).where(eq(user.id, id)).limit(1);
    return found ?? null;
  } catch (_error) {
    throw new ChatbotError("bad_request:database", "Failed to get user by id");
  }
}

export async function createUser(email: string, password: string) {
  const hashedPassword = generateHashedPassword(password);

  try {
    return await db.insert(user).values({ email, password: hashedPassword });
  } catch (_error) {
    throw new ChatbotError("bad_request:database", "Failed to create user");
  }
}

export async function createGuestUser() {
  const email = `guest-${Date.now()}`;
  const password = generateHashedPassword(generateUUID());

  try {
    return await db.insert(user).values({ email, password }).returning({
      id: user.id,
      email: user.email,
    });
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to create guest user"
    );
  }
}

export async function saveChat({
  id,
  userId,
  title,
  visibility,
}: {
  id: string;
  userId: string;
  title: string;
  visibility: VisibilityType;
}) {
  try {
    return await db.insert(chat).values({
      id,
      createdAt: new Date(),
      userId,
      title,
      visibility,
    });
  } catch (_error) {
    throw new ChatbotError("bad_request:database", "Failed to save chat");
  }
}

export async function deleteChatById({ id }: { id: string }) {
  try {
    await db.delete(vote).where(eq(vote.chatId, id));
    await db.delete(message).where(eq(message.chatId, id));
    await db.delete(stream).where(eq(stream.chatId, id));

    const [chatsDeleted] = await db
      .delete(chat)
      .where(eq(chat.id, id))
      .returning();
    return chatsDeleted;
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to delete chat by id"
    );
  }
}

export async function deleteAllChatsByUserId({ userId }: { userId: string }) {
  try {
    const userChats = await db
      .select({ id: chat.id })
      .from(chat)
      .where(eq(chat.userId, userId));

    if (userChats.length === 0) {
      return { deletedCount: 0 };
    }

    const chatIds = userChats.map((c) => c.id);

    await db.delete(vote).where(inArray(vote.chatId, chatIds));
    await db.delete(message).where(inArray(message.chatId, chatIds));
    await db.delete(stream).where(inArray(stream.chatId, chatIds));

    const deletedChats = await db
      .delete(chat)
      .where(eq(chat.userId, userId))
      .returning();

    return { deletedCount: deletedChats.length };
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to delete all chats by user id"
    );
  }
}

export async function getChatsByUserId({
  id,
  limit,
  startingAfter,
  endingBefore,
}: {
  id: string;
  limit: number;
  startingAfter: string | null;
  endingBefore: string | null;
}) {
  try {
    const extendedLimit = limit + 1;

    const query = (whereCondition?: SQL<unknown>) =>
      db
        .select()
        .from(chat)
        .where(
          whereCondition
            ? and(whereCondition, eq(chat.userId, id))
            : eq(chat.userId, id)
        )
        .orderBy(desc(chat.createdAt))
        .limit(extendedLimit);

    let filteredChats: Chat[] = [];

    if (startingAfter) {
      const [selectedChat] = await db
        .select()
        .from(chat)
        .where(eq(chat.id, startingAfter))
        .limit(1);

      if (!selectedChat) {
        throw new ChatbotError(
          "not_found:database",
          `Chat with id ${startingAfter} not found`
        );
      }

      filteredChats = await query(gt(chat.createdAt, selectedChat.createdAt));
    } else if (endingBefore) {
      const [selectedChat] = await db
        .select()
        .from(chat)
        .where(eq(chat.id, endingBefore))
        .limit(1);

      if (!selectedChat) {
        throw new ChatbotError(
          "not_found:database",
          `Chat with id ${endingBefore} not found`
        );
      }

      filteredChats = await query(lt(chat.createdAt, selectedChat.createdAt));
    } else {
      filteredChats = await query();
    }

    const hasMore = filteredChats.length > limit;

    return {
      chats: hasMore ? filteredChats.slice(0, limit) : filteredChats,
      hasMore,
    };
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get chats by user id"
    );
  }
}

export async function getChatById({ id }: { id: string }) {
  try {
    const [selectedChat] = await db.select().from(chat).where(eq(chat.id, id));
    if (!selectedChat) {
      return null;
    }

    return selectedChat;
  } catch (_error) {
    throw new ChatbotError("bad_request:database", "Failed to get chat by id");
  }
}

export async function saveMessages({ messages }: { messages: DBMessage[] }) {
  try {
    return await db.insert(message).values(messages);
  } catch (_error) {
    throw new ChatbotError("bad_request:database", "Failed to save messages");
  }
}

export async function updateMessage({
  id,
  parts,
}: {
  id: string;
  parts: DBMessage["parts"];
}) {
  try {
    return await db.update(message).set({ parts }).where(eq(message.id, id));
  } catch (_error) {
    throw new ChatbotError("bad_request:database", "Failed to update message");
  }
}

export async function getMessagesByChatId({ id }: { id: string }) {
  try {
    return await db
      .select()
      .from(message)
      .where(eq(message.chatId, id))
      .orderBy(asc(message.createdAt));
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get messages by chat id"
    );
  }
}

export async function voteMessage({
  chatId,
  messageId,
  type,
}: {
  chatId: string;
  messageId: string;
  type: "up" | "down";
}) {
  try {
    const [existingVote] = await db
      .select()
      .from(vote)
      .where(and(eq(vote.messageId, messageId)));

    if (existingVote) {
      return await db
        .update(vote)
        .set({ isUpvoted: type === "up" })
        .where(and(eq(vote.messageId, messageId), eq(vote.chatId, chatId)));
    }
    return await db.insert(vote).values({
      chatId,
      messageId,
      isUpvoted: type === "up",
    });
  } catch (_error) {
    throw new ChatbotError("bad_request:database", "Failed to vote message");
  }
}

export async function getVotesByChatId({ id }: { id: string }) {
  try {
    return await db.select().from(vote).where(eq(vote.chatId, id));
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get votes by chat id"
    );
  }
}

export async function saveDocument({
  id,
  title,
  kind,
  content,
  userId,
}: {
  id: string;
  title: string;
  kind: ArtifactKind;
  content: string;
  userId: string;
}) {
  try {
    return await db
      .insert(document)
      .values({
        id,
        title,
        kind,
        content,
        userId,
        createdAt: new Date(),
      })
      .returning();
  } catch (_error) {
    throw new ChatbotError("bad_request:database", "Failed to save document");
  }
}

export async function updateDocumentContent({
  id,
  content,
}: {
  id: string;
  content: string;
}) {
  try {
    const docs = await db
      .select()
      .from(document)
      .where(eq(document.id, id))
      .orderBy(desc(document.createdAt))
      .limit(1);

    const latest = docs[0];
    if (!latest) {
      throw new ChatbotError("not_found:database", "Document not found");
    }

    return await db
      .update(document)
      .set({ content })
      .where(and(eq(document.id, id), eq(document.createdAt, latest.createdAt)))
      .returning();
  } catch (_error) {
    if (_error instanceof ChatbotError) {
      throw _error;
    }
    throw new ChatbotError(
      "bad_request:database",
      "Failed to update document content"
    );
  }
}

export async function getDocumentsById({ id }: { id: string }) {
  try {
    const documents = await db
      .select()
      .from(document)
      .where(eq(document.id, id))
      .orderBy(asc(document.createdAt));

    return documents;
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get documents by id"
    );
  }
}

export async function getDocumentById({ id }: { id: string }) {
  try {
    const [selectedDocument] = await db
      .select()
      .from(document)
      .where(eq(document.id, id))
      .orderBy(desc(document.createdAt));

    return selectedDocument;
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get document by id"
    );
  }
}

export async function deleteDocumentsByIdAfterTimestamp({
  id,
  timestamp,
}: {
  id: string;
  timestamp: Date;
}) {
  try {
    await db
      .delete(suggestion)
      .where(
        and(
          eq(suggestion.documentId, id),
          gt(suggestion.documentCreatedAt, timestamp)
        )
      );

    return await db
      .delete(document)
      .where(and(eq(document.id, id), gt(document.createdAt, timestamp)))
      .returning();
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to delete documents by id after timestamp"
    );
  }
}

export async function saveSuggestions({
  suggestions,
}: {
  suggestions: Suggestion[];
}) {
  try {
    return await db.insert(suggestion).values(suggestions);
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to save suggestions"
    );
  }
}

export async function getSuggestionsByDocumentId({
  documentId,
}: {
  documentId: string;
}) {
  try {
    return await db
      .select()
      .from(suggestion)
      .where(eq(suggestion.documentId, documentId));
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get suggestions by document id"
    );
  }
}

export async function getMessageById({ id }: { id: string }) {
  try {
    return await db.select().from(message).where(eq(message.id, id));
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get message by id"
    );
  }
}

export async function deleteMessagesByChatIdAfterTimestamp({
  chatId,
  timestamp,
}: {
  chatId: string;
  timestamp: Date;
}) {
  try {
    const messagesToDelete = await db
      .select({ id: message.id })
      .from(message)
      .where(
        and(eq(message.chatId, chatId), gte(message.createdAt, timestamp))
      );

    const messageIds = messagesToDelete.map(
      (currentMessage) => currentMessage.id
    );

    if (messageIds.length > 0) {
      await db
        .delete(vote)
        .where(
          and(eq(vote.chatId, chatId), inArray(vote.messageId, messageIds))
        );

      return await db
        .delete(message)
        .where(
          and(eq(message.chatId, chatId), inArray(message.id, messageIds))
        );
    }
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to delete messages by chat id after timestamp"
    );
  }
}

export async function updateChatVisibilityById({
  chatId,
  visibility,
}: {
  chatId: string;
  visibility: "private" | "public";
}) {
  try {
    return await db.update(chat).set({ visibility }).where(eq(chat.id, chatId));
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to update chat visibility by id"
    );
  }
}

export async function updateChatTitleById({
  chatId,
  title,
}: {
  chatId: string;
  title: string;
}) {
  try {
    return await db.update(chat).set({ title }).where(eq(chat.id, chatId));
  } catch (_error) {
    return;
  }
}

export async function getMessageCountByUserId({
  id,
  differenceInHours,
}: {
  id: string;
  differenceInHours: number;
}) {
  try {
    const cutoffTime = new Date(
      Date.now() - differenceInHours * 60 * 60 * 1000
    );

    const [stats] = await db
      .select({ count: count(message.id) })
      .from(message)
      .innerJoin(chat, eq(message.chatId, chat.id))
      .where(
        and(
          eq(chat.userId, id),
          gte(message.createdAt, cutoffTime),
          eq(message.role, "user")
        )
      )
      .execute();

    return stats?.count ?? 0;
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get message count by user id"
    );
  }
}

export async function createStreamId({
  streamId,
  chatId,
}: {
  streamId: string;
  chatId: string;
}) {
  try {
    await db
      .insert(stream)
      .values({ id: streamId, chatId, createdAt: new Date() });
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to create stream id"
    );
  }
}

export async function getStreamIdsByChatId({ chatId }: { chatId: string }) {
  try {
    const streamIds = await db
      .select({ id: stream.id })
      .from(stream)
      .where(eq(stream.chatId, chatId))
      .orderBy(asc(stream.createdAt))
      .execute();

    return streamIds.map(({ id }) => id);
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get stream ids by chat id"
    );
  }
}

// --- Front Desk: Business Profile ---

export async function getBusinessProfileByUserId({
  userId,
}: {
  userId: string;
}): Promise<BusinessProfile | null> {
  try {
    const [profile] = await db
      .select()
      .from(businessProfile)
      .where(eq(businessProfile.userId, userId))
      .limit(1);
    return profile ?? null;
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get business profile"
    );
  }
}

export async function upsertBusinessProfile({
  userId,
  data,
}: {
  userId: string;
  data: Omit<
    typeof businessProfile.$inferInsert,
    "id" | "userId" | "createdAt" | "updatedAt"
  >;
}) {
  try {
    const existing = await getBusinessProfileByUserId({ userId });
    if (existing) {
      const [updated] = await db
        .update(businessProfile)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(businessProfile.id, existing.id))
        .returning();
      return updated;
    }
    const [created] = await db
      .insert(businessProfile)
      .values({ ...data, userId })
      .returning();
    return created;
  } catch (_error) {
    if (_error instanceof ChatbotError) throw _error;
    throw new ChatbotError(
      "bad_request:database",
      "Failed to upsert business profile"
    );
  }
}

// --- Front Desk: Priority Notes ---

export async function getPriorityNotes({
  businessProfileId,
}: {
  businessProfileId: string;
}): Promise<PriorityNote[]> {
  try {
    return await db
      .select()
      .from(priorityNote)
      .where(eq(priorityNote.businessProfileId, businessProfileId))
      .orderBy(desc(priorityNote.version));
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get priority notes"
    );
  }
}

export async function savePriorityNote({
  businessProfileId,
  content,
}: {
  businessProfileId: string;
  content: string;
}) {
  try {
    const [created] = await db
      .insert(priorityNote)
      .values({ businessProfileId, content })
      .returning();
    return created;
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to save priority note"
    );
  }
}

// --- Front Desk: Intake Submissions ---

export async function saveIntakeSubmission({
  businessProfileId,
  chatId,
  customerName,
  customerEmail,
  customerPhone,
  need,
  urgency,
  channelPreference,
  notes,
  data,
}: {
  businessProfileId: string;
  chatId?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  need?: string;
  urgency?: "low" | "medium" | "high";
  channelPreference?: "email" | "phone" | "text" | "chat";
  notes?: string;
  data?: Record<string, unknown>;
}) {
  try {
    const [created] = await db
      .insert(intakeSubmission)
      .values({
        businessProfileId,
        chatId,
        customerName,
        customerEmail,
        customerPhone,
        need,
        urgency,
        channelPreference,
        notes,
        data,
      })
      .returning();
    return created;
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to save intake submission"
    );
  }
}

export async function getIntakeSubmissions({
  businessProfileId,
  limit = 50,
}: {
  businessProfileId: string;
  limit?: number;
}): Promise<IntakeSubmission[]> {
  try {
    return await db
      .select()
      .from(intakeSubmission)
      .where(eq(intakeSubmission.businessProfileId, businessProfileId))
      .orderBy(desc(intakeSubmission.createdAt))
      .limit(limit);
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get intake submissions"
    );
  }
}

// --- Front Desk: Escalation Records ---

export async function saveEscalationRecord({
  businessProfileId,
  chatId,
  customerName,
  summary,
  urgency,
}: {
  businessProfileId: string;
  chatId?: string;
  customerName?: string;
  summary: string;
  urgency?: "low" | "medium" | "high";
}) {
  try {
    const [created] = await db
      .insert(escalationRecord)
      .values({ businessProfileId, chatId, customerName, summary, urgency })
      .returning();
    return created;
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to save escalation record"
    );
  }
}

export async function getEscalationRecords({
  businessProfileId,
  statusFilter,
  limit = 50,
}: {
  businessProfileId: string;
  statusFilter?: "pending" | "acknowledged" | "resolved";
  limit?: number;
}): Promise<EscalationRecord[]> {
  try {
    const conditions = [
      eq(escalationRecord.businessProfileId, businessProfileId),
    ];
    if (statusFilter) {
      conditions.push(eq(escalationRecord.status, statusFilter));
    }
    return await db
      .select()
      .from(escalationRecord)
      .where(and(...conditions))
      .orderBy(desc(escalationRecord.createdAt))
      .limit(limit);
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get escalation records"
    );
  }
}

export async function updateEscalationStatus({
  id,
  status,
}: {
  id: string;
  status: "pending" | "acknowledged" | "resolved";
}) {
  try {
    const [updated] = await db
      .update(escalationRecord)
      .set({
        status,
        resolvedAt: status === "resolved" ? new Date() : undefined,
      })
      .where(eq(escalationRecord.id, id))
      .returning();
    return updated;
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to update escalation status"
    );
  }
}

// --- Memory (companion assistant) ---

export async function saveMemoryRecord({
  userId,
  chatId,
  kind,
  content,
  metadata,
}: {
  userId: string;
  chatId?: string;
  kind: "note" | "fact" | "goal" | "opportunity";
  content: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    const [created] = await db
      .insert(memory)
      .values({ userId, chatId, kind, content, metadata: metadata ?? {} })
      .returning();
    return created;
  } catch (_error) {
    throw new ChatbotError("bad_request:database", "Failed to save memory");
  }
}

export async function searchMemories({
  userId,
  query,
  kind,
  limit = 10,
}: {
  userId: string;
  query: string;
  kind?: "note" | "fact" | "goal" | "opportunity";
  limit?: number;
}): Promise<Memory[]> {
  try {
    const sanitized = query.replace(/[^\w\s]/g, " ").trim();
    if (!sanitized) return [];

    const tsquery = sanitized.split(/\s+/).filter(Boolean).join(" & ");

    const params: unknown[] = [userId, tsquery, limit];
    let kindClause = "";
    if (kind) {
      params.push(kind);
      kindClause = `AND "kind" = $${params.length}`;
    }

    const result = await client.unsafe<Memory[]>(
      `SELECT "id", "userId", "chatId", "kind", "content", "metadata", "createdAt", "updatedAt"
       FROM "Memory"
       WHERE "userId" = $1 ${kindClause}
         AND "tsv" @@ to_tsquery('english', $2)
       ORDER BY ts_rank("tsv", to_tsquery('english', $2)) DESC
       LIMIT $3`,
      params
    );
    return result;
  } catch (_error) {
    throw new ChatbotError("bad_request:database", "Failed to search memories");
  }
}

export async function getRecentMemories({
  userId,
  since,
  limit = 50,
}: {
  userId: string;
  since: Date;
  limit?: number;
}): Promise<Memory[]> {
  try {
    return await db
      .select()
      .from(memory)
      .where(and(eq(memory.userId, userId), gte(memory.createdAt, since)))
      .orderBy(desc(memory.createdAt))
      .limit(limit);
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get recent memories"
    );
  }
}
