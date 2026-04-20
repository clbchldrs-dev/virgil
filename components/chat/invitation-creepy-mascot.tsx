"use client";

import { useEffect, useState } from "react";
import { useCalaveraWormIdleReplay } from "@/hooks/use-calavera-worm-idle";
import { useIdleYawn } from "@/hooks/use-idle-yawn";
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

/**
 * Invitation empty-state skull + eyes + bowtie, with idle yawn + worm crawl (same as session calavera).
 */
export function InvitationCreepyMascot() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mq.matches);
    const onChange = () => setPrefersReducedMotion(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const wormPlayId = useCalaveraWormIdleReplay(true, prefersReducedMotion);

  const { jawDrop, eyeSquint } = useIdleYawn(!prefersReducedMotion);

  const upperPixels = CALAVERA_SKULL_PIXELS.filter(
    ([, y]) => y < CALAVERA_JAW_SPLIT_Y
  );
  const lowerPixels = CALAVERA_SKULL_PIXELS.filter(
    ([, y]) => y >= CALAVERA_JAW_SPLIT_Y
  );

  return (
    <div aria-hidden="true" className="chat-creepy-face">
      <div className="chat-creepy-mascot">
        <div className="chat-creepy-skull-wrap">
          <svg
            aria-hidden="true"
            className="chat-creepy-skull__svg"
            height={CALAVERA_GRID_HEIGHT}
            preserveAspectRatio="xMidYMid meet"
            shapeRendering="crispEdges"
            viewBox={`0 0 ${CALAVERA_GRID_WIDTH} ${CALAVERA_GRID_HEIGHT}`}
            width={CALAVERA_GRID_WIDTH}
          >
            <g>
              {upperPixels.map(([x, y]) => (
                <rect
                  className="chat-creepy-skull__pixel"
                  height="1"
                  key={`u-${x}-${y}`}
                  width="1"
                  x={x}
                  y={y}
                />
              ))}
            </g>
            <g transform={`translate(0 ${jawDrop})`}>
              {lowerPixels.map(([x, y]) => (
                <rect
                  className={cn(
                    "chat-creepy-skull__pixel",
                    y === CALAVERA_SKULL_GRIN_ROW &&
                      "chat-creepy-skull__pixel--smile"
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
          <div className="chat-creepy-eyes">
            <span className="chat-creepy-eye-anchor">
              <span
                className="chat-creepy-eye-squint"
                style={{
                  transform: `scaleY(${1 - 0.48 * eyeSquint})`,
                }}
              >
                <span className="chat-creepy-eye" />
              </span>
            </span>
            <span className="chat-creepy-eye-anchor">
              <span
                className="chat-creepy-eye-squint"
                style={{
                  transform: `scaleY(${1 - 0.48 * eyeSquint})`,
                }}
              >
                <span className="chat-creepy-eye" />
              </span>
            </span>
          </div>
          {!prefersReducedMotion && wormPlayId > 0 ? (
            <CalaveraWormCrawl key={wormPlayId} playId={wormPlayId} />
          ) : null}
        </div>
        <div className="chat-creepy-bowtie">
          <svg
            aria-hidden="true"
            className="chat-creepy-bowtie__svg"
            height={CALAVERA_BOWTIE_HEIGHT}
            preserveAspectRatio="xMidYMid meet"
            shapeRendering="crispEdges"
            viewBox={`0 0 ${CALAVERA_BOWTIE_WIDTH} ${CALAVERA_BOWTIE_HEIGHT}`}
            width={CALAVERA_BOWTIE_WIDTH}
          >
            {CALAVERA_BOWTIE_PIXELS.map(([x, y]) => (
              <rect
                className="chat-creepy-bowtie__pixel"
                height="1"
                key={`${x}-${y}`}
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
