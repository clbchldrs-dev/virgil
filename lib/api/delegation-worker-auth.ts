import { getDelegationWorkerSecret } from "@/lib/integrations/delegation-poll-config";

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
  if (auth !== `Bearer ${secret}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  return null;
}
