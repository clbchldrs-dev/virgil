"use client";

import { useLayoutEffect, useRef, useState } from "react";
import {
  CALAVERA_GRID_HEIGHT,
  CALAVERA_GRID_WIDTH,
} from "@/components/chat/calavera-skull-data";
import type { CalaveraWormRoute } from "@/components/chat/calavera-worm-paths";
import { WORM_ROUTES } from "@/components/chat/calavera-worm-paths";

const SEGMENT_COUNT = 7;
/** Spacing between segment centers along path (fraction of total length). */
const SPACING_FRAC = 0.042;
const DURATION_MS = 3400;
const EPS = 0.12;

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

type CalaveraWormCrawlProps = {
  /** Present so the parent can force remounts; each mount picks a new random route. */
  playId: number;
};

const SEG_KEYS = [
  "worm-h",
  "worm-1",
  "worm-2",
  "worm-3",
  "worm-4",
  "worm-5",
  "worm-t",
] as const;

/**
 * Snake / inchworm along a skull-space Bézier: each segment follows the path tangent;
 * positions sampled with getPointAtLength so motion matches the route across the face.
 */
export function CalaveraWormCrawl({ playId: _playId }: CalaveraWormCrawlProps) {
  const pathRef = useRef<SVGPathElement>(null);
  const segRefs = useRef<(SVGRectElement | null)[]>([]);

  const [route] = useState<CalaveraWormRoute>(
    () =>
      WORM_ROUTES[Math.floor(Math.random() * WORM_ROUTES.length)] ??
      WORM_ROUTES[0]
  );

  useLayoutEffect(() => {
    const path = pathRef.current;
    if (!path) {
      return;
    }

    const length = path.getTotalLength();
    if (length <= 0) {
      return;
    }

    const spacing = Math.min(
      length * SPACING_FRAC,
      length / (SEGMENT_COUNT + 1)
    );
    let raf = 0;
    const t0 = performance.now();

    const pointAt = (distAlong: number) => {
      const s = Math.max(0, Math.min(length, distAlong));
      return path.getPointAtLength(s);
    };

    const angleAt = (s: number) => {
      const p0 = pointAt(s);
      const p1 = pointAt(Math.min(length, s + EPS));
      const dx = p1.x - p0.x;
      const dy = p1.y - p0.y;
      if (dx === 0 && dy === 0) {
        return 0;
      }
      return (Math.atan2(dy, dx) * 180) / Math.PI;
    };

    /** Perpendicular unit normal for subtle inchworm lateral wiggle. */
    const normalAt = (s: number): { nx: number; ny: number } => {
      const p0 = pointAt(s);
      const p1 = pointAt(Math.min(length, s + EPS));
      const dx = p1.x - p0.x;
      const dy = p1.y - p0.y;
      const m = Math.hypot(dx, dy) || 1;
      return { nx: -dy / m, ny: dx / m };
    };

    const tick = (now: number) => {
      const raw = (now - t0) / DURATION_MS;
      const t = raw >= 1 ? 1 : raw;
      const u = easeInOutCubic(t);

      const headDist = route.reverse ? (1 - u) * length : u * length;
      const wiggleAmp = 0.11 * Math.sin(u * Math.PI * 5);

      for (let i = 0; i < SEGMENT_COUNT; i++) {
        const el = segRefs.current[i];
        if (!el) {
          continue;
        }
        const s = headDist - i * spacing;
        if (s < -0.02 || s > length + 0.02) {
          el.setAttribute("opacity", "0");
          continue;
        }
        const p = pointAt(s);
        const ang = angleAt(s);
        const { nx, ny } = normalAt(s);
        const wobble = wiggleAmp * (1 - i * 0.08);
        const cx = p.x + nx * wobble;
        const cy = p.y + ny * wobble;
        const w = i === 0 ? 0.62 : 0.52;
        const h = i === 0 ? 0.72 : 0.62;
        el.setAttribute("opacity", "1");
        el.setAttribute("width", String(w));
        el.setAttribute("height", String(h));
        el.setAttribute(
          "transform",
          `translate(${cx} ${cy}) rotate(${ang}) translate(${-w / 2} ${-h / 2})`
        );
      }

      if (raw < 1) {
        raf = requestAnimationFrame(tick);
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [route]);

  return (
    <svg
      aria-hidden
      className="calavera-avatar__worm-crawl"
      height={CALAVERA_GRID_HEIGHT}
      preserveAspectRatio="xMidYMid meet"
      shapeRendering="crispEdges"
      viewBox={`0 0 ${CALAVERA_GRID_WIDTH} ${CALAVERA_GRID_HEIGHT}`}
      width={CALAVERA_GRID_WIDTH}
    >
      <path
        className="calavera-avatar__worm-crawl__track"
        d={route.d}
        fill="none"
        ref={pathRef}
      />
      {SEG_KEYS.map((segKey, i) => (
        <rect
          className={
            i === 0
              ? "calavera-avatar__worm-crawl__seg calavera-avatar__worm-crawl__seg--head"
              : "calavera-avatar__worm-crawl__seg"
          }
          height="0.62"
          key={segKey}
          ref={(el) => {
            segRefs.current[i] = el;
          }}
          rx="0.12"
          ry="0.12"
          width="0.52"
          x="0"
          y="0"
        />
      ))}
    </svg>
  );
}
