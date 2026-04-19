import assert from "node:assert/strict";
import test from "node:test";

import {
  allowedModelIds,
  chatModels,
  resolveRuntimeModelId,
} from "../../lib/ai/models";

test("Virgil companion prompts emphasize chief-of-staff stance without sycophancy", async () => {
  const companion = await import("../../lib/ai/companion-prompt").catch(
    () => null
  );
  const slim = await import("../../lib/ai/slim-prompt").catch(() => null);
  assert.ok(companion, "expected companion-prompt module");
  assert.ok(slim, "expected slim-prompt module");

  const fullPrompt = companion.buildCompanionSystemPrompt({
    ownerName: "Caleb",
    memories: [],
    requestHints: {
      latitude: undefined,
      longitude: undefined,
      city: undefined,
      country: undefined,
    },
    supportsTools: true,
  });
  const slimPrompt = slim.buildSlimCompanionPrompt({
    ownerName: "Caleb",
    memories: [],
  });

  assert.match(fullPrompt, /You are Virgil/i);
  assert.match(fullPrompt, /chief of staff/i);
  assert.match(fullPrompt, /sycophancy/i);
  assert.doesNotMatch(fullPrompt, /About the user's request location/);
  assert.match(slimPrompt, /You are Virgil/i);
  assert.match(slimPrompt, /chief of staff/i);
  assert.match(slimPrompt, /sycophancy/i);
});

test("full companion system prompt places persona frame before session and tool sections", async () => {
  const companion = await import("../../lib/ai/companion-prompt").catch(
    () => null
  );
  assert.ok(companion, "expected companion-prompt module");

  const p = companion.buildCompanionSystemPrompt({
    ownerName: "Caleb",
    memories: [],
    requestHints: {
      latitude: undefined,
      longitude: undefined,
      city: undefined,
      country: undefined,
    },
    supportsTools: true,
  });
  const personaIdx = p.indexOf("You are Virgil");
  const dividerIdx = p.indexOf("## Session, memory, and tool context");
  const opsIdx = p.indexOf("Operating habits:");
  assert.ok(personaIdx !== -1 && dividerIdx !== -1 && opsIdx !== -1);
  assert.ok(personaIdx < dividerIdx && dividerIdx < opsIdx);
});

test("default slim assistant prompt is personal, not front-desk fallback", async () => {
  const slim = await import("../../lib/ai/slim-prompt").catch(() => null);
  assert.ok(slim, "expected slim-prompt module");

  const prompt = slim.buildSlimDefaultPrompt();

  assert.match(prompt, /Virgil/i);
  assert.doesNotMatch(prompt, /front desk assistant/i);
  assert.doesNotMatch(prompt, /No business profile has been set up yet/i);
});

test("ollama helpers prefer docker host URL and explain unreachable errors clearly", async () => {
  const providers = await import("../../lib/ai/providers").catch(() => null);
  assert.ok(providers, "expected providers module");
  assert.equal(typeof providers.getOllamaBaseUrl, "function");
  assert.equal(typeof providers.getOllamaConnectionErrorCause, "function");

  const previous = process.env.OLLAMA_BASE_URL;
  process.env.OLLAMA_BASE_URL = "";

  try {
    assert.equal(providers.getOllamaBaseUrl(), "http://127.0.0.1:11434");

    const message = providers.getOllamaConnectionErrorCause(
      new TypeError("fetch failed"),
      "http://host.docker.internal:11434"
    );

    assert.ok(message);
    assert.match(message, /Ollama is not reachable/i);
    assert.match(message, /host\.docker\.internal:11434/i);
  } finally {
    if (previous === undefined) {
      process.env.OLLAMA_BASE_URL = "";
    } else {
      process.env.OLLAMA_BASE_URL = previous;
    }
  }
});

test("local models define tuned local context settings", () => {
  const qwen3b = chatModels.find((model) => model.id === "ollama/qwen2.5:3b");
  const qwen7b = chatModels.find(
    (model) => model.id === "ollama/qwen2.5:7b-instruct"
  );
  const qwen3bTurbo = chatModels.find(
    (model) => model.id === "ollama/qwen2.5:3b-turbo"
  );
  const qwen7bLean = chatModels.find(
    (model) => model.id === "ollama/qwen2.5:7b-lean"
  );

  assert.ok(qwen3b, "expected qwen 3b local model");
  assert.ok(qwen7b, "expected qwen 7b local model");
  assert.ok(qwen3bTurbo, "expected qwen 3b turbo preset");
  assert.ok(qwen7bLean, "expected qwen 7b lean preset");

  assert.equal(qwen3b.promptVariant, "slim");
  assert.equal(qwen3b.localModelClass, "3b");
  assert.equal(qwen7b.localModelClass, "7b");
  assert.equal(qwen3b.maxContextTokens, 1600);
  assert.deepEqual(qwen3b.ollamaOptions, {
    num_ctx: 2048,
    num_predict: 512,
    temperature: 0.6,
    repeat_penalty: 1.1,
  });

  assert.equal(qwen7b.promptVariant, "slim");
  assert.equal(qwen7b.maxContextTokens, 3200);
  assert.deepEqual(qwen7b.ollamaOptions, {
    num_ctx: 4096,
    num_predict: 768,
    temperature: 0.7,
    repeat_penalty: 1.1,
  });

  assert.equal(qwen3bTurbo.runtimeModelId, "ollama/qwen2.5:3b");
  assert.equal(qwen3bTurbo.promptVariant, "compact");
  assert.equal(qwen3bTurbo.maxContextTokens, 1024);
  assert.deepEqual(qwen3bTurbo.ollamaOptions, {
    num_ctx: 1280,
    num_predict: 256,
    temperature: 0.45,
    repeat_penalty: 1.15,
  });

  assert.equal(qwen7bLean.runtimeModelId, "ollama/qwen2.5:7b-instruct");
  assert.equal(qwen7bLean.promptVariant, "slim");
  assert.equal(qwen7bLean.maxContextTokens, 2048);
  assert.deepEqual(qwen7bLean.ollamaOptions, {
    num_ctx: 2560,
    num_predict: 384,
    temperature: 0.55,
    repeat_penalty: 1.15,
  });
});

test("local preset ids are allowed and resolve to the pulled Ollama tag", () => {
  assert.equal(resolveRuntimeModelId("ollama/qwen2.5:3b"), "ollama/qwen2.5:3b");
  assert.equal(
    resolveRuntimeModelId("ollama/qwen2.5:3b-turbo"),
    "ollama/qwen2.5:3b"
  );
  assert.equal(
    resolveRuntimeModelId("ollama/qwen2.5:7b-lean"),
    "ollama/qwen2.5:7b-instruct"
  );
  assert.equal(
    resolveRuntimeModelId("moonshotai/kimi-k2-0905"),
    "moonshotai/kimi-k2-0905"
  );

  assert.equal(allowedModelIds.has("ollama/qwen2.5:3b-turbo"), true);
  assert.equal(allowedModelIds.has("ollama/qwen2.5:7b-lean"), true);
});

test("slim companion prompt stays chief-of-staff direct and is honest about limited memory", async () => {
  const mod = await import("../../lib/ai/slim-prompt").catch(() => null);
  assert.ok(mod, "expected slim-prompt module");

  const prompt = mod.buildSlimCompanionPrompt({
    ownerName: "Caleb",
    memories: [
      { kind: "goal" as const, content: "Wants a local-first personal AI." },
      {
        kind: "fact" as const,
        content: "Uses an M1 MacBook Air with 8GB RAM.",
      },
      {
        kind: "note" as const,
        content: "Prefers honest answers over bluffing.",
      },
    ],
  });

  assert.match(prompt, /chief of staff/i);
  assert.match(prompt, /limited memory/i);
  assert.match(prompt, /Don't claim to remember things you can't see/i);
  // Slim/local prompt may mention the tool names to clarify they are unavailable.
  assert.match(prompt, /no saveMemory or recallMemory tools/i);
  assert.doesNotMatch(prompt, /setReminder/);
  assert.doesNotMatch(prompt, /Artifacts is a side panel/i);
});

test("slim companion prompt tightens length guidance for 3B-class models", async () => {
  const mod = await import("../../lib/ai/slim-prompt").catch(() => null);
  assert.ok(mod, "expected slim-prompt module");

  const slim7b = mod.buildSlimCompanionPrompt({
    ownerName: "Caleb",
    memories: [],
    localModelClass: "7b",
  });
  const slim3b = mod.buildSlimCompanionPrompt({
    ownerName: "Caleb",
    memories: [],
    localModelClass: "3b",
  });

  assert.match(slim7b, /usually 2-3 sentences/i);
  assert.match(slim7b, /bullet lists/i);
  assert.match(slim7b, /latest user message/i);
  assert.doesNotMatch(slim7b, /one sub-question at a time/i);
  assert.match(slim3b, /1-2 sentences/i);
  assert.match(slim3b, /one sub-question at a time/i);
  assert.match(slim3b, /latest instruction literally/i);
});

test("full companion prompt applies local class splits when localModelClass is set", async () => {
  const companion = await import("../../lib/ai/companion-prompt").catch(
    () => null
  );
  assert.ok(companion, "expected companion-prompt module");

  const baseHints = {
    latitude: undefined,
    longitude: undefined,
    city: undefined,
    country: undefined,
  };

  const gatewayFull = companion.buildCompanionSystemPrompt({
    ownerName: "Caleb",
    memories: [],
    requestHints: baseHints,
    supportsTools: true,
  });
  const localFull3b = companion.buildCompanionSystemPrompt({
    ownerName: "Caleb",
    memories: [],
    requestHints: baseHints,
    supportsTools: false,
    localModelClass: "3b",
  });
  const localFull7b = companion.buildCompanionSystemPrompt({
    ownerName: "Caleb",
    memories: [],
    requestHints: baseHints,
    supportsTools: false,
    localModelClass: "7b",
  });

  assert.doesNotMatch(gatewayFull, /Local model capability/i);
  assert.match(localFull3b, /Local model capability \(3B-class\)/i);
  assert.match(localFull3b, /1-2 sentences/i);
  assert.match(localFull3b, /one sub-question at a time/i);
  assert.match(localFull3b, /latest instruction literally/i);
  assert.match(localFull7b, /Local model capability \(7B-class\)/i);
  assert.match(localFull7b, /usually 2-3 sentences/i);
  assert.match(localFull7b, /latest user message/i);
});

test("trimMessagesForBudget keeps thread edges and inserts a trim marker", async () => {
  const mod = await import("../../lib/ai/trim-context").catch(() => null);
  assert.ok(mod, "expected trim-context module");

  const longAssistant = "A".repeat(900);

  const trimmed = mod.trimMessagesForBudget({
    messages: [
      { role: "user", content: "First thread intent" },
      { role: "assistant", content: "reply one" },
      { role: "user", content: "middle user one" },
      { role: "assistant", content: longAssistant },
      { role: "user", content: "latest question" },
      { role: "assistant", content: "latest answer" },
    ],
    systemTokenCount: 200,
    maxContextTokens: 260,
  });

  assert.equal(trimmed[0]?.content, "First thread intent");
  assert.ok(
    trimmed.some((message: { content: string }) =>
      message.content.includes("[earlier conversation trimmed]")
    )
  );
  assert.equal(trimmed.at(-2)?.content, "latest question");
  assert.equal(trimmed.at(-1)?.content, "latest answer");

  const compressedAssistant = trimmed.find(
    (message: { role: string; content: string }) =>
      message.role === "assistant" && message.content.startsWith("AAAA")
  );
  if (compressedAssistant) {
    assert.ok(compressedAssistant.content.length < longAssistant.length);
  }
});

test("trimMessagesForBudget truncates oversized short histories to stay within budget", async () => {
  const mod = await import("../../lib/ai/trim-context").catch(() => null);
  assert.ok(mod, "expected trim-context module");

  const trimmed = mod.trimMessagesForBudget({
    messages: [{ role: "user", content: "B".repeat(900) }],
    systemTokenCount: 200,
    maxContextTokens: 260,
  });

  assert.equal(trimmed.length, 1);
  assert.equal(trimmed[0]?.role, "user");
  assert.match(String(trimmed[0]?.content), /\[message truncated\]/i);
  assert.ok(
    mod.estimateTokens(trimmed[0]?.content) <= 60,
    "expected truncated short history to fit remaining budget"
  );
});

test("buildLocalChatTitleFromUserMessage derives a short title without an LLM", async () => {
  const mod = await import("../../lib/ai/local-title").catch(() => null);
  assert.ok(mod, "expected local-title module");
  assert.equal(typeof mod.buildLocalChatTitleFromUserMessage, "function");

  const title = mod.buildLocalChatTitleFromUserMessage(
    "Help me turn my local assistant into something lighter and faster without losing its personality in the process."
  );

  assert.equal(title, "Help me turn my local assistant into something...");
});

test("ollama smoke helper defaults to local models and rejects non-local ids", async () => {
  const mod = await import("../../lib/ai/ollama-smoke").catch(() => null);
  assert.ok(mod, "expected ollama-smoke module");

  assert.deepEqual(mod.resolveOllamaSmokeModelIds([]), [
    "ollama/qwen2.5:3b",
    "ollama/qwen2.5:3b-turbo",
    "ollama/qwen2.5:7b-instruct",
    "ollama/qwen2.5:7b-lean",
    "ollama/qwen2.5:7b-review",
  ]);

  assert.deepEqual(mod.resolveOllamaSmokeModelIds(["ollama/qwen2.5:7b-lean"]), [
    "ollama/qwen2.5:7b-lean",
  ]);

  assert.throws(
    () => mod.resolveOllamaSmokeModelIds(["moonshotai/kimi-k2-0905"]),
    /local ollama model/i
  );
  assert.throws(
    () => mod.resolveOllamaSmokeModelIds(["ollama/not-installed"]),
    /unknown model id/i
  );
});

test("buildSmokeTimingReport prefers provider tokens and splits wall vs stream rates", async () => {
  const smoke = await import("../../lib/ai/ollama-smoke");
  const startedAt = 1_000_000;
  const firstTokenAt = startedAt + 2000;
  const endedAt = startedAt + 10_000;

  const report = smoke.buildSmokeTimingReport({
    startedAt,
    firstTokenAt,
    endedAt,
    providerOutputTokens: 100,
    outputText: "x".repeat(350),
  });

  assert.equal(report.firstTokenMs, 2000);
  assert.equal(report.totalMs, 10_000);
  assert.equal(report.generationPhaseMs, 8000);
  assert.equal(report.rateSource, "provider");
  assert.equal(report.tokensForRate, 100);
  assert.ok(report.tokensPerSecWall !== null);
  assert.ok(report.tokensPerSecStream !== null);
  assert.equal(report.tokensPerSecWall, 10);
  assert.equal(report.tokensPerSecStream, 12.5);
});

test("buildSmokeTimingReport falls back to estimated tokens when provider omits count", async () => {
  const smoke = await import("../../lib/ai/ollama-smoke");
  const startedAt = 0;
  const endedAt = 3500;
  const text = "a".repeat(35);

  const report = smoke.buildSmokeTimingReport({
    startedAt,
    firstTokenAt: 500,
    endedAt,
    providerOutputTokens: undefined,
    outputText: text,
  });

  assert.equal(report.rateSource, "estimated");
  assert.equal(report.tokensForRate, 10);
  assert.equal(report.tokensPerSecWall, 10 / 3.5);
  assert.equal(report.tokensPerSecStream, 10 / 3);
});
