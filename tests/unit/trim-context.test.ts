import assert from "node:assert/strict";
import test from "node:test";
import {
  estimateTokens,
  trimMessagesForBudget,
} from "../../lib/ai/trim-context";

test("trimMessagesForBudget returns a bounded message list for long threads", () => {
  const messages = Array.from({ length: 20 }, (_, i) => ({
    role: i % 2 === 0 ? "user" : "assistant",
    content: `msg-${i}`,
  })) as { role: string; content: string }[];

  const trimmed = trimMessagesForBudget({
    messages,
    systemTokenCount: 50,
    maxContextTokens: 8000,
  });

  assert.ok(trimmed.length >= 2);
  assert.ok(trimmed.length <= messages.length);
});

test("estimateTokens scales with text length", () => {
  assert.ok(estimateTokens("hello world") > 0);
  assert.ok(estimateTokens("x".repeat(350)) >= 100);
});

test("oversized first user turn is compressed so recent tail can remain", () => {
  const hugeFirst = "U".repeat(1200);
  const trimmed = trimMessagesForBudget({
    messages: [
      { role: "user", content: hugeFirst },
      { role: "assistant", content: "short" },
      { role: "user", content: "middle ask" },
      { role: "assistant", content: "middle reply" },
      { role: "user", content: "latest ask" },
    ],
    systemTokenCount: 0,
    maxContextTokens: 800,
  });

  const firstOut = trimmed[0];
  assert.ok(firstOut);
  assert.equal(firstOut.role, "user");
  assert.ok(
    String(firstOut.content).length < hugeFirst.length,
    "first user blob should be capped"
  );
  assert.ok(String(firstOut.content).includes("..."));
  assert.equal(trimmed.at(-1)?.content, "latest ask");
});
