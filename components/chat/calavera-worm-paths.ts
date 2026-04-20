/**
 * Bezier routes in skull SVG space (viewBox 0 0 16×17), aligned with eye sockets / nose / mouth.
 * `reverse: true` runs the crawl from path end → start (e.g. mouth back to socket).
 */
export type CalaveraWormRoute = {
  readonly d: string;
  readonly reverse: boolean;
};

/** Eye sockets, nasal bridge, mouth — same convention as calavera CSS eye anchors (~x 3.5 / 12.5, y 5.5). */
export const WORM_ROUTES: readonly CalaveraWormRoute[] = [
  { d: "M3.5 5.5 C4.9 7.4 6.3 9.3 8 10.85", reverse: false },
  { d: "M3.5 5.5 C4.9 7.4 6.3 9.3 8 10.85", reverse: true },
  { d: "M12.5 5.5 C11.1 7.4 9.7 9.3 8 10.85", reverse: false },
  { d: "M12.5 5.5 C11.1 7.4 9.7 9.3 8 10.85", reverse: true },
  { d: "M3.5 5.5 C5.4 5.75 6.8 6.05 8 6.35", reverse: false },
  { d: "M3.5 5.5 C5.4 5.75 6.8 6.05 8 6.35", reverse: true },
  { d: "M12.5 5.5 C10.6 5.75 9.2 6.05 8 6.35", reverse: false },
  { d: "M12.5 5.5 C10.6 5.75 9.2 6.05 8 6.35", reverse: true },
];
