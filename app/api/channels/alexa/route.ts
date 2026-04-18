import {
  type AlexaRouteDeps,
  handleAlexaPost,
} from "@/lib/channels/alexa/route-handler";
import { getRecentMemories } from "@/lib/db/queries";
import { persistGeneralIngest } from "@/lib/ingest/general-ingest";
import { isVirgilAlexaEnabled } from "@/lib/virgil/integrations";

const defaultAlexaRouteDeps: AlexaRouteDeps = {
  isEnabled: isVirgilAlexaEnabled,
  getSecret: () => process.env.VIRGIL_ALEXA_SECRET?.trim(),
  getUserId: () => process.env.VIRGIL_ALEXA_USER_ID?.trim(),
  persist: persistGeneralIngest,
  getRecent: getRecentMemories,
  nowMs: () => Date.now(),
};

export function POST(request: Request) {
  return handleAlexaPost(request, defaultAlexaRouteDeps);
}
