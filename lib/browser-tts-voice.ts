/**
 * Browser SpeechSynthesis has no gender metadata; we match known male voice name
 * patterns across platforms (macOS Alex/Daniel, Windows Microsoft David, Chrome
 * "Google US English Male", etc.).
 */

/** Substrings in `name` / `voiceURI` that usually indicate a male voice. */
const MALE_NAME_HINTS: readonly string[] = [
  " male",
  "(male)",
  "male)",
  "google us english male",
  "microsoft david",
  "microsoft mark",
  "microsoft guy",
  "microsoft george",
  "microsoft christopher",
  "microsoft andrew",
  "microsoft richard",
  "microsoft brian",
  "microsoft thomas",
  "microsoft benjamin",
  "daniel",
  "fred",
  "bruce",
  "aaron",
  " arthur",
  "arthur ",
  "albert",
  "oliver",
  "nathan",
  "james",
  "tom ",
  " tom",
];

function isMacAlexMaleVoice(v: SpeechSynthesisVoice): boolean {
  const uri = v.voiceURI.toLowerCase();
  if (uri.includes("voice.alex") && !uri.includes("alexandra")) {
    return true;
  }
  const name = v.name.trim().toLowerCase();
  return name === "alex";
}

/** Strong female markers — used only to avoid picking when no male hint matches. */
const FEMALE_NAME_HINTS: readonly string[] = [
  "female",
  "google us english female",
  "microsoft zira",
  "microsoft aria",
  "microsoft jenny",
  "microsoft michelle",
  "samantha",
  "karen",
  "victoria",
  "moira",
  "fiona",
  "veena",
  "susan",
  "zoe",
  "hazel",
  "martha",
  "sarah",
  "tessa",
  "shelley",
  "catherine",
  "melina",
];

function voiceLabel(v: SpeechSynthesisVoice): string {
  return `${v.name} ${v.voiceURI}`.toLowerCase();
}

function looksMale(v: SpeechSynthesisVoice): boolean {
  if (isMacAlexMaleVoice(v)) {
    return true;
  }
  const label = voiceLabel(v);
  return MALE_NAME_HINTS.some((hint) => label.includes(hint));
}

function looksFemale(v: SpeechSynthesisVoice): boolean {
  const label = voiceLabel(v);
  return FEMALE_NAME_HINTS.some((hint) => label.includes(hint));
}

function langPreferenceScore(lang: string): number {
  if (lang === "en-US" || lang.startsWith("en-US")) {
    return 2;
  }
  if (lang.startsWith("en")) {
    return 1;
  }
  return 0;
}

function compareVoices(
  a: SpeechSynthesisVoice,
  b: SpeechSynthesisVoice
): number {
  return langPreferenceScore(b.lang) - langPreferenceScore(a.lang);
}

/** Picks a US/English male-sounding voice when available; otherwise best-effort English. */
export function pickPreferredVoice(
  voices: SpeechSynthesisVoice[]
): SpeechSynthesisVoice | null {
  if (voices.length === 0) {
    return null;
  }

  const english = voices.filter(
    (v) =>
      v.lang === "en-US" ||
      v.lang.startsWith("en-US") ||
      v.lang.startsWith("en")
  );
  const pool = english.length > 0 ? english : voices;

  const male = pool.filter(looksMale).sort(compareVoices);
  if (male.length > 0) {
    return male[0] ?? null;
  }

  const notFemale = pool.filter((v) => !looksFemale(v)).sort(compareVoices);
  if (notFemale.length > 0) {
    return notFemale[0] ?? null;
  }

  return pool.sort(compareVoices)[0] ?? voices[0] ?? null;
}
