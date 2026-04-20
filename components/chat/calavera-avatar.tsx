"use client";

import type { UseChatHelpers } from "@ai-sdk/react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useCalaveraStreamState } from "@/hooks/use-calavera-stream-state";
import { useCalaveraWormIdleReplay } from "@/hooks/use-calavera-worm-idle";
import { useIdleYawn } from "@/hooks/use-idle-yawn";
import type { ChatMessage } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  CALAVERA_BOWTIE_HEIGHT,
  CALAVERA_BOWTIE_PIXELS,
  CALAVERA_BOWTIE_WIDTH,
  CALAVERA_GRID_HEIGHT,
  CALAVERA_GRID_WIDTH,
  CALAVERA_JAW_SPLIT_Y,
  CALAVERA_SKULL_GRIN_ROW,
  CALAVERA_SKULL_PIXELS,
} from "./calavera-skull-data";
import { CalaveraWormCrawl } from "./calavera-worm-crawl";

type CalaveraAvatarProps = {
  messages: ChatMessage[];
  status: UseChatHelpers<ChatMessage>["status"];
};

export function CalaveraAvatar({ messages, status }: CalaveraAvatarProps) {
  const { jawWordCount, showThoughtBubble, isAssistantStreaming } =
    useCalaveraStreamState(messages, status);

  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mq.matches);
    const onChange = () => setPrefersReducedMotion(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const wormPlayId = useCalaveraWormIdleReplay(
    status === "ready",
    prefersReducedMotion
  );

  const yawnActive = status === "ready" && !prefersReducedMotion;
  const { jawDrop: idleJawDrop, eyeSquint } = useIdleYawn(yawnActive);

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

  const jawTranslate = jawT * 0.55 + idleJawDrop;

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
      <div className="calavera-avatar__mascot">
        <div className="calavera-avatar__skull-wrap">
          <svg
            className="calavera-avatar__svg"
            height={CALAVERA_GRID_HEIGHT}
            preserveAspectRatio="xMidYMid meet"
            shapeRendering="crispEdges"
            viewBox={`0 0 ${CALAVERA_GRID_WIDTH} ${CALAVERA_GRID_HEIGHT}`}
            width={CALAVERA_GRID_WIDTH}
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
                      "calavera-avatar__pixel--smile"
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
              <span
                className="calavera-avatar__eye-squint"
                style={{
                  transform: `scaleY(${1 - 0.48 * eyeSquint})`,
                }}
              >
                <span className="calavera-avatar__eye" />
              </span>
            </span>
            <span className="calavera-avatar__eye-anchor">
              <span
                className="calavera-avatar__eye-squint"
                style={{
                  transform: `scaleY(${1 - 0.48 * eyeSquint})`,
                }}
              >
                <span className="calavera-avatar__eye" />
              </span>
            </span>
          </div>
          {status === "ready" && !prefersReducedMotion && wormPlayId > 0 ? (
            <CalaveraWormCrawl key={wormPlayId} playId={wormPlayId} />
          ) : null}
        </div>
        <div className="calavera-avatar__bowtie">
          <svg
            aria-hidden
            className="calavera-avatar__bowtie__svg"
            height={CALAVERA_BOWTIE_HEIGHT}
            preserveAspectRatio="xMidYMid meet"
            shapeRendering="crispEdges"
            viewBox={`0 0 ${CALAVERA_BOWTIE_WIDTH} ${CALAVERA_BOWTIE_HEIGHT}`}
            width={CALAVERA_BOWTIE_WIDTH}
          >
            {CALAVERA_BOWTIE_PIXELS.map(([x, y]) => (
              <rect
                className="calavera-avatar__bowtie__pixel"
                height="1"
                key={`b-${x}-${y}`}
                width="1"
                x={x}
                y={y}
              />
            ))}
          </svg>
        </div>
      </div>
    </div>
  );
}
