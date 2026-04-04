import { NextResponse } from "next/server";
import { auth } from "@/app/(auth)/auth";
import {
  cancelJob,
  getJob,
  getJobAuditTrail,
  getMemoriesBySourceJobId,
} from "@/lib/db/queries";

type RouteContext = { params: Promise<{ jobId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { jobId } = await context.params;

  try {
    const job = await getJob(jobId);
    if (!job || job.userId !== session.user.id) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }

    const auditTrail = await getJobAuditTrail(jobId);
    const proposals = await getMemoriesBySourceJobId({
      userId: session.user.id,
      jobId,
    });

    return NextResponse.json({ job, auditTrail, proposals });
  } catch {
    return NextResponse.json({ error: "server error" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { jobId } = await context.params;

  try {
    const job = await getJob(jobId);
    if (!job || job.userId !== session.user.id) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }

    if (job.status !== "pending") {
      return NextResponse.json(
        { error: "job cannot be cancelled in this state" },
        { status: 409 }
      );
    }

    await cancelJob(jobId);

    return NextResponse.json({ jobId, status: "cancelled" });
  } catch {
    return NextResponse.json({ error: "server error" }, { status: 500 });
  }
}
