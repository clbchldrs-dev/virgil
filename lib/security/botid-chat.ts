import { isProductionEnvironment } from "@/lib/constants";

/** Result shape from `botid/server` `checkBotId()` (both union variants). */
export type BotIdVerification = {
  bypassed: boolean;
  isBot: boolean;
  isHuman: boolean;
  isVerifiedBot: boolean;
};

/**
 * Chat should not be driven by unverified bots. Verified bots (e.g. monitors) are allowed.
 * Dev / bypassed checks always pass this gate.
 */
export function isUnverifiedBotChatClient(
  bot: BotIdVerification | null
): boolean {
  if (!bot || bot.bypassed) {
    return false;
  }
  return bot.isBot && !bot.isVerifiedBot;
}

/**
 * @param enforce — from `BOTID_ENFORCE=1` / `true`: return 403 for unverified bots.
 * Otherwise in production log once per suspicious request (no user message body).
 */
export function handleBotIdForChatPost(options: {
  bot: BotIdVerification | null;
  enforce: boolean;
}): "allow" | "block" {
  const { bot, enforce } = options;
  if (!isUnverifiedBotChatClient(bot)) {
    return "allow";
  }
  if (enforce) {
    return "block";
  }
  if (isProductionEnvironment) {
    console.warn("[botid] unverified bot classified on POST /api/chat", {
      isHuman: bot?.isHuman,
      isVerifiedBot: bot?.isVerifiedBot,
    });
  }
  return "allow";
}

export function isBotIdEnforceEnabled(): boolean {
  const v = process.env.BOTID_ENFORCE?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}
