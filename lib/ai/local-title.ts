const MAX_LOCAL_TITLE_CHARS = 50;

export function buildLocalChatTitleFromUserMessage(text: string) {
  const cleaned = text
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[#*"\s]+/, "");

  if (!cleaned) {
    return "New Conversation";
  }

  if (cleaned.length <= MAX_LOCAL_TITLE_CHARS) {
    return cleaned;
  }

  const truncated = cleaned.slice(0, MAX_LOCAL_TITLE_CHARS).trimEnd();
  const lastSpace = truncated.lastIndexOf(" ");
  const safe =
    lastSpace > MAX_LOCAL_TITLE_CHARS * 0.6
      ? truncated.slice(0, lastSpace).trimEnd()
      : truncated;

  return `${safe}...`;
}
