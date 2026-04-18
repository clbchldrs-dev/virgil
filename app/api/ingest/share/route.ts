import { auth } from "@/app/(auth)/auth";
import { saveMemoryRecord } from "@/lib/db/queries";
import {
  handleIngestSharePost,
  type IngestShareRouteDeps,
} from "@/lib/ingest/share-route-handler";

const defaultIngestShareRouteDeps: IngestShareRouteDeps = {
  auth,
  saveMemoryRecord,
};

/**
 * PWA Web Share Target: browser POSTs multipart form fields from the share sheet.
 * Session auth only (installed app uses the signed-in user).
 */
export function POST(request: Request) {
  return handleIngestSharePost(request, defaultIngestShareRouteDeps);
}
