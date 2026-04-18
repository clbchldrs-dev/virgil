const DEFAULT_JOB_KINDS = [
  "goal_synthesis",
  "fitness_analysis",
  "spending_review",
  "nightly_review",
  "deep_analysis",
] as const;

type JobMetrics = {
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  meanMs: number;
  sampleCount: number;
  successRate: number;
};

type JobSlaResult = JobMetrics & {
  deviceProfile: string;
  lastUpdated: string;
  note?: string;
};

export type JobSlasDeps = {
  isAuthorized: () => Promise<boolean>;
  listDistinctKinds: () => Promise<string[]>;
  getMetrics: (kind: string) => Promise<JobMetrics>;
  getDeviceProfile: () => string;
  nowIso: () => string;
};

export async function handleJobSlasGet(
  request: Request,
  deps: JobSlasDeps
): Promise<Response> {
  if (!(await deps.isAuthorized())) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const kind = url.searchParams.get("kind");
    const fromDb = await deps.listDistinctKinds();
    const kinds = kind
      ? [kind]
      : [...new Set([...DEFAULT_JOB_KINDS, ...fromDb])];

    const results: Record<string, JobSlaResult> = {};
    const failures: Array<{ kind: string; message: string }> = [];
    let successfulKinds = 0;
    let fallbackKinds = 0;

    for (const jobKind of kinds) {
      try {
        const metrics = await deps.getMetrics(jobKind);
        results[jobKind] = {
          ...metrics,
          deviceProfile: deps.getDeviceProfile(),
          lastUpdated: deps.nowIso(),
        };
        successfulKinds += 1;
      } catch (error) {
        results[jobKind] = {
          p50Ms: 0,
          p95Ms: 0,
          p99Ms: 0,
          meanMs: 0,
          sampleCount: 0,
          successRate: 1,
          deviceProfile: deps.getDeviceProfile(),
          lastUpdated: deps.nowIso(),
          note: "Insufficient data",
        };
        fallbackKinds += 1;
        failures.push({
          kind: jobKind,
          message: error instanceof Error ? error.message : "unknown_error",
        });
      }
    }

    return Response.json(
      {
        ok: true,
        summary: {
          totalKinds: kinds.length,
          successfulKinds,
          fallbackKinds,
        },
        failures,
        results,
      },
      { status: 200 }
    );
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: "job_slas_fetch_failed",
        message: error instanceof Error ? error.message : "unknown_error",
      },
      { status: 500 }
    );
  }
}
