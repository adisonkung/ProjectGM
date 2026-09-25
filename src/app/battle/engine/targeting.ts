import { TargetingConfig, TargetStrategy } from '../../core/models/monster';
import { Cell } from '../../core/models/unit';
import { distance, Line } from './grid';

/** Minimal view of a combatant for target selection */
export interface Targetable {
  id: number;
  pos: Cell;
  hp: number;
  maxHp: number;
  line: Line;
}

const hpRatio = (t: Targetable) => (t.maxHp > 0 ? t.hp / t.maxHp : 0);
const byNearest = (from: Cell) => (a: Targetable, b: Targetable) =>
  distance(a.pos, from) - distance(b.pos, from) || Math.abs(a.pos.r - from.r) - Math.abs(b.pos.r - from.r) || a.id - b.id;

/**
 * Can a melee attacker at `from` reach `t` without walking through the defenders' frontline?
 * Reachable when already close (≤ attackRange + 1), or when no OTHER defender stands in a column strictly
 * between the attacker and the target within ±1 lane of the target (that defender would body-block).
 */
export function isReachable(from: Cell, t: Targetable, defenders: Targetable[], attackRange: number): boolean {
  if (distance(from, t.pos) <= Math.floor(attackRange) + 1) return true;
  const lo = Math.min(from.c, t.pos.c);
  const hi = Math.max(from.c, t.pos.c);
  return !defenders.some(d => d !== t && d.pos.c > lo && d.pos.c < hi && Math.abs(d.pos.r - t.pos.r) <= 1);
}

export interface TargetQuery {
  from: Cell;
  /** valid, alive, targetable opponents */
  candidates: Targetable[];
  attackRange: number;
  cfg: TargetingConfig;
  /** current target (if still valid) — strategies keep it when it is as good as the new pick (no flicker) */
  current?: Targetable | null;
}

type Strategy = (q: TargetQuery) => Targetable | null;

/** Reusable target strategies — monsters pick one by name in their AI config */
export const TARGET_STRATEGIES: Record<TargetStrategy, Strategy> = {
  NEAREST_REACHABLE_FRONT: ({ from, candidates, attackRange, current }) => {
    if (!candidates.length) return null;
    const reachable = candidates.filter(t => isReachable(from, t, candidates, attackRange));
    const front = reachable.filter(t => t.line === 'front');
    const pool = front.length ? front : reachable.length ? reachable : candidates;
    const pick = [...pool].sort(byNearest(from))[0];
    // sticky: keep the current target while it is in the pool and not farther than the new pick
    if (current && current !== pick && pool.includes(current) && distance(current.pos, from) <= distance(pick.pos, from)) return current;
    return pick;
  },

  LOWEST_HP_PCT: ({ from, candidates, attackRange, cfg, current }) => {
    if (!candidates.length) return null;
    const tol = cfg.similarHpTolerance ?? 0.05;
    const best = Math.min(...candidates.map(hpRatio));
    const similar = candidates.filter(t => hpRatio(t) <= best + tol + 1e-9);
    const inRange = similar.filter(t => distance(t.pos, from) <= attackRange);
    const pool = inRange.length ? inRange : similar;
    // sticky: two heroes trading 1% HP back and forth don't make the archer swap
    if (current && pool.includes(current)) return current;
    // everything in the pool is within `tol` of the lowest HP% → the nearest wins
    return [...pool].sort(byNearest(from))[0];
  },
};

export const selectTarget = (q: TargetQuery): Targetable | null => TARGET_STRATEGIES[q.cfg.strategy](q);
