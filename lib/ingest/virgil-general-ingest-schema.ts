import { z } from "zod";

export const virgilGeneralIngestBodySchema = z.object({
  type: z.enum([
    "note",
    "link",
    "mood",
    "workout",
    "location",
    "quote",
    "idea",
  ]),
  content: z.string().min(1).max(4000),
  metadata: z.record(z.unknown()).optional(),
  source: z.string().max(64).optional().default("api"),
});

export type VirgilGeneralIngestBody = z.infer<
  typeof virgilGeneralIngestBodySchema
>;

export function mapIngestTypeToMemoryKind(
  type: VirgilGeneralIngestBody["type"]
): "note" | "fact" | "goal" | "opportunity" {
  switch (type) {
    case "idea":
      return "goal";
    case "mood":
    case "workout":
    case "location":
      return "fact";
    default:
      return "note";
  }
}
