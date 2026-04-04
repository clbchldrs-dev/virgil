import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth } from "@/app/(auth)/auth";
import { getJobMetrics, listDistinctJobKinds } from "@/lib/db/queries";

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
        wallTimeMs: {
          p50: number;
          p95: number;
          p99: number;
          mean: number;
        };
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
          wallTimeMs: {
            p50: metrics.p50Ms,
            p95: metrics.p95Ms,
            p99: metrics.p99Ms,
            mean: metrics.meanMs,
          },
          sampleCount: metrics.sampleCount,
          successRate: metrics.successRate,
          deviceProfile: DEVICE_PROFILE,
          lastUpdated: new Date().toISOString(),
        };
      } catch {
        results[jobKind] = {
          wallTimeMs: { p50: 0, p95: 0, p99: 0, mean: 0 },
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
