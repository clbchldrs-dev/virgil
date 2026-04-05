import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import {
  listSophonTasksForUser,
  upsertSophonDailyReviewForUser,
} from "@/lib/db/queries";
import { buildDailyCommandCenter } from "@/sophon/src/build-daily-command-center";
import type { SophonSource } from "@/sophon/src/types";

const postBodySchema = z.object({
  reviewDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  wins: z.array(z.string().min(1)).max(10),
  misses: z.array(z.string().min(1)).max(10),
  carryForward: z.array(z.string().min(1)).max(20),
  calibration: z.record(z.string(), z.unknown()).default({}),
});

function toSophonSource(source: string): SophonSource {
  if (
    source === "manual" ||
    source === "calendar" ||
    source === "existing-task" ||
    source === "memory" ||
    source === "habit"
  ) {
    return source;
  }
  return "manual";
}

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const tasks = await listSophonTasksForUser({ userId: session.user.id });
  const candidates = tasks.map((task) => ({
    id: task.id,
    title: task.title,
    source: toSophonSource(task.source),
    impact: 0.7,
    urgency: task.dueAt ? 0.8 : 0.4,
    commitmentRisk: 0.5,
    effortFit: Math.min(Math.max(task.effortFit / 100, 0), 1),
    decayRisk: 0.5,
    dueAt: task.dueAt,
  }));

  const brief = buildDailyCommandCenter({
    calendarLoad: 0.5,
    carryoverLoad: 0.4,
    stalenessPressure: 0.4,
    candidates,
  });

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
