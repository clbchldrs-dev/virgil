import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import { scheduleBackgroundJobProcessing } from "@/lib/background-jobs/schedule-job";
import {
  createJob,
  listUserJobs,
} from "@/lib/db/query-modules/background-jobs";

/** PROMPT 3: POST/GET /api/jobs — body userId (if present) must match session. */
const postBodySchema = z.object({
  kind: z.string().min(1).max(64),
  input: z.record(z.string(), z.unknown()).default({}),
  userId: z.string().uuid().optional(),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const parsed = postBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  if (
    parsed.data.userId !== undefined &&
    parsed.data.userId !== session.user.id
  ) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    const job = await createJob(
      session.user.id,
      parsed.data.kind,
      parsed.data.input
    );
    scheduleBackgroundJobProcessing(job.id);

    return NextResponse.json({
      jobId: job.id,
      status: "pending",
      createdAt: job.createdAt,
      estimatedWaitMs: 0,
    });
  } catch {
    return NextResponse.json({ error: "server error" }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const rawStatus = searchParams.get("status");
  const status = rawStatus && rawStatus.length > 0 ? rawStatus : undefined;
  const queryUserId = searchParams.get("userId");
  if (queryUserId !== null && queryUserId !== session.user.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    const jobs = await listUserJobs(session.user.id, status);

    return NextResponse.json({
      jobs: jobs.map((j) => ({
        jobId: j.id,
        kind: j.kind,
        status: j.status,
        createdAt: j.createdAt,
        wallTimeMs: j.wallTimeMs,
        proposalCount: j.proposalCount,
      })),
    });
  } catch {
    return NextResponse.json({ error: "server error" }, { status: 500 });
  }
}
