export type BackgroundJobRunDeps = {
  hasSigningKeys: () => boolean;
  verifySignature: (input: {
    body: string;
    signature: string;
  }) => Promise<boolean>;
  processJobById: (jobId: string) => Promise<void>;
};

export async function handleBackgroundJobsRunPost(
  request: Request,
  deps: BackgroundJobRunDeps
): Promise<Response> {
  if (!deps.hasSigningKeys()) {
    return Response.json(
      { ok: false, error: "qstash_signing_keys_missing" },
      { status: 500 }
    );
  }

  const body = await request.text();
  const signature = request.headers.get("upstash-signature");
  if (!signature) {
    return Response.json(
      { ok: false, error: "missing_signature" },
      { status: 401 }
    );
  }

  const isValid = await deps
    .verifySignature({ body, signature })
    .catch(() => false);
  if (!isValid) {
    return Response.json(
      { ok: false, error: "invalid_signature" },
      { status: 401 }
    );
  }

  let payload: { jobId?: string };
  try {
    payload = JSON.parse(body) as { jobId?: string };
  } catch {
    return Response.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  if (!payload.jobId || typeof payload.jobId !== "string") {
    return Response.json(
      { ok: false, error: "missing_job_id" },
      { status: 400 }
    );
  }

  try {
    await deps.processJobById(payload.jobId);
    return Response.json({ ok: true, jobId: payload.jobId }, { status: 200 });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: "job_processing_failed",
        jobId: payload.jobId,
        message: error instanceof Error ? error.message : "unknown_error",
      },
      { status: 500 }
    );
  }
}
