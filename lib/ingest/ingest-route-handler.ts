import { virgilGeneralIngestBodySchema } from "@/lib/ingest/virgil-general-ingest-schema";

type IngestBody = {
  type: "note" | "link" | "quote" | "idea" | "mood" | "workout" | "location";
  content: string;
  source: string;
  metadata?: Record<string, unknown>;
};

export type IngestRouteDeps = {
  isEnabled: () => boolean;
  getSecret: () => string | undefined;
  getUserId: () => string | undefined;
  persist: (input: { userId: string; body: IngestBody }) => Promise<unknown>;
};

export async function handleIngestPost(
  request: Request,
  deps: IngestRouteDeps
) {
  if (!deps.isEnabled()) {
    return Response.json({ error: "ingest_disabled" }, { status: 403 });
  }

  const secret = deps.getSecret();
  const userId = deps.getUserId();
  if (!secret || !userId) {
    return Response.json({ error: "ingest_misconfigured" }, { status: 500 });
  }

  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = virgilGeneralIngestBodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }

  const row = await deps.persist({
    userId,
    body: parsed.data,
  });

  return Response.json({ memory: row });
}
