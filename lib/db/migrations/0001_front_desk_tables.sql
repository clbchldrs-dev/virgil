CREATE TABLE IF NOT EXISTS "BusinessProfile" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "userId" uuid NOT NULL REFERENCES "User"("id"),
  "businessName" text NOT NULL,
  "industry" text,
  "hoursOfOperation" text,
  "services" json NOT NULL DEFAULT '[]'::json,
  "tonePreference" varchar NOT NULL DEFAULT 'professional',
  "neverPromise" json NOT NULL DEFAULT '[]'::json,
  "escalationContactName" text,
  "escalationContactEmail" text,
  "escalationRules" text,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "PriorityNote" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "businessProfileId" uuid NOT NULL REFERENCES "BusinessProfile"("id"),
  "content" text NOT NULL,
  "version" timestamp DEFAULT now() NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "IntakeSubmission" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "businessProfileId" uuid NOT NULL REFERENCES "BusinessProfile"("id"),
  "chatId" uuid REFERENCES "Chat"("id"),
  "customerName" text,
  "customerEmail" text,
  "customerPhone" text,
  "need" text,
  "urgency" varchar NOT NULL DEFAULT 'medium',
  "channelPreference" varchar,
  "notes" text,
  "data" json,
  "createdAt" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "EscalationRecord" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "businessProfileId" uuid NOT NULL REFERENCES "BusinessProfile"("id"),
  "chatId" uuid REFERENCES "Chat"("id"),
  "customerName" text,
  "summary" text NOT NULL,
  "urgency" varchar NOT NULL DEFAULT 'medium',
  "status" varchar NOT NULL DEFAULT 'pending',
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "resolvedAt" timestamp
);

CREATE INDEX IF NOT EXISTS "idx_business_profile_user" ON "BusinessProfile"("userId");
CREATE INDEX IF NOT EXISTS "idx_priority_note_profile" ON "PriorityNote"("businessProfileId");
CREATE INDEX IF NOT EXISTS "idx_intake_profile" ON "IntakeSubmission"("businessProfileId");
CREATE INDEX IF NOT EXISTS "idx_escalation_profile" ON "EscalationRecord"("businessProfileId");
CREATE INDEX IF NOT EXISTS "idx_escalation_status" ON "EscalationRecord"("status");
