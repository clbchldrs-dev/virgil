import assert from "node:assert/strict";
import test from "node:test";

import {
  type CompanionToolFailure,
  companionToolFailure,
} from "../../lib/ai/companion-tool-result";

test("companionToolFailure builds normalized failure payload", () => {
  const f: CompanionToolFailure = companionToolFailure({
    error: "companion_calendar_disabled",
    errorCode: "calendar_integration_disabled",
    retryable: false,
    message: "Calendar is off.",
    hint: "Set VIRGIL_CALENDAR_INTEGRATION=1.",
  });
  assert.equal(f.ok, false);
  assert.equal(f.errorCode, "calendar_integration_disabled");
  assert.equal(f.retryable, false);
  assert.equal(f.hint, "Set VIRGIL_CALENDAR_INTEGRATION=1.");
});
