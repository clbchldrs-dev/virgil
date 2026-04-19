import assert from "node:assert/strict";
import { afterEach, describe, test } from "node:test";
import { DEFAULT_CHAT_MODEL } from "../../lib/ai/models";
import { VirgilError } from "../../lib/errors";

const ENV_KEYS = [
  "VIRGIL_CHAT_FALLBACK",
  "GOOGLE_GENERATIVE_AI_API_KEY",
  "VIRGIL_FALLBACK_GEMINI_MODEL",
  "VIRGIL_FALLBACK_GATEWAY_MODEL",
] as const;

function clearEnv() {
  for (const k of ENV_KEYS) {
    delete process.env[k];
  }
}

/** Dynamic import so each test picks up fresh env reads. */
async function loadModule() {
  const ts = Date.now();
  const mod = await import(`../../lib/ai/chat-fallback.ts?_t=${ts}`);
  return mod as typeof import("../../lib/ai/chat-fallback");
}

describe("isChatFallbackEnabled", () => {
  afterEach(clearEnv);

  test("returns false when env is unset", async () => {
    const { isChatFallbackEnabled } = await loadModule();
    assert.equal(isChatFallbackEnabled(), false);
  });

  test('returns true when VIRGIL_CHAT_FALLBACK is "1"', async () => {
    process.env.VIRGIL_CHAT_FALLBACK = "1";
    const { isChatFallbackEnabled } = await loadModule();
    assert.equal(isChatFallbackEnabled(), true);
  });

  test('returns true when VIRGIL_CHAT_FALLBACK is "true"', async () => {
    process.env.VIRGIL_CHAT_FALLBACK = "true";
    const { isChatFallbackEnabled } = await loadModule();
    assert.equal(isChatFallbackEnabled(), true);
  });

  test("returns false for arbitrary non-truthy values", async () => {
    process.env.VIRGIL_CHAT_FALLBACK = "yes";
    const { isChatFallbackEnabled } = await loadModule();
    assert.equal(isChatFallbackEnabled(), false);
  });
});

describe("getFallbackTiers", () => {
  afterEach(clearEnv);

  test("includes gemini when API key is set, gateway always last", async () => {
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = "test-key";
    const { getFallbackTiers } = await loadModule();
    const tiers = getFallbackTiers();
    assert.deepEqual(tiers, ["gemini", "gateway"]);
  });

  test("skips gemini when API key is missing", async () => {
    const { getFallbackTiers } = await loadModule();
    const tiers = getFallbackTiers();
    assert.deepEqual(tiers, ["gateway"]);
  });

  test("skips gemini when API key is whitespace", async () => {
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = "   ";
    const { getFallbackTiers } = await loadModule();
    const tiers = getFallbackTiers();
    assert.deepEqual(tiers, ["gateway"]);
  });
});

describe("getFallbackGeminiModel / getFallbackGatewayModel", () => {
  afterEach(clearEnv);

  test("returns defaults when env is unset", async () => {
    const { getFallbackGeminiModel, getFallbackGatewayModel } =
      await loadModule();
    assert.equal(getFallbackGeminiModel(), "gemini-2.5-flash");
    assert.equal(getFallbackGatewayModel(), DEFAULT_CHAT_MODEL);
  });

  test("respects env overrides", async () => {
    process.env.VIRGIL_FALLBACK_GEMINI_MODEL = "gemini-2.5-pro";
    process.env.VIRGIL_FALLBACK_GATEWAY_MODEL = "openai/gpt-4o-mini";
    const { getFallbackGeminiModel, getFallbackGatewayModel } =
      await loadModule();
    assert.equal(getFallbackGeminiModel(), "gemini-2.5-pro");
    assert.equal(getFallbackGatewayModel(), "openai/gpt-4o-mini");
  });
});

describe("isFallbackEligibleError", () => {
  afterEach(clearEnv);

  test("VirgilError offline:ollama is eligible", async () => {
    const { isFallbackEligibleError } = await loadModule();
    const err = new VirgilError(
      "offline:ollama",
      "Ollama is not reachable at http://127.0.0.1:11434"
    );
    assert.equal(isFallbackEligibleError(err), true);
  });

  test("VirgilError for non-ollama surface is not eligible", async () => {
    const { isFallbackEligibleError } = await loadModule();
    const err = new VirgilError("offline:chat");
    assert.equal(isFallbackEligibleError(err), false);
  });

  test("connection refused error is eligible", async () => {
    const { isFallbackEligibleError } = await loadModule();
    const err = new Error("fetch failed: ECONNREFUSED");
    assert.equal(isFallbackEligibleError(err), true);
  });

  test("model not found error is eligible", async () => {
    const { isFallbackEligibleError } = await loadModule();
    const err = new Error("model 'qwen2.5:3b' not found");
    assert.equal(isFallbackEligibleError(err), true);
  });

  test("timeout error is eligible", async () => {
    const { isFallbackEligibleError } = await loadModule();
    const err = new Error("request timed out");
    assert.equal(isFallbackEligibleError(err), true);
  });

  test("404 status code is eligible", async () => {
    const { isFallbackEligibleError } = await loadModule();
    const err = new Error("Response status code: 404");
    assert.equal(isFallbackEligibleError(err), true);
  });

  test("generic error is not eligible", async () => {
    const { isFallbackEligibleError } = await loadModule();
    const err = new Error("something went wrong");
    assert.equal(isFallbackEligibleError(err), false);
  });

  test("non-Error value is not eligible", async () => {
    const { isFallbackEligibleError } = await loadModule();
    assert.equal(isFallbackEligibleError("string error"), false);
    assert.equal(isFallbackEligibleError(null), false);
    assert.equal(isFallbackEligibleError(42), false);
  });

  test("socket error is eligible", async () => {
    const { isFallbackEligibleError } = await loadModule();
    const err = new Error("socket hang up");
    assert.equal(isFallbackEligibleError(err), true);
  });
});
