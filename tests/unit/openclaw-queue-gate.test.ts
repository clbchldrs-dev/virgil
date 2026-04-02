import assert from "node:assert/strict";
import test from "node:test";

import { pendingIntentBlocksImmediateSend } from "../../lib/integrations/openclaw-queue-gate";

test("pendingIntentBlocksImmediateSend when confirmation required and still pending", () => {
  assert.equal(
    pendingIntentBlocksImmediateSend({
      requiresConfirmation: true,
      status: "pending",
    }),
    true
  );
  assert.equal(
    pendingIntentBlocksImmediateSend({
      requiresConfirmation: true,
      status: "confirmed",
    }),
    false
  );
  assert.equal(
    pendingIntentBlocksImmediateSend({
      requiresConfirmation: false,
      status: "pending",
    }),
    false
  );
});
