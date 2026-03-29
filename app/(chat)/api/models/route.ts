import {
  chatModels,
  getAllGatewayModels,
  getCapabilities,
  isDemo,
} from "@/lib/ai/models";
import { getDiscoveredOllamaChatModels } from "@/lib/ai/ollama-discovery";

export async function GET() {
  const headers = {
    "Cache-Control":
      "public, max-age=120, s-maxage=120, stale-while-revalidate=600",
  };

  const curatedCapabilities = await getCapabilities();
  const discovered = await getDiscoveredOllamaChatModels();
  const discoveredCaps = Object.fromEntries(
    discovered.map((m) => [
      m.id,
      { tools: false, vision: false, reasoning: false },
    ])
  );
  const mergedCapabilities = { ...curatedCapabilities, ...discoveredCaps };
  const mergedModels = [...chatModels, ...discovered];

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
