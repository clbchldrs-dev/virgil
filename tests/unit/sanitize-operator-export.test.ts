import assert from "node:assert/strict";
import test from "node:test";

import { sanitizeOperatorExportDeep } from "@/lib/deployment/sanitize-operator-export";

test("sanitizes nested strings in unknown JSON", () => {
  const out = sanitizeOperatorExportDeep({
    a: { b: "Bearer longtokenvaluehere" },
    c: ["postgres://u:p@h:5432/db"],
  });
  assert.deepEqual(out, {
    a: { b: "Bearer [redacted]" },
    c: ["postgres://[redacted]@h:5432/db"],
  });
});
