import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import { approveMemoriesForUser } from "@/lib/db/queries";
import {
  getJob,
  updateJobStatus,
} from "@/lib/db/query-modules/background-jobs";

/** PROMPT 3: POST /api/jobs/[jobId]/approve */
const bodySchema = z.object({
  memoryIds: z.array(z.string().uuid()),
});

type RouteContext = { params: Promise<{ jobId: string }> };

export async function POST(request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { jobId } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  try {
    const job = await getJob(jobId);
    if (!job || job.userId !== session.user.id) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }

    if (job.status !== "completed") {
      return NextResponse.json(
        { error: "job must be completed before approval" },
        { status: 409 }
      );
    }

    const approvedCount = await approveMemoriesForUser({
      memoryIds: parsed.data.memoryIds,
      userId: session.user.id,
    });

    await updateJobStatus(
      jobId,
      "approving",
      "User approved proposal memories"
    );

    return NextResponse.json({
      jobId,
      approvedCount,
      appliedCount: 0,
    });
  } catch {
    return NextResponse.json({ error: "server error" }, { status: 500 });
  }
}
