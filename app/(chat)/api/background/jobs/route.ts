import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import { scheduleBackgroundJobProcessing } from "@/lib/background-jobs/schedule-job";
import {
  insertBackgroundJob,
  listBackgroundJobsForUser,
} from "@/lib/db/queries";

const createBodySchema = z.object({
  kind: z.literal("deep_analysis"),
  input: z.object({
    query: z.string().min(1).max(8000),
  }),
});

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const rawLimit = Number.parseInt(searchParams.get("limit") ?? "30", 10);
  const limit = Math.min(Number.isFinite(rawLimit) ? rawLimit : 30, 100);

  const jobs = await listBackgroundJobsForUser({
    userId: session.user.id,
    limit,
  });

  return Response.json({ jobs });
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

  const parsed = createBodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "invalid body" }, { status: 400 });
  }

  const job = await insertBackgroundJob({
    userId: session.user.id,
    kind: parsed.data.kind,
    input: parsed.data.input,
  });

  scheduleBackgroundJobProcessing(job.id);

  return Response.json({ job }, { status: 201 });
}
