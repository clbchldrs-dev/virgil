"use client";

import type { UseChatHelpers } from "@ai-sdk/react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useCalaveraStreamState } from "@/hooks/use-calavera-stream-state";
import type { ChatMessage } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  CALAVERA_JAW_SPLIT_Y,
  CALAVERA_SKULL_GRIN_ROW,
  CALAVERA_SKULL_PIXELS,
} from "./calavera-skull-data";

type CalaveraAvatarProps = {
  messages: ChatMessage[];
  status: UseChatHelpers<ChatMessage>["status"];
};

export function CalaveraAvatar({ messages, status }: CalaveraAvatarProps) {
  const { jawWordCount, showThoughtBubble, isAssistantStreaming } =
    useCalaveraStreamState(messages, status);

  const [jawT, setJawT] = useState(0);
  const prevCountRef = useRef(0);
  const prevMessageIdRef = useRef<string | undefined>(undefined);

  const lastId = messages.at(-1)?.id;
  useLayoutEffect(() => {
    if (lastId !== prevMessageIdRef.current) {
      prevMessageIdRef.current = lastId;
      prevCountRef.current = 0;
      setJawT(0);
    }
  }, [lastId]);

  useLayoutEffect(() => {
    if (jawWordCount > prevCountRef.current) {
      setJawT(1);
      prevCountRef.current = jawWordCount;
    }
  }, [jawWordCount]);

  useEffect(() => {
    if (jawT <= 0.02) {
      if (jawT !== 0) {
        setJawT(0);
      }
      return;
    }
    const id = requestAnimationFrame(() => {
      setJawT((t) => t * 0.84);
    });
    return () => cancelAnimationFrame(id);
  }, [jawT]);

  const jawTranslate = jawT * 0.55;

  const upperPixels = CALAVERA_SKULL_PIXELS.filter(
    ([, y]) => y < CALAVERA_JAW_SPLIT_Y
  );
  const lowerPixels = CALAVERA_SKULL_PIXELS.filter(
    ([, y]) => y >= CALAVERA_JAW_SPLIT_Y
  );

  return (
    <div
      aria-hidden
      className={cn(
        "calavera-avatar pointer-events-none select-none",
        isAssistantStreaming && "calavera-avatar--active"
      )}
    >
      {showThoughtBubble && (
        <div className="calavera-avatar__thought">
          <span className="calavera-avatar__thought-dots">...</span>
        </div>
      )}
      <div className="calavera-avatar__skull-wrap">
        <svg
          className="calavera-avatar__svg"
          height="15"
          preserveAspectRatio="xMidYMid meet"
          shapeRendering="crispEdges"
          viewBox="0 0 20 15"
          width="20"
        >
          <g>
            {upperPixels.map(([x, y]) => (
              <rect
                className="calavera-avatar__pixel"
                height="1"
                key={`u-${x}-${y}`}
                width="1"
                x={x}
                y={y}
              />
            ))}
          </g>
          <g transform={`translate(0 ${jawTranslate})`}>
            {lowerPixels.map(([x, y]) => (
              <rect
                className={cn(
                  "calavera-avatar__pixel",
                  y === CALAVERA_SKULL_GRIN_ROW &&
                    "calavera-avatar__pixel--tooth"
                )}
                height="1"
                key={`l-${x}-${y}`}
                width="1"
                x={x}
                y={y}
              />
            ))}
          </g>
        </svg>
        <div className="calavera-avatar__eyes">
          <span className="calavera-avatar__eye-anchor">
            <span className="calavera-avatar__eye" />
          </span>
          <span className="calavera-avatar__eye-anchor">
            <span className="calavera-avatar__eye" />
          </span>
        </div>
      </div>
    </div>
  );
}
