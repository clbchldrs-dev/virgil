import { createHash, timingSafeEqual } from "node:crypto";

import { getDelegationWorkerSecret } from "@/lib/integrations/delegation-poll-config";

function sha256Hex(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

/** Constant-time equality on SHA-256 digests (mitigates timing probes on the bearer secret). */
function bearerMatchesExpected(
  expectedFullHeader: string,
  actual: string | null
): boolean {
  if (actual === null) {
    return false;
  }
  const a = sha256Hex(expectedFullHeader);
  const b = sha256Hex(actual);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Returns a JSON Response when the request is not an authorized delegation worker. */
export function unauthorizedUnlessDelegationWorker(
  request: Request
): Response | null {
  const secret = getDelegationWorkerSecret();
  if (!secret) {
    return Response.json(
      { error: "delegation_worker_not_configured" },
      { status: 503 }
    );
  }
  const auth = request.headers.get("authorization");
  const expected = `Bearer ${secret}`;
  if (!bearerMatchesExpected(expected, auth)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  return null;
}
