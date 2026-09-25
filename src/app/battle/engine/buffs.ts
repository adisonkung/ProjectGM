import { BuffDefinition } from '../../core/models/monster';

/** Runtime buff instance (definition is never mutated) */
export interface ActiveBuff {
  def: BuffDefinition;
  remaining: number;
  sourceId: number;
}

export interface Buffable {
  buffs: ActiveBuff[];
}

/**
 * Apply a buff according to its stack policy.
 * REFRESH_DURATION: an existing instance only gets its duration reset (never 1.25 × 1.25 …).
 * IGNORE: an existing instance is kept as is.
 */
export function applyBuff(u: Buffable, def: BuffDefinition, sourceId: number): 'applied' | 'refreshed' | 'ignored' {
  const cur = u.buffs.find(b => b.def.id === def.id);
  if (cur) {
    if (def.stackPolicy === 'IGNORE') return 'ignored';
    cur.remaining = def.duration;
    cur.sourceId = sourceId;
    return 'refreshed';
  }
  u.buffs.push({ def, remaining: def.duration, sourceId });
  return 'applied';
}

/**
 * Count buffs down; returns the ones that expired this tick (already removed).
 * `transition` = a wave transition is running: effects with pauseDuringWaveTransition keep their time.
 */
export function tickBuffs(u: Buffable, dt: number, transition = false): ActiveBuff[] {
  if (!u.buffs.length) return [];
  const expired: ActiveBuff[] = [];
  for (const b of u.buffs) {
    if (transition && b.def.pauseDuringWaveTransition) continue;
    b.remaining -= dt;
    if (b.remaining <= 1e-9) expired.push(b);
  }
  if (expired.length) u.buffs = u.buffs.filter(b => !expired.includes(b));
  return expired;
}

export const buffRemaining = (u: Buffable, id: string): number => u.buffs.find(b => b.def.id === id)?.remaining ?? 0;

/** Product of all active attack modifiers (1 when none) */
export const attackModifier = (u: Buffable): number => u.buffs.reduce((m, b) => m * (b.def.modifiers.attackMultiplier ?? 1), 1);
