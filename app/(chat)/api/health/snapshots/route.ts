import { auth } from "@/app/(auth)/auth";
import { listHealthSnapshotsForUser } from "@/lib/db/queries";

/** List ingested health batches for the signed-in user (same userId as ingest target in single-owner setups). */
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  if (session.user.type === "guest") {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const rawLimit = Number.parseInt(searchParams.get("limit") ?? "20", 10);
  const limit = Math.min(Number.isFinite(rawLimit) ? rawLimit : 20, 100);

  const snapshots = await listHealthSnapshotsForUser({
    userId: session.user.id,
    limit,
  });

  return Response.json({ snapshots });
}
