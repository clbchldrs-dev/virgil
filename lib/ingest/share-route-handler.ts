type ShareSession = {
  user?: {
    id: string;
    type?: string;
  };
} | null;

export type IngestShareRouteDeps = {
  auth: () => Promise<ShareSession>;
  saveMemoryRecord: (input: {
    userId: string;
    kind: "note";
    content: string;
    metadata: Record<string, unknown>;
  }) => Promise<unknown>;
};

export async function handleIngestSharePost(
  request: Request,
  deps: IngestShareRouteDeps
) {
  const session = await deps.auth();
  if (!session?.user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  if (session.user.type === "guest") {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "invalid_form" }, { status: 400 });
  }

  const title = String(form.get("title") ?? "").trim();
  const text = String(form.get("text") ?? "").trim();
  const url = String(form.get("url") ?? "").trim();
  const content = [title, text, url].filter(Boolean).join("\n");
  if (!content) {
    return Response.json({ error: "empty_share" }, { status: 400 });
  }

  await deps.saveMemoryRecord({
    userId: session.user.id,
    kind: "note",
    content,
    metadata: { source: "share-target", title, url },
  });

  const redir = new URL("/", request.url);
  redir.searchParams.set("virgilToast", "share_saved");
  return Response.redirect(redir, 307);
}
