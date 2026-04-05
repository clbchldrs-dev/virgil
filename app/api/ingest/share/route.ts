import { NextResponse } from "next/server";
import { auth } from "@/app/(auth)/auth";
import { saveMemoryRecord } from "@/lib/db/queries";

/**
 * PWA Web Share Target: browser POSTs multipart form fields from the share sheet.
 * Session auth only (installed app uses the signed-in user).
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (session.user.type === "guest") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "invalid_form" }, { status: 400 });
  }

  const title = String(form.get("title") ?? "").trim();
  const text = String(form.get("text") ?? "").trim();
  const url = String(form.get("url") ?? "").trim();
  const content = [title, text, url].filter(Boolean).join("\n");
  if (!content) {
    return NextResponse.json({ error: "empty_share" }, { status: 400 });
  }

  await saveMemoryRecord({
    userId: session.user.id,
    kind: "note",
    content,
    metadata: { source: "share-target", title, url },
  });

  const redir = new URL("/", request.url);
  redir.searchParams.set("virgilToast", "share_saved");
  return NextResponse.redirect(redir);
}
