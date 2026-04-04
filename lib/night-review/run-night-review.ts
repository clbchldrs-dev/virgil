import "server-only";

import { generateObject } from "ai";
import { Resend } from "resend";
import { isLocalModel } from "@/lib/ai/models";
import { assertOllamaReachable } from "@/lib/ai/providers";
import {
  countMessagesForUserInWindow,
  getMessagesForUserInWindow,
  getRecentMemories,
  getUserById,
  hasCompletedNightReviewForWindow,
  saveMemoryRecord,
  saveNightReviewRunLog,
} from "@/lib/db/queries";
import {
  buildExcerptBlock,
  buildNightReviewSystemPrompt,
  buildNightReviewUserContent,
  buildRollupFromRows,
  formatMemoriesForPrompt,
  formatRollupForPrompt,
} from "@/lib/night-review/build-context";
import {
  getNightReviewModelId,
  getNightReviewTimezone,
} from "@/lib/night-review/config";
import {
  getNightReviewChatModelProfile,
  resolveNightReviewLanguageModel,
} from "@/lib/night-review/night-review-model";
import { runNightlyReview } from "@/lib/night-review/proposal-tier";
import { nightReviewOutputSchema } from "@/lib/night-review/schema";
import { loadNightWorkspaceFiles } from "@/lib/night-review/workspace";

export type NightReviewWorkerPayload = {
  userId: string;
  windowStart: string;
  windowEnd: string;
  runId: string;
  windowKey: string;
};

const BASE_METADATA = (windowKey: string, runId: string) =>
  ({
    source: "night-review",
    windowKey,
    runId,
  }) as Record<string, unknown>;

async function maybeEmailNightReviewFindings({
  userId,
  windowKey,
  summaryLine,
}: {
  userId: string;
  windowKey: string;
  summaryLine: string;
}) {
  if (process.env.NIGHT_REVIEW_EMAIL_ON_FINDINGS !== "1") {
    return;
  }
  if (!process.env.RESEND_API_KEY) {
    return;
  }
  const u = await getUserById({ id: userId });
  const email = u?.email;
  if (!email || email.startsWith("guest-")) {
    return;
  }
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: "Assistant <onboarding@resend.dev>",
      to: email,
      subject: `Virgil night review — ${windowKey}`,
      text: `${summaryLine}\n\nOpen Virgil to see full notes in memory.`,
    });
  } catch (e) {
    console.error("Night review findings email failed:", e);
  }
}

export async function runNightReviewForUser(
  payload: NightReviewWorkerPayload
): Promise<{ skipped: boolean; reason?: string }> {
  const started = Date.now();
  const modelId = getNightReviewModelId();
  const logCtx: {
    outcome: "ok" | "findings" | "skipped" | "error";
    err?: string;
  } = { outcome: "error" };

  try {
    const resolvedModel = resolveNightReviewLanguageModel(
      modelId,
      getNightReviewChatModelProfile(modelId)?.ollamaOptions
    );
    if (!resolvedModel.ok) {
      logCtx.outcome = "skipped";
      logCtx.err = resolvedModel.reason;
      return { skipped: true, reason: "model_not_configured" };
    }
    const languageModel = resolvedModel.model;

    const windowStart = new Date(payload.windowStart);
    const windowEnd = new Date(payload.windowEnd);
    const tz = getNightReviewTimezone();

    const done = await hasCompletedNightReviewForWindow({
      userId: payload.userId,
      windowKey: payload.windowKey,
    });
    if (done) {
      logCtx.outcome = "skipped";
      return { skipped: true, reason: "already_completed" };
    }

    const [totalMessages, rows, memories, workspace] = await Promise.all([
      countMessagesForUserInWindow({
        userId: payload.userId,
        windowStart,
        windowEnd,
      }),
      getMessagesForUserInWindow({
        userId: payload.userId,
        windowStart,
        windowEnd,
      }),
      getRecentMemories({
        userId: payload.userId,
        since: windowStart,
        limit: 40,
      }),
      loadNightWorkspaceFiles().catch(() => null),
    ]);

    if (!workspace) {
      throw new Error("Night workspace files missing under workspace/night/");
    }

    const rollup = buildRollupFromRows(
      rows,
      totalMessages,
      windowStart,
      windowEnd
    );
    const rollupText = formatRollupForPrompt(rollup, rows);
    const excerptBlock = buildExcerptBlock(rows);
    const memoriesBlock = formatMemoriesForPrompt(memories);

    if (isLocalModel(modelId)) {
      await assertOllamaReachable();
    }

    const system = buildNightReviewSystemPrompt(workspace);
    const userContent = buildNightReviewUserContent({
      rollupText,
      excerptBlock,
      memoriesBlock,
    });

    const { object } = await generateObject({
      model: languageModel,
      schema: nightReviewOutputSchema,
      system,
      prompt: userContent,
      maxOutputTokens: 2048,
    });

    const metaBase = BASE_METADATA(payload.windowKey, payload.runId);

    if (object.status === "ok") {
      logCtx.outcome = "ok";
      await saveMemoryRecord({
        userId: payload.userId,
        kind: "note",
        content: `Night review (${payload.windowKey}, ${tz}): no material findings.`,
        metadata: { ...metaBase, phase: "complete" },
      });
      return { skipped: false };
    }

    logCtx.outcome = "findings";

    const patterns = object.patterns ?? [];
    const toolGaps = object.toolGaps ?? [];
    const suggestedMemories = object.suggestedMemories ?? [];
    const improvements = object.improvements ?? [];

    if (object.summary?.trim()) {
      await saveMemoryRecord({
        userId: payload.userId,
        kind: "note",
        content: `Night review summary: ${object.summary.trim()}`,
        metadata: { ...metaBase, phase: "finding", facet: "summary" },
      });
    }

    for (const p of patterns) {
      if (!p.description?.trim()) {
        continue;
      }
      await saveMemoryRecord({
        userId: payload.userId,
        kind: "note",
        content: `Pattern: ${p.description.trim()}${p.evidence ? ` — ${p.evidence.trim()}` : ""}`,
        metadata: { ...metaBase, phase: "finding", facet: "pattern" },
      });
    }

    for (const g of toolGaps) {
      if (!g.description?.trim()) {
        continue;
      }
      await saveMemoryRecord({
        userId: payload.userId,
        kind: "opportunity",
        content: `Tool / skill gap: ${g.description.trim()}${g.suggestedSkill ? ` (idea: ${g.suggestedSkill.trim()})` : ""}`,
        metadata: { ...metaBase, phase: "finding", facet: "toolGap" },
      });
    }

    for (const s of suggestedMemories) {
      if (!s.content?.trim()) {
        continue;
      }
      await saveMemoryRecord({
        userId: payload.userId,
        kind: s.kind,
        content: s.content.trim(),
        metadata: { ...metaBase, phase: "finding", facet: "suggestedMemory" },
      });
    }

    for (const line of improvements) {
      if (!line?.trim()) {
        continue;
      }
      await saveMemoryRecord({
        userId: payload.userId,
        kind: "note",
        content: `Improvement idea: ${line.trim()}`,
        metadata: { ...metaBase, phase: "finding", facet: "improvement" },
      });
    }

    await saveMemoryRecord({
      userId: payload.userId,
      kind: "note",
      content: `Night review completed for window ${payload.windowKey} (run ${payload.runId.slice(0, 8)}…).`,
      metadata: { ...metaBase, phase: "complete" },
    });

    const summaryLine =
      object.summary?.trim() ||
      "Night review recorded new findings and ideas in your memory.";

    await maybeEmailNightReviewFindings({
      userId: payload.userId,
      windowKey: payload.windowKey,
      summaryLine,
    });

    try {
      await runNightlyReview(payload.userId);
    } catch {
      // Tier-1 proposal memories are best-effort.
    }

    return { skipped: false };
  } catch (e) {
    logCtx.err = String(e);
    throw e;
  } finally {
    try {
      await saveNightReviewRunLog({
        userId: payload.userId,
        windowKey: payload.windowKey,
        runId: payload.runId,
        modelId,
        outcome: logCtx.outcome,
        durationMs: Math.max(0, Date.now() - started),
        error: logCtx.err,
      });
    } catch (logErr) {
      console.error("saveNightReviewRunLog failed:", logErr);
    }
  }
}
