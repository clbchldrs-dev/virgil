import { persistGeneralIngest } from "@/lib/ingest/general-ingest";
import {
  handleIngestPost,
  type IngestRouteDeps,
} from "@/lib/ingest/ingest-route-handler";
import { isVirgilIngestEnabled } from "@/lib/virgil/integrations";

const defaultIngestRouteDeps: IngestRouteDeps = {
  isEnabled: isVirgilIngestEnabled,
  getSecret: () => process.env.VIRGIL_INGEST_SECRET?.trim(),
  getUserId: () => process.env.VIRGIL_INGEST_USER_ID?.trim(),
  persist: persistGeneralIngest,
};

/**
 * General context ingress (shortcuts, scripts, PWA share target server path uses session).
 * Auth: `Authorization: Bearer $VIRGIL_INGEST_SECRET`
 * Target user: `VIRGIL_INGEST_USER_ID` (single-owner).
 */
export function POST(request: Request) {
  return handleIngestPost(request, defaultIngestRouteDeps);
}
