import { buildAlexaSpeechResponse } from "@/lib/channels/alexa/response";
import {
  alexaRequestEnvelopeSchema,
  extractCaptureText,
} from "@/lib/channels/alexa/schema";
import { getRecentMemories } from "@/lib/db/queries";
import { persistGeneralIngest } from "@/lib/ingest/general-ingest";
import { isVirgilAlexaEnabled } from "@/lib/virgil/integrations";

const RECENT_MEMORY_WINDOW_MS = 1000 * 60 * 60 * 24 * 7;

function hasValidBearerSecret(request: Request, secret: string): boolean {
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

function summarizeRecentMemoryContents(contents: string[]): string {
  if (contents.length === 0) {
    return "I do not have recent captures yet. Ask me to capture a note, and I will start building your loop.";
  }

  if (contents.length === 1) {
    return `Most recent capture: ${contents[0]}`;
  }

  const [first, second, third] = contents;
  const parts = [first, second];
  if (third) {
    parts.push(third);
  }

  return `Recent captures: ${parts.join(" ... ")}`;
}

export async function POST(request: Request) {
  if (!isVirgilAlexaEnabled()) {
    return Response.json({ error: "alexa_disabled" }, { status: 403 });
  }

  const secret = process.env.VIRGIL_ALEXA_SECRET?.trim();
  const userId = process.env.VIRGIL_ALEXA_USER_ID?.trim();

  if (!secret || !userId) {
    return Response.json({ error: "alexa_misconfigured" }, { status: 500 });
  }

  if (!hasValidBearerSecret(request, secret)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = alexaRequestEnvelopeSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      buildAlexaSpeechResponse({
        speech: "I could not read that request. Please try again.",
        shouldEndSession: true,
      }),
      { status: 400 }
    );
  }

  const envelope = parsed.data;

  if (envelope.request.type === "SessionEndedRequest") {
    return Response.json(
      buildAlexaSpeechResponse({
        speech: "Okay. Talk soon.",
        shouldEndSession: true,
      })
    );
  }

  if (envelope.request.type === "LaunchRequest") {
    return Response.json(
      buildAlexaSpeechResponse({
        speech:
          "Virgil is ready. You can say capture note, followed by your note, or ask for status.",
        reprompt: "Try saying, capture note, followed by your note.",
      })
    );
  }

  const intentName = envelope.request.intent?.name;

  if (intentName === "AMAZON.HelpIntent") {
    return Response.json(
      buildAlexaSpeechResponse({
        speech:
          "You can say capture note, then your note. You can also ask, what is my status.",
        reprompt: "Try saying, what is my status.",
      })
    );
  }

  if (intentName === "CaptureIntent") {
    const captureText = extractCaptureText(envelope);
    if (!captureText) {
      return Response.json(
        buildAlexaSpeechResponse({
          speech: "I did not hear a note to capture.",
          reprompt: "Say capture note, then the note you want me to save.",
        })
      );
    }

    await persistGeneralIngest({
      userId,
      body: {
        type: "note",
        content: captureText,
        source: "alexa",
        metadata: {
          channel: "alexa",
          sessionId: envelope.session?.sessionId ?? null,
          alexaUserId: envelope.session?.user?.userId ?? null,
        },
      },
    });

    return Response.json(
      buildAlexaSpeechResponse({
        speech: "Saved. I captured that note.",
      })
    );
  }

  if (intentName === "StatusIntent") {
    const since = new Date(Date.now() - RECENT_MEMORY_WINDOW_MS);
    const memories = await getRecentMemories({ userId, since, limit: 3 });
    const summary = summarizeRecentMemoryContents(
      memories.map((entry) => entry.content)
    );

    return Response.json(
      buildAlexaSpeechResponse({
        speech: summary,
      })
    );
  }

  return Response.json(
    buildAlexaSpeechResponse({
      speech:
        "I can capture a note or share your status. Try saying, capture note, followed by your note.",
      reprompt: "Try saying, what is my status.",
    })
  );
}
