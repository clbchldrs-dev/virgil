import { z } from "zod";

export const memoryBridgeKindSchema = z.enum([
  "note",
  "fact",
  "goal",
  "opportunity",
]);

export const memoryBridgeBodySchema = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("search"),
    query: z.string().min(1).max(4000),
    kind: memoryBridgeKindSchema.optional(),
    limit: z.number().int().min(1).max(50).optional(),
  }),
  z.object({
    op: z.literal("save"),
    kind: memoryBridgeKindSchema,
    content: z.string().min(1).max(100_000),
    metadata: z.record(z.unknown()).optional(),
    chatId: z.string().uuid().optional(),
  }),
]);

export type MemoryBridgeBody = z.infer<typeof memoryBridgeBodySchema>;
