import { z } from "zod";

export const channelSchema = z.enum(["slack", "whatsapp", "sms"]);
export type Channel = z.infer<typeof channelSchema>;

export const trustTierSchema = z.enum(["unknown", "acquaintance", "trusted"]);
export type TrustTier = z.infer<typeof trustTierSchema>;

export const interferenceModeSchema = z.enum([
  "shield",
  "assistant",
  "autopilot-lite",
]);
export type InterferenceMode = z.infer<typeof interferenceModeSchema>;

export const policyRouteSchema = z.enum(["auto", "approval", "block", "hold"]);
export type PolicyRoute = z.infer<typeof policyRouteSchema>;

export const inboundMessageSchema = z.object({
  channel: channelSchema,
  externalThreadId: z.string().min(1),
  externalMessageId: z.string().min(1),
  senderId: z.string().min(1),
  senderLabel: z.string().optional(),
  bodyText: z.string(),
  receivedAt: z.string().datetime({ offset: true }),
  rawMetadata: z.record(z.string(), z.unknown()).optional(),
});
export type InboundMessage = z.infer<typeof inboundMessageSchema>;

export const draftReplySchema = z.object({
  id: z.string().min(1),
  inboundMessageId: z.string().min(1),
  channel: channelSchema,
  externalThreadId: z.string().min(1),
  text: z.string().min(1),
  createdAt: z.string().datetime({ offset: true }),
  policySnapshot: z.record(z.string(), z.unknown()),
});
export type DraftReply = z.infer<typeof draftReplySchema>;

export const approvalStatusSchema = z.enum([
  "pending",
  "approved",
  "rejected",
  "superseded",
]);
export type ApprovalStatus = z.infer<typeof approvalStatusSchema>;

export const pendingApprovalSchema = z.object({
  id: z.string().min(1),
  status: approvalStatusSchema,
  draft: draftReplySchema,
  createdAt: z.string().datetime({ offset: true }),
  resolvedAt: z.string().datetime({ offset: true }).optional(),
});
export type PendingApproval = z.infer<typeof pendingApprovalSchema>;

export const outboundMessageSchema = z.object({
  id: z.string().min(1),
  channel: channelSchema,
  externalThreadId: z.string().min(1),
  text: z.string().min(1),
  idempotencyKey: z.string().min(1),
  sourceApprovalId: z.string().optional(),
  createdAt: z.string().datetime({ offset: true }),
});
export type OutboundMessage = z.infer<typeof outboundMessageSchema>;

export const ingestRequestSchema = z.object({
  message: inboundMessageSchema,
  ownerTrustTier: trustTierSchema.optional(),
  mode: interferenceModeSchema.optional(),
});
export type IngestRequest = z.infer<typeof ingestRequestSchema>;
