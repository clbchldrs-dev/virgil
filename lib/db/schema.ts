import type { InferSelectModel } from "drizzle-orm";
import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  foreignKey,
  index,
  integer,
  json,
  jsonb,
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
  role: varchar("role", { length: 16 }).notNull().default("user"),
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

export const chatPathTelemetry = pgTable(
  "ChatPathTelemetry",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    userId: uuid("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    chatId: uuid("chatId").references(() => chat.id, { onDelete: "set null" }),
    requestedModelId: text("requestedModelId").notNull(),
    effectiveModelId: text("effectiveModelId").notNull(),
    requestedPath: varchar("requestedPath", { length: 16 }).notNull(),
    effectivePath: varchar("effectivePath", { length: 16 }).notNull(),
    fallbackTier: varchar("fallbackTier", { length: 16 }),
    outcome: varchar("outcome", { length: 16 }).notNull(),
    errorCode: varchar("errorCode", { length: 64 }),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
  },
  (table) => ({
    userCreatedIdx: index("ChatPathTelemetry_userId_createdAt_idx").on(
      table.userId,
      table.createdAt
    ),
    userPathCreatedIdx: index(
      "ChatPathTelemetry_userId_effectivePath_createdAt_idx"
    ).on(table.userId, table.effectivePath, table.createdAt),
    userOutcomeCreatedIdx: index(
      "ChatPathTelemetry_userId_outcome_createdAt_idx"
    ).on(table.userId, table.outcome, table.createdAt),
  })
);

export type ChatPathTelemetry = InferSelectModel<typeof chatPathTelemetry>;

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

export const memory = pgTable("Memory", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  userId: uuid("userId")
    .notNull()
    .references(() => user.id),
  chatId: uuid("chatId").references(() => chat.id),
  kind: varchar("kind", { enum: ["note", "fact", "goal", "opportunity"] })
    .notNull()
    .default("note"),
  tier: varchar("tier", { enum: ["observe", "propose", "act"] })
    .notNull()
    .default("observe"),
  content: text("content").notNull(),
  metadata: json("metadata")
    .$type<Record<string, unknown>>()
    .notNull()
    .default({}),
  proposedAt: timestamp("proposedAt"),
  approvedAt: timestamp("approvedAt"),
  appliedAt: timestamp("appliedAt"),
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

/** Cadence goals (E11 Phase 2); weekly rollups stay on {@link goalWeeklySnapshot}. */
export const goal = pgTable(
  "Goal",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    userId: uuid("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    category: varchar("category", { length: 32 }).notNull(),
    description: text("description"),
    targetCadence: varchar("targetCadence", { length: 32 }),
    status: varchar("status", { length: 32 }).notNull().default("active"),
    lastTouchedAt: timestamp("lastTouchedAt").notNull().defaultNow(),
    streakCurrent: integer("streakCurrent").notNull().default(0),
    streakBest: integer("streakBest").notNull().default(0),
    blockers: text("blockers").array().notNull().default(sql`'{}'::text[]`),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  },
  (table) => ({
    userStatusIdx: index("Goal_userId_status_idx").on(
      table.userId,
      table.status
    ),
  })
);

export type Goal = InferSelectModel<typeof goal>;

export const goalCheckIn = pgTable(
  "GoalCheckIn",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    goalId: uuid("goalId")
      .notNull()
      .references(() => goal.id, { onDelete: "cascade" }),
    checkedInAt: timestamp("checkedInAt").notNull().defaultNow(),
    notes: text("notes"),
    source: varchar("source", { length: 32 }).notNull().default("manual"),
  },
  (table) => ({
    goalCheckedIdx: index("GoalCheckIn_goalId_checkedInAt_idx").on(
      table.goalId,
      table.checkedInAt
    ),
  })
);

export type GoalCheckIn = InferSelectModel<typeof goalCheckIn>;

/** Owner daily checklist (calendar day in owner TZ); separate rows per day, no auto-rollover. */
export const dayTask = pgTable(
  "DayTask",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    userId: uuid("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    forDate: date("forDate", { mode: "string" }).notNull(),
    title: text("title").notNull(),
    sortOrder: integer("sortOrder").notNull(),
    completedAt: timestamp("completedAt"),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  },
  (table) => ({
    userDateSortUnique: uniqueIndex(
      "DayTask_userId_forDate_sortOrder_unique"
    ).on(table.userId, table.forDate, table.sortOrder),
    userDateIdx: index("DayTask_userId_forDate_idx").on(
      table.userId,
      table.forDate
    ),
  })
);

export type DayTask = InferSelectModel<typeof dayTask>;

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

/** User-scoped async jobs (deep analysis, future queued work). */
export const backgroundJob = pgTable(
  "BackgroundJob",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    userId: uuid("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    kind: varchar("kind", { length: 64 }).notNull(),
    status: varchar("status", {
      enum: [
        "pending",
        "running",
        "completed",
        "failed",
        "cancelled",
        "approving",
      ],
    })
      .notNull()
      .default("pending"),
    wallTimeMs: integer("wallTimeMs"),
    retryCount: integer("retryCount").notNull().default(0),
    proposalCount: integer("proposalCount").notNull().default(0),
    input: jsonb("input")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    result: jsonb("result").$type<Record<string, unknown>>(),
    error: text("error"),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
    startedAt: timestamp("startedAt"),
    completedAt: timestamp("completedAt"),
  },
  (table) => ({
    userCreatedIdx: index("BackgroundJob_userId_createdAt_idx").on(
      table.userId,
      table.createdAt
    ),
    userStatusIdx: index("BackgroundJob_userId_status_idx").on(
      table.userId,
      table.status
    ),
  })
);

export type BackgroundJob = InferSelectModel<typeof backgroundJob>;

/** Append-only audit trail for background job status transitions. */
export const backgroundJobAudit = pgTable(
  "BackgroundJobAudit",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    jobId: uuid("jobId")
      .notNull()
      .references(() => backgroundJob.id, { onDelete: "cascade" }),
    userId: uuid("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    oldStatus: varchar("oldStatus", { length: 64 }).notNull(),
    newStatus: varchar("newStatus", { length: 64 }).notNull(),
    actor: varchar("actor", { length: 128 }).notNull(),
    reason: text("reason"),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
  },
  (table) => ({
    jobCreatedIdx: index("BackgroundJobAudit_jobId_createdAt_idx").on(
      table.jobId,
      table.createdAt
    ),
  })
);

export type BackgroundJobAudit = InferSelectModel<typeof backgroundJobAudit>;

export const flightDeckOperatorAudit = pgTable(
  "FlightDeckOperatorAudit",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    userId: uuid("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    action: varchar("action", { length: 32 }).notNull(),
    requestId: varchar("requestId", { length: 128 }).notNull(),
    actionToken: varchar("actionToken", { length: 128 }).notNull(),
    status: varchar("status", { length: 16 }).notNull(),
    reason: text("reason"),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    completedAt: timestamp("completedAt"),
  },
  (table) => ({
    userActionCreatedIdx: index(
      "FlightDeckOperatorAudit_userId_action_createdAt_idx"
    ).on(table.userId, table.action, table.createdAt),
    userActionRequestUnique: uniqueIndex(
      "FlightDeckOperatorAudit_userId_action_requestId_unique"
    ).on(table.userId, table.action, table.requestId),
    userActionTokenUnique: uniqueIndex(
      "FlightDeckOperatorAudit_userId_action_actionToken_unique"
    ).on(table.userId, table.action, table.actionToken),
  })
);

export type FlightDeckOperatorAudit = InferSelectModel<
  typeof flightDeckOperatorAudit
>;

/** Queued execution handoff to OpenClaw (optional LAN integration). */
export const pendingIntent = pgTable("PendingIntent", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  userId: uuid("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  chatId: uuid("chatId").references(() => chat.id, { onDelete: "set null" }),
  intent: jsonb("intent").$type<Record<string, unknown>>().notNull(),
  skill: text("skill"),
  status: varchar("status", {
    enum: [
      "pending",
      "confirmed",
      "sent",
      "processing",
      "completed",
      "failed",
      "rejected",
    ],
  })
    .notNull()
    .default("pending"),
  requiresConfirmation: boolean("requiresConfirmation")
    .notNull()
    .default(false),
  /** True when intent is on the DB bus for Hermes/Manos poll worker (no inbound HTTP from Vercel). */
  awaitingPollWorker: boolean("awaitingPollWorker").notNull().default(false),
  /** Set when poll worker claims the row (`processing`); used to reclaim if the worker never completes. */
  processingStartedAt: timestamp("processingStartedAt"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  sentAt: timestamp("sentAt"),
  result: jsonb("result").$type<Record<string, unknown>>(),
  rejectionReason: text("rejectionReason"),
});

export type PendingIntent = InferSelectModel<typeof pendingIntent>;

export const sophonTask = pgTable(
  "SophonTask",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    userId: uuid("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    status: varchar("status", { length: 24 }).notNull().default("open"),
    source: varchar("source", { length: 24 }).notNull().default("manual"),
    dueAt: timestamp("dueAt"),
    effortFit: integer("effortFit").notNull().default(50),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  },
  (table) => ({
    userDueIdx: index("SophonTask_userId_dueAt_idx").on(
      table.userId,
      table.dueAt
    ),
  })
);

export type SophonTask = InferSelectModel<typeof sophonTask>;

export const sophonHabitState = pgTable(
  "SophonHabitState",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    userId: uuid("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    habitKey: varchar("habitKey", { length: 128 }).notNull(),
    lastReviewedAt: timestamp("lastReviewedAt"),
    stalenessStage: integer("stalenessStage").notNull().default(0),
    cooldownUntil: timestamp("cooldownUntil"),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  },
  (table) => ({
    userHabitUnique: uniqueIndex("SophonHabitState_userId_habitKey_unique").on(
      table.userId,
      table.habitKey
    ),
  })
);

export type SophonHabitState = InferSelectModel<typeof sophonHabitState>;

export const sophonActionLog = pgTable(
  "SophonActionLog",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    userId: uuid("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    actionType: varchar("actionType", { length: 64 }).notNull(),
    riskLevel: varchar("riskLevel", { length: 16 }).notNull(),
    mode: varchar("mode", { length: 16 }).notNull(),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
  },
  (table) => ({
    userCreatedIdx: index("SophonActionLog_userId_createdAt_idx").on(
      table.userId,
      table.createdAt
    ),
  })
);

export type SophonActionLog = InferSelectModel<typeof sophonActionLog>;

export const sophonDailyReview = pgTable(
  "SophonDailyReview",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    userId: uuid("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    reviewDate: date("reviewDate").notNull(),
    wins: text("wins").array().notNull().default(sql`'{}'::text[]`),
    misses: text("misses").array().notNull().default(sql`'{}'::text[]`),
    carryForward: text("carryForward")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    calibration: jsonb("calibration")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  },
  (table) => ({
    userReviewDateUnique: uniqueIndex(
      "SophonDailyReview_userId_reviewDate_unique"
    ).on(table.userId, table.reviewDate),
  })
);

export type SophonDailyReview = InferSelectModel<typeof sophonDailyReview>;

/** Batched HealthKit / Apple Watch metrics POSTed by a native companion app. */
export const healthSnapshot = pgTable(
  "HealthSnapshot",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    userId: uuid("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    periodStart: timestamp("periodStart", { withTimezone: true }).notNull(),
    periodEnd: timestamp("periodEnd", { withTimezone: true }).notNull(),
    source: varchar("source", { length: 64 }).notNull().default("apple-health"),
    payload: jsonb("payload")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    createdAt: timestamp("createdAt", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    userCreatedIdx: index("HealthSnapshot_userId_createdAt_idx").on(
      table.userId,
      table.createdAt
    ),
  })
);

export type HealthSnapshot = InferSelectModel<typeof healthSnapshot>;
