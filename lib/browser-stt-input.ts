/**
 * Browser Web Speech API — speech-to-text for the composer.
 * @see https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition
 */

/** Returns the SpeechRecognition constructor, or null (SSR / unsupported browser). */
export function getSpeechRecognitionConstructor():
  | (new () => SpeechRecognition)
  | null {
  if (typeof window === "undefined") {
    return null;
  }
  const w = window as Window & {
    SpeechRecognition?: new () => SpeechRecognition;
    webkitSpeechRecognition?: new () => SpeechRecognition;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}
