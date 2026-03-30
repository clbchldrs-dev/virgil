import "server-only";

import { and, desc, eq } from "drizzle-orm";
import { VirgilError } from "@/lib/errors";
import { db } from "../client";
import {
  type BusinessProfile,
  businessProfile,
  type EscalationRecord,
  escalationRecord,
  type IntakeSubmission,
  intakeSubmission,
  type PriorityNote,
  priorityNote,
} from "../schema";

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
    throw new VirgilError(
      "bad_request:database",
      "Failed to get business profile"
    );
  }
}

/** Toggle front-desk mode without re-submitting the full onboarding form. */
export async function setBusinessModeEnabled({
  userId,
  enabled,
}: {
  userId: string;
  enabled: boolean;
}): Promise<BusinessProfile | null> {
  try {
    const existing = await getBusinessProfileByUserId({ userId });
    if (!existing) {
      return null;
    }
    const [updated] = await db
      .update(businessProfile)
      .set({ businessModeEnabled: enabled, updatedAt: new Date() })
      .where(eq(businessProfile.id, existing.id))
      .returning();
    return updated ?? null;
  } catch (_error) {
    if (_error instanceof VirgilError) {
      throw _error;
    }
    throw new VirgilError(
      "bad_request:database",
      "Failed to update business mode"
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
    if (_error instanceof VirgilError) {
      throw _error;
    }
    throw new VirgilError(
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
    throw new VirgilError(
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
    throw new VirgilError(
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
    throw new VirgilError(
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
    throw new VirgilError(
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
    throw new VirgilError(
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
    throw new VirgilError(
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
    throw new VirgilError(
      "bad_request:database",
      "Failed to update escalation status"
    );
  }
}
