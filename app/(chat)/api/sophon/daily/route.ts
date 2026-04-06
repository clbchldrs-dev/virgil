import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import { upsertSophonDailyReviewForUser } from "@/lib/db/queries";
import { getSophonDailyBriefForUser } from "@/lib/sophon/daily-brief";

const postBodySchema = z.object({
  reviewDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  wins: z.array(z.string().min(1)).max(10),
  misses: z.array(z.string().min(1)).max(10),
  carryForward: z.array(z.string().min(1)).max(20),
  calibration: z.record(z.string(), z.unknown()).default({}),
});

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const brief = await getSophonDailyBriefForUser(session.user.id);
  return Response.json({ brief });
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

  const review = await upsertSophonDailyReviewForUser({
    userId: session.user.id,
    ...parsed.data,
  });

  return Response.json({ review });
}
