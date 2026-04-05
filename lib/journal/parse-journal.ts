import "server-only";

import { existsSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { generateObject } from "ai";
import { isLocalModel } from "@/lib/ai/models";
import { assertOllamaReachable } from "@/lib/ai/providers";
import {
  memoryExistsWithSourceDateAndContent,
  saveMemoryRecord,
} from "@/lib/db/queries";
import { journalParseOutputSchema } from "@/lib/journal/journal-parse-schema";
import { getNightReviewModelId } from "@/lib/night-review/config";
import {
  getNightReviewChatModelProfile,
  resolveNightReviewLanguageModel,
} from "@/lib/night-review/night-review-model";
import {
  getVirgilJournalFilePath,
  isVirgilJournalFileParseEnabled,
} from "@/lib/virgil/integrations";

const JOURNAL_STALE_MS = 24 * 60 * 60 * 1000;
const MIN_CHARS = 100;

function resolveJournalAbsolutePath(configPath: string): string {
  return path.isAbsolute(configPath)
    ? configPath
    : path.join(process.cwd(), configPath);
}

function todayKeyInTimeZone(timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/**
 * Reads `VIRGIL_JOURNAL_FILE_PATH` (or `workspace/journal/today.md`), optionally overridden by `journalTextOverride` for serverless.
 * Uses the same model stack as night review (`NIGHT_REVIEW_MODEL`).
 */
export async function parseJournal({
  userId,
  journalTextOverride,
  timeZone = "UTC",
}: {
  userId: string;
  journalTextOverride?: string | null;
  /** IANA zone for metadata `date` (default UTC). */
  timeZone?: string;
}): Promise<{ created: number; skippedReason?: string }> {
  if (!isVirgilJournalFileParseEnabled()) {
    return { created: 0, skippedReason: "disabled" };
  }

  const modelId = getNightReviewModelId();
  const resolvedModel = resolveNightReviewLanguageModel(
    modelId,
    getNightReviewChatModelProfile(modelId)?.ollamaOptions
  );
  if (!resolvedModel.ok) {
    return { created: 0, skippedReason: "model_not_configured" };
  }

  let text: string;
  if (journalTextOverride != null && journalTextOverride.trim().length > 0) {
    text = journalTextOverride.trim();
  } else {
    const rel = getVirgilJournalFilePath();
    const abs = resolveJournalAbsolutePath(rel);
    if (!existsSync(abs)) {
      return { created: 0, skippedReason: "file_missing" };
    }
    const st = await stat(abs);
    if (Date.now() - st.mtimeMs > JOURNAL_STALE_MS) {
      return { created: 0, skippedReason: "file_stale" };
    }
    text = (await readFile(abs, "utf8")).trim();
  }

  if (text.length <= MIN_CHARS) {
    return { created: 0, skippedReason: "content_too_short" };
  }

  if (isLocalModel(modelId)) {
    try {
      await assertOllamaReachable();
    } catch {
      return { created: 0, skippedReason: "ollama_unreachable" };
    }
  }

  const date = todayKeyInTimeZone(timeZone);

  const { object } = await generateObject({
    model: resolvedModel.model,
    schema: journalParseOutputSchema,
    system:
      "You extract structured notes from a personal journal. Output only via the schema.",
    prompt: `Extract 3–5 key facts, goals mentioned, and mood from this journal entry. Each item must stand alone without conversation context.\n\n---\n${text.slice(0, 12_000)}\n---`,
    maxOutputTokens: 1024,
  });

  let created = 0;
  for (const row of object.items) {
    const content = row.text.trim();
    if (!content) {
      continue;
    }
    const exists = await memoryExistsWithSourceDateAndContent({
      userId,
      content,
      source: "journal-parse",
      date,
    });
    if (exists) {
      continue;
    }
    await saveMemoryRecord({
      userId,
      kind: "note",
      content,
      metadata: { source: "journal-parse", date },
    });
    created += 1;
  }

  return { created };
}
