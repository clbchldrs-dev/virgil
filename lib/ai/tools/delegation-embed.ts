import { tool } from "ai";
import { z } from "zod";
import {
  delegationEmbedLimits,
  fetchDelegationEmbeddings,
} from "@/lib/integrations/delegation-embeddings";
import { buildDelegateEmbeddingToolDescription } from "@/lib/integrations/delegation-labels";

export function embedViaDelegation() {
  const { maxTexts, maxCharsPerText } = delegationEmbedLimits();
  return tool({
    description: buildDelegateEmbeddingToolDescription(),
    inputSchema: z.object({
      texts: z
        .array(z.string().min(1).max(maxCharsPerText))
        .min(1)
        .max(maxTexts)
        .describe(
          "One or more text chunks to embed on the LAN delegation host (e.g. wiki passages for hybrid search). Same order is preserved in returned vectors."
        ),
    }),
    execute: async ({ texts }) => {
      const result = await fetchDelegationEmbeddings(texts);
      if (!result.ok) {
        return {
          ok: false as const,
          error: result.error,
          backend: result.backend,
        };
      }
      return {
        ok: true as const,
        backend: result.backend,
        count: result.embeddings.length,
        dimensions: result.embeddings.at(0)?.length ?? 0,
        model: result.model ?? null,
        embeddings: result.embeddings,
      };
    },
  });
}
