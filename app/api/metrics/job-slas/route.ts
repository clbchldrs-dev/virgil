import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth } from "@/app/(auth)/auth";
import {
  getJobMetrics,
  listDistinctJobKinds,
} from "@/lib/db/query-modules/background-jobs";

/** PROMPT 3 / PROMPT 8: GET /api/metrics/job-slas */

const DEVICE_PROFILE = process.env.DEVICE_PROFILE ?? "Local";

const DEFAULT_JOB_KINDS = [
  "goal_synthesis",
  "fitness_analysis",
  "spending_review",
  "nightly_review",
  "deep_analysis",
] as const;

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const kind = request.nextUrl.searchParams.get("kind");
    const fromDb = await listDistinctJobKinds();
    const kinds = kind
      ? [kind]
      : [...new Set([...DEFAULT_JOB_KINDS, ...fromDb])];

    const results: Record<
      string,
      {
        p50Ms: number;
        p95Ms: number;
        p99Ms: number;
        meanMs: number;
        sampleCount: number;
        successRate: number;
        deviceProfile: string;
        lastUpdated: string;
        note?: string;
      }
    > = {};

    for (const jobKind of kinds) {
      try {
        const metrics = await getJobMetrics(jobKind);
        results[jobKind] = {
          p50Ms: metrics.p50Ms,
          p95Ms: metrics.p95Ms,
          p99Ms: metrics.p99Ms,
          meanMs: metrics.meanMs,
          sampleCount: metrics.sampleCount,
          successRate: metrics.successRate,
          deviceProfile: DEVICE_PROFILE,
          lastUpdated: new Date().toISOString(),
        };
      } catch {
        results[jobKind] = {
          p50Ms: 0,
          p95Ms: 0,
          p99Ms: 0,
          meanMs: 0,
          sampleCount: 0,
          successRate: 1,
          deviceProfile: DEVICE_PROFILE,
          lastUpdated: new Date().toISOString(),
          note: "Insufficient data",
        };
      }
    }

    return NextResponse.json(results, { status: 200 });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch SLA metrics" },
      { status: 500 }
    );
  }
}
