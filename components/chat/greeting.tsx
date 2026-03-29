import { useMemo } from "react";

const HEADLINES = [
  "The void listens. Politely.",
  "No messages. Only anticipation.",
  "You found the quiet place.",
  "The cursor blinks. So do the walls.",
  "Nothing here yet—except possibility.",
  "Silence, but make it cozy.",
  "A blank slate. Possibly haunted.",
  "Whispers pending. Type to begin.",
] as const;

const FLAVOR_LINES = [
  "*You feel watched by absolutely nothing in particular.*",
  "*The hum of an empty channel is almost friendly.*",
  "*Somewhere, a pixel sighs.*",
  "*It is very still. Good.*",
  "*No backlog. No dread. Yet.*",
  "*The room saves your place.*",
  "*Patience is a virtue. So is caffeine.*",
  "*Ready when you are.*",
] as const;

function hashChatId(id: string): number {
  let h = 2_166_136_261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16_777_619);
  }
  return h >>> 0;
}

type GreetingProps = {
  chatId: string;
};

export function Greeting({ chatId }: GreetingProps) {
  const { headline, flavor } = useMemo(() => {
    const h = hashChatId(chatId);
    return {
      headline: HEADLINES[h % HEADLINES.length],
      flavor: FLAVOR_LINES[(h >> 5) % FLAVOR_LINES.length],
    };
  }, [chatId]);

  return (
    <div
      className="empty-chat-greeting flex max-w-md flex-col items-center px-4"
      data-testid="empty-chat-greeting"
    >
      <div
        aria-hidden="true"
        className="empty-chat-greeting__vignette pointer-events-none"
      />
      <div className="empty-chat-greeting__dialogue relative w-full">
        <div
          aria-hidden="true"
          className="empty-chat-greeting__scanlines pointer-events-none rounded-[inherit]"
        />
        <div className="relative z-[1] flex flex-col items-center gap-3 text-center">
          <div
            aria-hidden="true"
            className="empty-chat-greeting__soul text-primary"
          >
            <svg
              aria-hidden="true"
              className="mx-auto block"
              fill="currentColor"
              height="32"
              viewBox="0 0 24 24"
              width="32"
            >
              <path d="M12 3l9 8v10H3V11l9-8zm0 2.2L5 11.5V19h14v-7.5L12 5.2z" />
              <circle cx="12" cy="16.5" r="2.5" />
            </svg>
          </div>
          <h2 className="empty-chat-greeting__headline text-xl md:text-2xl">
            {headline}
          </h2>
          <p className="text-center text-muted-foreground text-sm leading-snug">
            <span aria-hidden="true" className="mr-1.5 text-primary/90">
              ▶
            </span>
            Ask a question, write code, or explore ideas.
          </p>
          <p className="empty-chat-greeting__flavor text-muted-foreground/85">
            {flavor}
          </p>
        </div>
      </div>
    </div>
  );
}
