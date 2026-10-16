import { SPRITE_ATLAS } from './sprite-atlas';

/**
 * Where a sprite file is served from and how its frames are laid out. `public/sprites/*.png` stay the pipeline's
 * canonical files; the game loads the optimised copies (`tools/sprites/optimize.py` → `public/sprites/opt/`,
 * WebP where it is smaller, long FX strips re-packed into grids ≤ 4096 px). A file missing from the generated atlas
 * (just baked, optimizer not re-run yet) falls back to its PNG — still correct, only bigger.
 */
export function spriteUrl(file: string): string {
  return `sprites/${SPRITE_ATLAS[file]?.url ?? file}`;
}

export interface StripGrid {
  cols: number;
  rows: number;
}

/** frame grid of an FX / projectile strip of `strip` frames (one row unless the optimizer re-packed it) */
export function stripGrid(file: string, strip: number): StripGrid {
  const a = SPRITE_ATLAS[file];
  return a?.cols ? { cols: a.cols, rows: a.rows ?? 1 } : { cols: strip, rows: 1 };
}

/** frame i of a strip grid as CSS background-position percentages (background-size = cols × 100 % rows × 100 %) */
export function gridPosition(i: number, g: StripGrid): string {
  const c = i % g.cols;
  const r = Math.floor(i / g.cols);
  const x = g.cols > 1 ? (c / (g.cols - 1)) * 100 : 0;
  const y = g.rows > 1 ? (r / (g.rows - 1)) * 100 : 0;
  return `${x}% ${y}%`;
}

/** frame i of a strip grid: column / row */
export function gridCell(i: number, g: StripGrid): [number, number] {
  return [i % g.cols, Math.floor(i / g.cols)];
}
