import assert from "node:assert/strict";
import test from "node:test";

import { buildVirgilLaneGuidanceBlock } from "../../lib/ai/lanes";

test("lane guidance names Hermes when delegation enabled with hermes backend", () => {
  const block = buildVirgilLaneGuidanceBlock({
    enabled: true,
    backend: "hermes",
  });
  assert.match(block, /delegateTask.*Hermes/i);
  assert.doesNotMatch(block, /OPENCLAW is configured/);
});

test("lane guidance explains delegateTask missing when delegation disabled", () => {
  const block = buildVirgilLaneGuidanceBlock({
    enabled: false,
    backend: "openclaw",
  });
  assert.match(block, /delegateTask.*only when it appears/i);
});
