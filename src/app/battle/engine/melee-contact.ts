import { SpatialUnit, unitDistance } from './footprint';

/** Basic melee must close half of a lane before swinging across it (user 2026-10-29). */
export const MELEE_LANE_REACH = 0.5;
export const MELEE_CONTACT_EPS = 0.01;
export const isMeleeRange = (range: number) => range <= 1.5;
export interface ContactBody extends SpatialUnit { x: number; y: number }

function bounds(u: ContactBody) {
  const f = u.footprint;
  const x0 = u.x - (f?.anchorC ?? 0), y0 = u.y - (f?.anchorR ?? 0);
  return { x0, y0, x1: x0 + (f?.cols ?? 1) - 1, y1: y0 + (f?.rows ?? 1) - 1 };
}

/** Use real world positions for contact; logical cells still limit which bodies can be engaged. */
export function inBasicAttackRange(a: ContactBody, b: ContactBody, range: number, hitTolerance = 0): boolean {
  if (unitDistance(a, b) > range + hitTolerance) return false;
  if (!isMeleeRange(range)) return true;
  const x = bounds(a), y = bounds(b);
  const dx = Math.max(0, x.x0 - y.x1, y.x0 - x.x1);
  const dy = Math.max(0, x.y0 - y.y1, y.y0 - x.y1);
  return dx <= range + hitTolerance + MELEE_CONTACT_EPS && dy <= MELEE_LANE_REACH + MELEE_CONTACT_EPS;
}

/**
 * Walk within the current cell toward the nearest edge of the target's real body.
 * One mover closes 1/2 cell; two movers usually close about 1/4 each. Never changes grid occupancy or AoE cells.
 */
export function meleeStandY(a: ContactBody, b: ContactBody): number {
  // Large multi-cell bodies hold their authored anchor; opponents approach the nearest occupied lane instead.
  if (a.footprint) return a.pos.r;
  const t = bounds(b);
  const desired = a.pos.r < t.y0 - MELEE_LANE_REACH ? t.y0 - MELEE_LANE_REACH
    : a.pos.r > t.y1 + MELEE_LANE_REACH ? t.y1 + MELEE_LANE_REACH : a.pos.r;
  return Math.max(a.pos.r - 0.5, Math.min(a.pos.r + 0.5, desired));
}
