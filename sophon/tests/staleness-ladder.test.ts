import assert from "node:assert/strict";
import { test } from "node:test";

import { nextStalenessStage } from "../src/staleness-ladder";

test("staleness ladder escalates progressively", () => {
  assert.equal(nextStalenessStage({ currentStage: 0, staleDays: 3 }).stage, 1);
  assert.equal(nextStalenessStage({ currentStage: 1, staleDays: 7 }).stage, 2);
  assert.equal(nextStalenessStage({ currentStage: 2, staleDays: 14 }).stage, 3);
});
