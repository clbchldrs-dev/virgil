import { auth } from "@/app/(auth)/auth";
import {
  getJobMetrics,
  listDistinctJobKinds,
} from "@/lib/db/query-modules/background-jobs";
import { handleJobSlasGet } from "@/lib/reliability/job-slas-handler";

/** PROMPT 3 / PROMPT 8: GET /api/metrics/job-slas */

const DEVICE_PROFILE = process.env.DEVICE_PROFILE ?? "Local";
export function GET(request: Request) {
  return handleJobSlasGet(request, {
    isAuthorized: async () => Boolean((await auth())?.user),
    listDistinctKinds: listDistinctJobKinds,
    getMetrics: getJobMetrics,
    getDeviceProfile: () => DEVICE_PROFILE,
    nowIso: () => new Date().toISOString(),
  });
}
