type AlexaResponseOptions = {
  speech: string;
  shouldEndSession?: boolean;
  reprompt?: string;
};

function sanitizeSpeechText(input: string): string {
  return input
    .replaceAll(/[*_`#]/g, "")
    .replaceAll(/\s+/g, " ")
    .trim();
}

export function buildAlexaSpeechResponse({
  speech,
  shouldEndSession = false,
  reprompt,
}: AlexaResponseOptions) {
  const safeSpeech = sanitizeSpeechText(speech) || "I did not catch that.";
  const safeReprompt = reprompt ? sanitizeSpeechText(reprompt) : undefined;

  return {
    version: "1.0",
    response: {
      outputSpeech: {
        type: "PlainText",
        text: safeSpeech,
      },
      ...(safeReprompt
        ? {
            reprompt: {
              outputSpeech: {
                type: "PlainText",
                text: safeReprompt,
              },
            },
          }
        : {}),
      shouldEndSession,
    },
  };
}
