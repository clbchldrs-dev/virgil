"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  AMUSING_RANDOM_SUGGESTIONS,
  type ChatEmptySuggestion,
  DEFEAT_SCREEN_SUGGESTIONS,
  firstSuggestion,
  GENERIC_HELPFUL_MIDDLES,
  pickRandom,
} from "@/lib/empty-suggestion-pools";
import { SparklesIcon } from "./icons";

export function Preview() {
  const router = useRouter();
  const [chips, setChips] = useState<ChatEmptySuggestion[]>(() => [
    firstSuggestion(DEFEAT_SCREEN_SUGGESTIONS),
    firstSuggestion(GENERIC_HELPFUL_MIDDLES),
    firstSuggestion(AMUSING_RANDOM_SUGGESTIONS),
  ]);

  useEffect(() => {
    setChips([
      pickRandom(DEFEAT_SCREEN_SUGGESTIONS),
      pickRandom(GENERIC_HELPFUL_MIDDLES),
      pickRandom(AMUSING_RANDOM_SUGGESTIONS),
    ]);
  }, []);

  const handleAction = (query?: string) => {
    const url = query ? `/?query=${encodeURIComponent(query)}` : "/";
    router.push(url);
  };

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-tl-2xl bg-background">
      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-border/20 px-5">
        <div className="flex size-5 items-center justify-center rounded-sm bg-muted/60 ring-1 ring-border/50">
          <SparklesIcon size={10} />
        </div>
        <span className="text-[15px] text-muted-foreground">Virgil</span>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-8 px-8">
        <div className="text-center">
          <h2 className="text-[32px] leading-none tracking-[0.08em]">
            What should we figure out?
          </h2>
          <p className="mt-1.5 text-[18px] text-muted-foreground">
            Ask for help, work through a problem, or plan the next move.
          </p>
        </div>

        <div className="grid w-full max-w-4xl grid-cols-1 gap-3 md:grid-cols-3">
          {chips.map((item) => (
            <button
              className="rounded-sm border border-border/40 bg-card/40 px-3 py-3 text-center text-[15px] leading-tight text-muted-foreground transition-all duration-200 hover:-translate-y-0.5 hover:border-border/70 hover:bg-card/60 hover:text-foreground md:text-[16px]"
              key={item.prompt}
              onClick={() => handleAction(item.prompt)}
              type="button"
            >
              <span className="block text-balance">{item.lines[0]}</span>
              <span className="mt-0.5 block text-balance">{item.lines[1]}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="shrink-0 px-5 pb-5">
        <button
          className="flex w-full items-center rounded-sm border border-border/40 bg-card/40 px-4 py-3 text-left text-[18px] text-muted-foreground/55 transition-colors hover:border-border/60 hover:text-muted-foreground"
          onClick={() => handleAction()}
          type="button"
        >
          Ask anything...
        </button>
      </div>
    </div>
  );
}
