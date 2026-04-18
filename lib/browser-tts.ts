/**
 * Strips common Markdown so Web Speech reads naturally instead of punctuation noise.
 */
export function prepareTextForSpeech(raw: string): string {
  let s = raw.trim();
  if (s.length === 0) {
    return "";
  }

  // Fenced code blocks (must run before inline ` handling)
  s = s.replace(/```[\s\S]*?```/g, " ");

  // Inline code — keep inner text
  s = s.replace(/`([^`]+)`/g, "$1");

  // Markdown links: keep anchor text
  s = s.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1");

  // Images / bare URLs often noisy for TTS — drop angle-bracket URLs
  s = s.replace(/<https?:\/\/[^>]+>/g, " ");

  // ATX headings
  s = s.replace(/^#{1,6}\s+/gm, "");

  // Bold / italic (common forms)
  s = s.replace(/\*\*([^*]+)\*\*/g, "$1");
  s = s.replace(/\*([^*]+)\*/g, "$1");
  s = s.replace(/__([^_]+)__/g, "$1");
  s = s.replace(/_([^_]+)_/g, "$1");

  // List markers
  s = s.replace(/^\s*[-*+]\s+/gm, "");
  s = s.replace(/^\s*\d+\.\s+/gm, "");

  // Horizontal rules
  s = s.replace(/^-{3,}\s*$/gm, " ");

  s = s.replace(/\s+/g, " ").trim();
  return s;
}
