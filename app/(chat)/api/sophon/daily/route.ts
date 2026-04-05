import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import {
  listSophonTasksForUser,
  upsertSophonDailyReviewForUser,
} from "@/lib/db/queries";
import { VirgilError } from "@/lib/errors";
import { buildDailyCommandCenter } from "@/lib/sophon/build-daily-command-center";
import type { SophonSource } from "@/lib/sophon/types";

const postBodySchema = z.object({
  reviewDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  wins: z.array(z.string().min(1)).max(10),
  misses: z.array(z.string().min(1)).max(10),
  carryForward: z.array(z.string().min(1)).max(20),
  calibration: z.record(z.string(), z.unknown()).default({}),
});

const SOPHON_SOURCES = new Set<string>([
  "manual",
  "calendar",
  "existing-task",
  "memory",
  "habit",
]);

function toSophonSource(raw: string): SophonSource {
  if (SOPHON_SOURCES.has(raw)) {
    return raw as SophonSource;
  }
  return "manual";
}

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  if (session.user.type === "guest") {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }
  try {
    const tasks = await listSophonTasksForUser({ userId: session.user.id });
    const candidates = tasks.map((t) => ({
      id: t.id,
      title: t.title,
      source: toSophonSource(t.source),
      impact: 0.7,
      urgency: t.dueAt ? 0.8 : 0.4,
      commitmentRisk: 0.5,
      effortFit: Math.min(Math.max(t.effortFit / 100, 0), 1),
      decayRisk: 0.5,
      dueAt: t.dueAt ?? null,
    }));
    const brief = await buildDailyCommandCenter({
      calendarLoad: 0.5,
      carryoverLoad: 0.4,
      stalenessPressure: 0.4,
      candidates,
    });
    return Response.json({ brief });
  } catch (error) {
    if (error instanceof VirgilError) {
      return error.toResponse();
    }
    return Response.json({ error: "server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  if (session.user.type === "guest") {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid body" }, { status: 400 });
  }
  const parsed = postBodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "invalid body" }, { status: 400 });
  }
  try {
    const row = await upsertSophonDailyReviewForUser({
      userId: session.user.id,
      ...parsed.data,
    });
    return Response.json({ review: row });
  } catch (error) {
    if (error instanceof VirgilError) {
      return error.toResponse();
    }
    return Response.json({ error: "server error" }, { status: 500 });
  }
}
