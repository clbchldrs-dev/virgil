import { useEffect, useState } from "react";

const WORM_IDLE_MIN_MS = 14_000;
const WORM_IDLE_MAX_MS = 52_000;

/**
 * Periodically increments `playId` so {@link CalaveraWormCrawl} remounts on a random route.
 */
export function useCalaveraWormIdleReplay(
  active: boolean,
  prefersReducedMotion: boolean
): number {
  const [wormPlayId, setWormPlayId] = useState(0);

  useEffect(() => {
    if (!active || prefersReducedMotion) {
      return;
    }
    let cancelled = false;
    let timeoutId: number | undefined;

    const schedule = () => {
      const delay =
        WORM_IDLE_MIN_MS +
        Math.floor(Math.random() * (WORM_IDLE_MAX_MS - WORM_IDLE_MIN_MS));
      timeoutId = window.setTimeout(() => {
        if (cancelled) {
          return;
        }
        setWormPlayId((n) => n + 1);
        schedule();
      }, delay);
    };

    schedule();
    return () => {
      cancelled = true;
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [active, prefersReducedMotion]);

  return wormPlayId;
}
