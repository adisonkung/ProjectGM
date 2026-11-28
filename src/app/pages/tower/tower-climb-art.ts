/**
 * Tower climb background (tools/ui/export_tower_climb_art.py → public/ui/tower/climb-*.webp). All numbers are source
 * pixels of the 887 px wide art; the climb column scales them with its width.
 *
 * Layout (bottom → top): climb-base.webp (warp entrance + tiers 1–3), then climb-loop.webp repeated upward. The loop
 * is pre-rotated so it is bottom-aligned straight onto the base: one tile = two tiers, rails at 725 and 327 from the
 * tile's top.
 */
export const CLIMB_ART = {
  width: 887,
  baseHeight: 1774,
  loopHeight: 797,
  base: '/ui/tower/climb-base.webp',
  loop: '/ui/tower/climb-loop.webp',
} as const;

/** balcony rails of the base, from the top (floor 1 = lowest) */
const BASE_RAILS = [1082, 714, 327];
/** balcony rails inside one loop tile, from the tile's top, lower rail first */
const LOOP_RAILS = [725, 327];
/** sky kept above the highest floor so its plate is not at the very top */
const HEADROOM = 380;

/** height of a floor's balcony rail above the bottom of the climb column (source px) */
export function climbRail(floor: number): number {
  if (floor <= BASE_RAILS.length) return CLIMB_ART.baseHeight - BASE_RAILS[floor - 1];
  const k = floor - BASE_RAILS.length - 1;
  const tile = Math.floor(k / LOOP_RAILS.length);
  const rail = LOOP_RAILS[k % LOOP_RAILS.length];
  return CLIMB_ART.baseHeight + tile * CLIMB_ART.loopHeight + (CLIMB_ART.loopHeight - rail);
}

/** total column height (source px) for a tower of `floors` floors */
export const climbHeight = (floors: number): number => Math.ceil(climbRail(floors) + HEADROOM);
