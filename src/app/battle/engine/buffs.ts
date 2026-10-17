import { StatusEffectDefinition, StatusFlag, StatusModifiers } from '../../core/models/combat';

/**
 * Status effect system (buffs, debuffs, DoT / HoT, control) — shared by heroes and monsters.
 * Definitions are static data (core/data/status-effects.ts, BUFFS for monsters); only these runtime
 * instances change. Base stats are never modified: every query multiplies on the fly.
 */

/** Runtime instance of a status effect */
export interface ActiveBuff {
  def: StatusEffectDefinition;
  remaining: number;
  /** battle unit id of the source */
  sourceId: number;
  stacks: number;
  /** DoT / HoT: source ATK snapshot at application */
  magnitude: number;
  /** DoT / HoT: time until the next tick */
  tickTimer: number;
  /** counterStatus already spent for this application */
  counterUsed?: boolean;
}

export interface Buffable {
  buffs: ActiveBuff[];
}

export type ApplyResult = 'applied' | 'refreshed' | 'stacked' | 'ignored';

/**
 * Apply a status according to its stack policy.
 * REFRESH_DURATION: an existing instance only gets its duration reset (never 1.25 × 1.25 …).
 * INDEPENDENT_BY_SOURCE: same source refreshes its own instance, other sources get their own.
 */
export function applyBuff(
  u: Buffable, def: StatusEffectDefinition, sourceId: number, opts: { magnitude?: number; duration?: number } = {},
): ApplyResult {
  const duration = opts.duration ?? def.duration;
  const magnitude = opts.magnitude ?? 0;
  const bySource = def.stackPolicy === 'INDEPENDENT_BY_SOURCE';
  const cur = u.buffs.find(b => b.def.id === def.id && (!bySource || b.sourceId === sourceId));
  if (cur) {
    switch (def.stackPolicy) {
      case 'NONE':
        return 'ignored';
      case 'STACK_DURATION':
        cur.remaining += duration;
        return 'stacked';
      case 'STACK_MAGNITUDE':
        cur.stacks = Math.min(def.maxStacks ?? Infinity, cur.stacks + 1);
        cur.remaining = duration;
        return 'stacked';
      default:
        // REFRESH_DURATION / INDEPENDENT_BY_SOURCE (same source)
        if (def.refreshModifiers === 'MINIMUM') {
          const modifiers: StatusModifiers = { ...def.modifiers };
          for (const key of Object.keys(cur.def.modifiers) as (keyof StatusModifiers)[]) {
            modifiers[key] = Math.min(cur.def.modifiers[key] ?? 1, modifiers[key] ?? 1);
          }
          cur.def = { ...def, modifiers };
        }
        cur.remaining = duration;
        cur.sourceId = sourceId;
        cur.magnitude = magnitude || cur.magnitude;
        return 'refreshed';
    }
  }
  u.buffs.push({ def, remaining: duration, sourceId, stacks: 1, magnitude, tickTimer: def.tick?.interval ?? 0 });
  return 'applied';
}

export interface StatusTickResult {
  expired: ActiveBuff[];
  /** DoT / HoT amounts due this tick */
  ticks: { buff: ActiveBuff; kind: 'DAMAGE' | 'HEAL'; amount: number }[];
}

/**
 * Count statuses down; returns the ones that expired this tick (already removed) and DoT / HoT amounts.
 * `transition` = a wave transition is running: effects with pauseDuringWaveTransition keep their time.
 */
export function tickStatuses(u: Buffable, dt: number, transition = false): StatusTickResult {
  const out: StatusTickResult = { expired: [], ticks: [] };
  if (!u.buffs.length) return out;
  for (const b of u.buffs) {
    if (transition && b.def.pauseDuringWaveTransition) continue;
    const step = Math.min(dt, Math.max(0, b.remaining));
    b.remaining -= dt;
    const t = b.def.tick;
    if (t && step > 0) {
      b.tickTimer -= step;
      while (b.tickTimer <= 1e-9) {
        out.ticks.push({ buff: b, kind: t.kind, amount: b.magnitude * t.perSecond * t.interval * b.stacks });
        b.tickTimer += t.interval;
      }
    }
    if (b.remaining <= 1e-9) out.expired.push(b);
  }
  if (out.expired.length) u.buffs = u.buffs.filter(b => !out.expired.includes(b));
  return out;
}

/** expired statuses only (monster specs / legacy callers) */
export const tickBuffs = (u: Buffable, dt: number, transition = false): ActiveBuff[] => tickStatuses(u, dt, transition).expired;

export const buffRemaining = (u: Buffable, id: string): number =>
  Math.max(0, ...u.buffs.filter(b => b.def.id === id).map(b => b.remaining));
export const hasStatus = (u: Buffable, id: string): boolean => u.buffs.some(b => b.def.id === id);
export const hasFlag = (u: Buffable, flag: StatusFlag): boolean => u.buffs.some(b => b.def.flags?.includes(flag));

/** product of one modifier over all active statuses (1 when none) */
export const modifier = (u: Buffable, key: Exclude<keyof StatusModifiers, 'dodgeChance'>): number =>
  u.buffs.reduce((m, b) => m * Math.pow(b.def.modifiers[key] ?? 1, b.stacks), 1);

export const attackModifier = (u: Buffable): number => modifier(u, 'attackMultiplier');

/** highest dodge chance of the active statuses (they don't add up) */
export const dodgeChance = (u: Buffable): number => Math.max(0, ...u.buffs.map(b => b.def.modifiers.dodgeChance ?? 0));

/** the unit that taunted this one (longest remaining taunt), if any */
export const tauntSource = (u: Buffable): number | null => {
  const t = u.buffs.filter(b => b.def.flags?.includes('taunted')).sort((a, b) => b.remaining - a.remaining)[0];
  return t ? t.sourceId : null;
};

/** Effective combat movement speed, shared by heroes, monsters and visual glide. */
export const effectiveMoveSpeed = (u: Buffable & { moveSpeed: number }): number =>
  Math.max(0.01, u.moveSpeed * modifier(u, 'moveSpeedMultiplier'));

/** Monster controller preserves its legacy haste behavior; only negative status factors slow its cooldown clock. */
export const attackSpeedReduction = (u: Buffable): number =>
  u.buffs.reduce((m, b) => m * Math.pow(Math.min(1, b.def.modifiers.attackSpeedMultiplier ?? 1), b.stacks), 1);
