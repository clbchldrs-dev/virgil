"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useEffect, useLayoutEffect, useState } from "react";
import { guestRegex } from "@/lib/constants";
import { getUserDisplayFirstName } from "@/lib/user-display";
import { cn } from "@/lib/utils";

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

function flavorForChatId(id: string): string {
  if (id.length === 0) {
    return FLAVOR_LINES[0];
  }
  const h = hashChatId(id);
  return FLAVOR_LINES[(h >> 5) % FLAVOR_LINES.length];
}

export function Greeting({ chatId }: GreetingProps) {
  const { data: session, status } = useSession();
  /** Session-dependent chrome is deferred until mount so next-auth state matches the browser. */
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  /**
   * SSR and the first client render must match. For `/` new chats, `chatId` comes from
   * `useRef(generateUUID())` which differs between server and client, so hashing would
   * diverge. Start at FLAVOR_LINES[0] everywhere, then sync from the real chatId before
   * paint (useLayoutEffect).
   */
  const [flavor, setFlavor] = useState<string>(FLAVOR_LINES[0]);
  useLayoutEffect(() => {
    setFlavor(flavorForChatId(chatId));
  }, [chatId]);

  const email = session?.user?.email ?? "";
  const isGuest = guestRegex.test(email);
  const displayFirst = session?.user
    ? getUserDisplayFirstName(session.user)
    : null;

  return (
    <div
      className="empty-chat-greeting flex max-w-sm flex-col items-center px-3"
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
        <div className="relative z-[1] flex flex-col items-center gap-2 text-center">
          <h2 className="sr-only">Empty chat</h2>
          {mounted && status === "authenticated" && session?.user && (
            <p
              className={cn(
                "pointer-events-auto max-w-[280px] text-[13px] leading-snug",
                isGuest
                  ? "text-muted-foreground/60"
                  : "font-medium text-foreground"
              )}
              data-testid="empty-chat-session-label"
            >
              {isGuest ? (
                <>
                  Temporary session —{" "}
                  <Link
                    className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                    href="/login"
                  >
                    Sign in
                  </Link>{" "}
                  for your account.
                </>
              ) : (
                <>Signed in as {displayFirst}</>
              )}
            </p>
          )}
          <div
            aria-hidden="true"
            className="empty-chat-greeting__soul text-primary"
          >
            <svg
              aria-hidden="true"
              className="mx-auto block"
              fill="currentColor"
              height="28"
              viewBox="0 0 24 24"
              width="28"
            >
              <path d="M12 3l9 8v10H3V11l9-8zm0 2.2L5 11.5V19h14v-7.5L12 5.2z" />
              <circle cx="12" cy="16.5" r="2.5" />
            </svg>
          </div>
          <p className="empty-chat-greeting__flavor text-muted-foreground/85">
            {flavor}
          </p>
        </div>
      </div>
    </div>
  );
}
