"use server";

import { generateText } from "ai";
import { auth } from "@/app/(auth)/auth";
import { isLocalModel, titleModel } from "@/lib/ai/models";
import { getTitleModel } from "@/lib/ai/providers";
import {
  getBusinessProfileByUserId,
  getRecentMemories,
} from "@/lib/db/queries";
import {
  type ChatEmptySuggestion,
  GENERIC_HELPFUL_MIDDLES,
  pickRandom,
} from "@/lib/empty-suggestion-pools";

const PERSONALIZATION_SYSTEM = `You propose ONE question the user might tap as a suggested chip in their AI chat (two-line UI).
Reply with ONLY valid JSON (no markdown code fences): {"line1":"...","line2":"...","prompt":"..."}
Rules:
- line1: short first line, max 6 words
- line2: second line, max 9 words; together they read as one invitation to chat
- prompt: one clear question sentence — this exact text is sent as the user's message when they tap the chip
- Ground the question in MEMORY CONTEXT when it is non-empty; reference goals, projects, habits, or open threads naturally
- If MEMORY CONTEXT is empty, propose one warm, practical starter (energy, one priority, clarity, or checking in)`;

export async function getPersonalizedMiddleEmptySuggestion(): Promise<ChatEmptySuggestion> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return pickRandom(GENERIC_HELPFUL_MIDDLES);
    }

    const profile = await getBusinessProfileByUserId({
      userId: session.user.id,
    });
    if (!profile) {
      return pickRandom(GENERIC_HELPFUL_MIDDLES);
    }

    const memories = await getRecentMemories({
      userId: session.user.id,
      since: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
      limit: 18,
    });

    const name =
      session.user.name ?? session.user.email?.split("@")[0] ?? "User";
    const memoryBlock =
      memories.length === 0
        ? "(none yet)"
        : memories.map((m) => `- [${m.kind}] ${m.content}`).join("\n");

    const userBlob = `User display name: ${name}
MEMORY CONTEXT:
${memoryBlock}`;

    const { text } = await generateText({
      model: getTitleModel(),
      system: PERSONALIZATION_SYSTEM,
      prompt: userBlob,
      maxOutputTokens: 256,
      ...(isLocalModel(titleModel.id)
        ? {}
        : {
            providerOptions: {
              gateway: { order: titleModel.gatewayOrder },
            },
          }),
    });

    const parsed = parseSuggestionJson(text);
    if (parsed) {
      return parsed;
    }
  } catch {
    /* use fallback below */
  }
  return pickRandom(GENERIC_HELPFUL_MIDDLES);
}

function parseSuggestionJson(raw: string): ChatEmptySuggestion | null {
  const trimmed = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  try {
    const data = JSON.parse(trimmed) as {
      line1?: string;
      line2?: string;
      prompt?: string;
    };
    if (
      typeof data.line1 !== "string" ||
      typeof data.line2 !== "string" ||
      typeof data.prompt !== "string"
    ) {
      return null;
    }
    const line1 = data.line1.trim();
    const line2 = data.line2.trim();
    const prompt = data.prompt.trim();
    if (!line1 || !line2 || !prompt) {
      return null;
    }
    return { lines: [line1, line2] as const, prompt };
  } catch {
    return null;
  }
}
