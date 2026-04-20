import { useEffect, useRef, useState } from "react";

const YAWN_INTERVAL_MIN_MS = 28_000;
const YAWN_INTERVAL_MAX_MS = 78_000;
const YAWN_DURATION_MS = 3200;
/** Extra downward jaw motion in skull viewBox units (matches calavera jaw group translate). */
export const IDLE_YAWN_JAW_MAX = 1.28;

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/** 0–1 open amount over normalized time u ∈ [0, 1]. */
function yawnOpenAmount(u: number): number {
  if (u < 0.2) {
    return smoothstep(0, 1, u / 0.2);
  }
  if (u < 0.5) {
    return 1;
  }
  return 1 - smoothstep(0, 1, (u - 0.5) / 0.5);
}

export type IdleYawnState = {
  /** Add to lower-jaw translate (viewBox units). */
  jawDrop: number;
  /** 0 = eyes normal, 1 = max squint during yawn. */
  eyeSquint: number;
};

/**
 * Random idle yawn: jaw opens / holds / closes, eyes narrow slightly.
 * Only runs while `active` is true (e.g. chat idle + motion OK).
 */
export function useIdleYawn(active: boolean): IdleYawnState {
  const [state, setState] = useState<IdleYawnState>({
    jawDrop: 0,
    eyeSquint: 0,
  });
  const timeoutRef = useRef<number | undefined>(undefined);
  const rafRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!active) {
      setState({ jawDrop: 0, eyeSquint: 0 });
      return;
    }

    let cancelled = false;

    const clearTimers = () => {
      if (timeoutRef.current !== undefined) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = undefined;
      }
      if (rafRef.current !== undefined) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = undefined;
      }
    };

    const runYawn = () => {
      if (cancelled) {
        return;
      }
      const t0 = performance.now();

      const frame = (now: number) => {
        if (cancelled) {
          return;
        }
        const u = Math.min(1, (now - t0) / YAWN_DURATION_MS);
        const open = yawnOpenAmount(u);
        const jawDrop = open * IDLE_YAWN_JAW_MAX;
        const eyeSquint = open;
        if (!cancelled) {
          setState({ jawDrop, eyeSquint });
        }

        if (u < 1) {
          rafRef.current = window.requestAnimationFrame(frame);
        } else if (!cancelled) {
          setState({ jawDrop: 0, eyeSquint: 0 });
          scheduleNext();
        }
      };

      rafRef.current = window.requestAnimationFrame(frame);
    };

    const scheduleNext = () => {
      if (cancelled) {
        return;
      }
      const gap =
        YAWN_INTERVAL_MIN_MS +
        Math.floor(
          Math.random() * (YAWN_INTERVAL_MAX_MS - YAWN_INTERVAL_MIN_MS)
        );
      timeoutRef.current = window.setTimeout(() => {
        runYawn();
      }, gap);
    };

    scheduleNext();

    return () => {
      cancelled = true;
      clearTimers();
      setState({ jawDrop: 0, eyeSquint: 0 });
    };
  }, [active]);

  return state;
}
