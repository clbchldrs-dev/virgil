/** Row index of the upper “teeth” band; pixels get a lighter fill in CSS (reads as a jaw line). */
export const CALAVERA_SKULL_GRIN_ROW = 11;

/** Pixel width of the skull SVG grid (also used for eye horizontal placement in CSS). */
export const CALAVERA_GRID_WIDTH = 16;

/** Pixel height of the skull SVG grid (also used for eye vertical placement in CSS). */
export const CALAVERA_GRID_HEIGHT = 17;

/**
 * 16×17 pixel skull — slightly narrower than the original 20px grid; two cheek rows add space between sockets and mouth.
 * Jaw articulation: pixels with y < {@link CALAVERA_JAW_SPLIT_Y} are the cranium; y ≥ split move as mandible.
 */
export const CALAVERA_JAW_SPLIT_Y = 11;

export const CALAVERA_SKULL_ROWS: readonly string[] = [
  "....XXXXXXXX....",
  "..XXXXXXXXXXXX..",
  ".XXXXXXXXXXXXXX.",
  ".XXXXXXXXXXXXXX.",
  ".XX..XXXX..XXXX.",
  ".XX..XXXX..XXXX.",
  ".XX..XXXX..XXXX.",
  "XX..XX..XXXX..XX",
  "XX..XX..XXXX..XX",
  "..XXXXXXXXXXXX..",
  "..XXXXXXXXXXXX..",
  "X.X.X.X.X.X.X.X.",
  "..XXXXXXXXXXXX..",
  "...XXXXXXXXXX...",
  "....XXXXXXXX....",
  "......XXXX......",
  "........XX......",
];

export const CALAVERA_SKULL_PIXELS: readonly [number, number][] = (() => {
  const pixels: [number, number][] = [];
  for (let y = 0; y < CALAVERA_SKULL_ROWS.length; y++) {
    const row = CALAVERA_SKULL_ROWS[y] ?? "";
    for (let x = 0; x < row.length; x++) {
      if (row[x] === "X") {
        pixels.push([x, y]);
      }
    }
  }
  return pixels;
})();

/** Bowtie SVG (viewBox 0 0 15×5) — wings + center knot; scaled to 15/16 of skull width. Shared with invitation mascot. */
export const CALAVERA_BOWTIE_WIDTH = 15;
export const CALAVERA_BOWTIE_HEIGHT = 5;

export const CALAVERA_BOWTIE_PIXELS: readonly [number, number][] = [
  [2, 0],
  [3, 0],
  [4, 0],
  [10, 0],
  [11, 0],
  [12, 0],
  [1, 1],
  [2, 1],
  [3, 1],
  [4, 1],
  [5, 1],
  [7, 1],
  [9, 1],
  [10, 1],
  [11, 1],
  [12, 1],
  [13, 1],
  [0, 2],
  [1, 2],
  [2, 2],
  [3, 2],
  [6, 2],
  [7, 2],
  [8, 2],
  [11, 2],
  [12, 2],
  [13, 2],
  [14, 2],
  [1, 3],
  [2, 3],
  [3, 3],
  [4, 3],
  [5, 3],
  [7, 3],
  [9, 3],
  [10, 3],
  [11, 3],
  [12, 3],
  [13, 3],
  [2, 4],
  [3, 4],
  [4, 4],
  [10, 4],
  [11, 4],
  [12, 4],
];
