import {
  chatModels,
  getAllGatewayModels,
  getCapabilities,
  isDemo,
} from "@/lib/ai/models";
import {
  filterChatModelsByAvailableOllamaTags,
  getDiscoveredOllamaChatModels,
  getOllamaTagNames,
} from "@/lib/ai/ollama-discovery";

export async function GET() {
  const headers = {
    "Cache-Control":
      "public, max-age=120, s-maxage=120, stale-while-revalidate=600",
  };

  const tagNames = await getOllamaTagNames();
  const curatedFiltered = filterChatModelsByAvailableOllamaTags(
    chatModels,
    tagNames
  );
  const curatedCapabilities = await getCapabilities();
  const discovered = await getDiscoveredOllamaChatModels();
  const discoveredCaps = Object.fromEntries(
    discovered.map((m) => [
      m.id,
      { tools: false, vision: false, reasoning: false },
    ])
  );
  const mergedModels = [...curatedFiltered, ...discovered];
  const modelIds = new Set(mergedModels.map((m) => m.id));
  const mergedCapabilities = Object.fromEntries(
    Object.entries({ ...curatedCapabilities, ...discoveredCaps }).filter(
      ([id]) => modelIds.has(id)
    )
  );

  if (isDemo) {
    const models = await getAllGatewayModels();
    const capabilities = Object.fromEntries(
      models.map((m) => [m.id, mergedCapabilities[m.id] ?? m.capabilities])
    );

    return Response.json({ capabilities, models }, { headers });
  }

  return Response.json(
    { capabilities: mergedCapabilities, models: mergedModels },
    { headers }
  );
}
