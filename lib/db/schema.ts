import type { InferSelectModel } from "drizzle-orm";
import {
  boolean,
  date,
  foreignKey,
  integer,
  json,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const user = pgTable("User", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  email: varchar("email", { length: 64 }).notNull(),
  password: varchar("password", { length: 64 }),
  name: text("name"),
  emailVerified: boolean("emailVerified").notNull().default(false),
  image: text("image"),
  isAnonymous: boolean("isAnonymous").notNull().default(false),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export type User = InferSelectModel<typeof user>;

export const chat = pgTable("Chat", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  createdAt: timestamp("createdAt").notNull(),
  title: text("title").notNull(),
  userId: uuid("userId")
    .notNull()
    .references(() => user.id),
  visibility: varchar("visibility", { enum: ["public", "private"] })
    .notNull()
    .default("private"),
});

export type Chat = InferSelectModel<typeof chat>;

export const message = pgTable("Message_v2", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  chatId: uuid("chatId")
    .notNull()
    .references(() => chat.id),
  role: varchar("role").notNull(),
  parts: json("parts").notNull(),
  attachments: json("attachments").notNull(),
  createdAt: timestamp("createdAt").notNull(),
});

export type DBMessage = InferSelectModel<typeof message>;

export const vote = pgTable(
  "Vote_v2",
  {
    chatId: uuid("chatId")
      .notNull()
      .references(() => chat.id),
    messageId: uuid("messageId")
      .notNull()
      .references(() => message.id),
    isUpvoted: boolean("isUpvoted").notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.chatId, table.messageId] }),
  })
);

export type Vote = InferSelectModel<typeof vote>;

export const document = pgTable(
  "Document",
  {
    id: uuid("id").notNull().defaultRandom(),
    createdAt: timestamp("createdAt").notNull(),
    title: text("title").notNull(),
    content: text("content"),
    kind: varchar("text", { enum: ["text", "code", "image", "sheet"] })
      .notNull()
      .default("text"),
    userId: uuid("userId")
      .notNull()
      .references(() => user.id),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.id, table.createdAt] }),
  })
);

export type Document = InferSelectModel<typeof document>;

export const suggestion = pgTable(
  "Suggestion",
  {
    id: uuid("id").notNull().defaultRandom(),
    documentId: uuid("documentId").notNull(),
    documentCreatedAt: timestamp("documentCreatedAt").notNull(),
    originalText: text("originalText").notNull(),
    suggestedText: text("suggestedText").notNull(),
    description: text("description"),
    isResolved: boolean("isResolved").notNull().default(false),
    userId: uuid("userId")
      .notNull()
      .references(() => user.id),
    createdAt: timestamp("createdAt").notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.id] }),
    documentRef: foreignKey({
      columns: [table.documentId, table.documentCreatedAt],
      foreignColumns: [document.id, document.createdAt],
    }),
  })
);

export type Suggestion = InferSelectModel<typeof suggestion>;

export const stream = pgTable(
  "Stream",
  {
    id: uuid("id").notNull().defaultRandom(),
    chatId: uuid("chatId").notNull(),
    createdAt: timestamp("createdAt").notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.id] }),
    chatRef: foreignKey({
      columns: [table.chatId],
      foreignColumns: [chat.id],
    }),
  })
);

export type Stream = InferSelectModel<typeof stream>;

// --- Virgil: business context tables ---

export const businessProfile = pgTable("BusinessProfile", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  userId: uuid("userId")
    .notNull()
    .references(() => user.id),
  businessName: text("businessName").notNull(),
  industry: text("industry"),
  hoursOfOperation: text("hoursOfOperation"),
  services: json("services").$type<string[]>().notNull().default([]),
  tonePreference: varchar("tonePreference", {
    enum: ["friendly", "professional", "casual"],
  })
    .notNull()
    .default("professional"),
  neverPromise: json("neverPromise").$type<string[]>().notNull().default([]),
  escalationContactName: text("escalationContactName"),
  escalationContactEmail: text("escalationContactEmail"),
  escalationRules: text("escalationRules"),
  /** When false, Virgil stays in personal-assistant mode even if a profile exists. */
  businessModeEnabled: boolean("businessModeEnabled").notNull().default(true),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export type BusinessProfile = InferSelectModel<typeof businessProfile>;

export const priorityNote = pgTable("PriorityNote", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  businessProfileId: uuid("businessProfileId")
    .notNull()
    .references(() => businessProfile.id),
  content: text("content").notNull(),
  version: timestamp("version").notNull().defaultNow(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

export type PriorityNote = InferSelectModel<typeof priorityNote>;

export const intakeSubmission = pgTable("IntakeSubmission", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  businessProfileId: uuid("businessProfileId")
    .notNull()
    .references(() => businessProfile.id),
  chatId: uuid("chatId").references(() => chat.id),
  customerName: text("customerName"),
  customerEmail: text("customerEmail"),
  customerPhone: text("customerPhone"),
  need: text("need"),
  urgency: varchar("urgency", { enum: ["low", "medium", "high"] })
    .notNull()
    .default("medium"),
  channelPreference: varchar("channelPreference", {
    enum: ["email", "phone", "text", "chat"],
  }),
  notes: text("notes"),
  data: json("data").$type<Record<string, unknown>>(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

export type IntakeSubmission = InferSelectModel<typeof intakeSubmission>;

export const escalationRecord = pgTable("EscalationRecord", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  businessProfileId: uuid("businessProfileId")
    .notNull()
    .references(() => businessProfile.id),
  chatId: uuid("chatId").references(() => chat.id),
  customerName: text("customerName"),
  summary: text("summary").notNull(),
  urgency: varchar("urgency", { enum: ["low", "medium", "high"] })
    .notNull()
    .default("medium"),
  status: varchar("status", { enum: ["pending", "acknowledged", "resolved"] })
    .notNull()
    .default("pending"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  resolvedAt: timestamp("resolvedAt"),
});

export type EscalationRecord = InferSelectModel<typeof escalationRecord>;

export const memory = pgTable("Memory", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  userId: uuid("userId")
    .notNull()
    .references(() => user.id),
  chatId: uuid("chatId").references(() => chat.id),
  kind: varchar("kind", { enum: ["note", "fact", "goal", "opportunity"] })
    .notNull()
    .default("note"),
  content: text("content").notNull(),
  metadata: json("metadata")
    .$type<Record<string, unknown>>()
    .notNull()
    .default({}),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export type Memory = InferSelectModel<typeof memory>;

/** Observability row for scheduled night-review runs (one per worker invocation). */
export const nightReviewRun = pgTable("NightReviewRun", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  userId: uuid("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  windowKey: varchar("windowKey", { length: 32 }).notNull(),
  runId: uuid("runId").notNull(),
  modelId: text("modelId").notNull(),
  outcome: varchar("outcome", { length: 32 }).notNull(),
  durationMs: integer("durationMs").notNull(),
  error: text("error"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

export type NightReviewRun = InferSelectModel<typeof nightReviewRun>;

/** Canonical weekly metrics for goal-guidance (Postgres-first; mem0 optional). */
export const goalWeeklySnapshot = pgTable(
  "GoalWeeklySnapshot",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    userId: uuid("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    weekEnding: date("weekEnding").notNull(),
    metrics: json("metrics").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  },
  (table) => ({
    userWeekUnique: uniqueIndex(
      "GoalWeeklySnapshot_userId_weekEnding_unique"
    ).on(table.userId, table.weekEnding),
  })
);

export type GoalWeeklySnapshot = InferSelectModel<typeof goalWeeklySnapshot>;

export const blockerIncident = pgTable("BlockerIncident", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  userId: uuid("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  chatId: uuid("chatId").references(() => chat.id, { onDelete: "set null" }),
  blockerKey: varchar("blockerKey", { length: 128 }).notNull(),
  summary: text("summary").notNull(),
  triggerGuess: text("triggerGuess"),
  mitigationNote: text("mitigationNote"),
  metadata: json("metadata")
    .$type<Record<string, unknown>>()
    .notNull()
    .default({}),
  occurredAt: timestamp("occurredAt").notNull().defaultNow(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

export type BlockerIncident = InferSelectModel<typeof blockerIncident>;

/** Tasks submitted via chat for Cursor or background agents to pick up. */
export const agentTask = pgTable("AgentTask", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  userId: uuid("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  chatId: uuid("chatId").references(() => chat.id, { onDelete: "set null" }),
  taskType: varchar("taskType", {
    enum: ["bug", "feature", "refactor", "prompt", "docs", "infra"],
  }).notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  priority: varchar("priority", {
    enum: ["low", "medium", "high", "critical"],
  })
    .notNull()
    .default("medium"),
  status: varchar("status", {
    enum: ["submitted", "approved", "in_progress", "done", "rejected"],
  })
    .notNull()
    .default("submitted"),
  githubIssueNumber: integer("githubIssueNumber"),
  githubIssueUrl: text("githubIssueUrl"),
  agentNotes: text("agentNotes"),
  metadata: json("metadata")
    .$type<Record<string, unknown>>()
    .notNull()
    .default({}),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export type AgentTask = InferSelectModel<typeof agentTask>;
