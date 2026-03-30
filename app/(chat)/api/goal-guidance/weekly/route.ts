import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import {
  listRecentGoalWeeklySnapshots,
  upsertGoalWeeklySnapshot,
} from "@/lib/db/queries";

const postBodySchema = z.object({
  weekEnding: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u),
  metrics: z.record(z.string(), z.unknown()),
});

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const rawLimit = Number.parseInt(searchParams.get("limit") ?? "4", 10);
  const limit = Math.min(Number.isFinite(rawLimit) ? rawLimit : 4, 52);

  const snapshots = await listRecentGoalWeeklySnapshots({
    userId: session.user.id,
    limit,
  });

  return Response.json({ snapshots });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }

  const parsed = postBodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "invalid body" }, { status: 400 });
  }

  const snapshot = await upsertGoalWeeklySnapshot({
    userId: session.user.id,
    weekEnding: parsed.data.weekEnding,
    metrics: parsed.data.metrics,
  });

  return Response.json({ snapshot });
}
