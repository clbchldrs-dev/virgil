/** Row index of the toothy grin (Papyrus-style); teeth get a slightly brighter fill in CSS. */
export const CALAVERA_SKULL_GRIN_ROW = 9;

/**
 * 20×15 pixel skull — Papyrus-style cheekbones + alternating “teeth” row under cheeks.
 * Jaw articulation: pixels with y < {@link CALAVERA_JAW_SPLIT_Y} are the cranium; y ≥ split move as mandible.
 */
export const CALAVERA_JAW_SPLIT_Y = 9;

export const CALAVERA_SKULL_ROWS: readonly string[] = [
  ".....XXXXXXXXXX.....",
  "..XXXXXXXXXXXXXXXX..",
  ".XXXXXXXXXXXXXXXXXX.",
  ".XXXXXXXXXXXXXXXXXX.",
  ".XX..XXXX..XXXX..XX.",
  ".XX..XXXX..XXXX..XX.",
  ".XX..XXXX..XXXX..XX.",
  "XX..XX..XXXX..XX..XX",
  "XX..XX..XXXX..XX..XX",
  "X.X.X.X.X.X.X.X.X.X.",
  "..XXXXXXXXXXXXXXXX..",
  "...XXXXXXXXXXXXXX...",
  "....XXXXXXXXXXXX....",
  "......XXXXXXXX......",
  "........XXXX........",
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
