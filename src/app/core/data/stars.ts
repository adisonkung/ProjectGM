/**
 * Star development (Patch 1 gacha / duplicates spec).
 *
 * Gacha rarity 1★–3★ · every hero develops to 6★ with Hero Memory (from duplicates) or Universal Memory (gameplay).
 * 3★ → 6★ = +18 % raw stats (STAR_STAT_MULTIPLIER in classes.ts) + small utility perks · sprite size never changes —
 * higher stars show a new frame colour, an aura (5★) and an awakened aura + motes (6★).
 */

export const MAX_STAR = 6;
export const GACHA_MAX_STAR = 3;

/** Memory to go from star N to N+1 (3★ hero: 100 + 150 + 250 = 500 ≈ 4–5 duplicates) */
export const STAR_UP_COST: Record<number, number> = { 1: 40, 2: 70, 3: 100, 4: 150, 5: 250 };

/** Hero Memory granted by one duplicate pull, by the hero's base rarity */
export const DUPLICATE_MEMORY: Record<number, number> = { 1: 60, 2: 80, 3: 110 };
/** a duplicate of a hero already at 6★ becomes Universal Memory at this rate */
export const MAXED_DUPLICATE_TO_UNIVERSAL = 0.5;

/** Universal Memory: an inventory item, usable for any hero's star-up (after that hero's own Memory) */
export const UNIVERSAL_MEMORY = 'universal_memory';

/** utility perks at a star (totals, not increments) — combat modifiers, never raw stats */
export interface StarPerk {
  /** ultimate gauge at battle start */
  startGauge: number;
  /** skill / skill2 / ult cooldown multiplier */
  cooldown: number;
  /** + crit chance */
  crit: number;
  label: string;
}
export const STAR_PERKS: Record<number, StarPerk> = {
  4: { startGauge: 10, cooldown: 1, crit: 0, label: 'เริ่มการต่อสู้ด้วยเกจท่าไม้ตาย 10' },
  5: { startGauge: 10, cooldown: 0.95, crit: 0, label: 'คูลดาวน์สกิล −5%' },
  6: { startGauge: 20, cooldown: 0.95, crit: 0.03, label: 'ตื่นพลัง: เกจเริ่ม 20 · คริติคอล +3%' },
};
export const NO_PERK: StarPerk = { startGauge: 0, cooldown: 1, crit: 0, label: '' };

/** visual evolution per star (sprite size unchanged) */
export const STAR_VISUAL: Record<number, { frame: string; aura: 'none' | 'aura' | 'awakened'; label: string }> = {
  1: { frame: 'var(--r1)', aura: 'none', label: '' },
  2: { frame: 'var(--r2)', aura: 'none', label: '' },
  3: { frame: 'var(--r3)', aura: 'none', label: '' },
  4: { frame: 'var(--r4)', aura: 'none', label: 'กรอบใหม่' },
  5: { frame: 'var(--r5)', aura: 'aura', label: 'ออร่าบนสนาม' },
  6: { frame: 'var(--r6)', aura: 'awakened', label: 'ออร่าตื่นพลัง + ละอองแสง' },
};

// ------------------------------------------------------------------ gacha (base rarity 1★–3★)

export const GACHA = {
  /** gems per pull / per 10-pull */
  single: 100,
  multi: 900,
  /** base rates (sum 1) */
  rates: { 1: 0.6, 2: 0.32, 3: 0.08 } as Record<number, number>,
  /** the Nth pull without a 3★ is a guaranteed 3★ */
  pity: 50,
  /** every 10-pull contains at least one 2★+ */
  multiFloor: 2,
  /** potential of newly summoned heroes */
  potential: [['S', 0.1], ['A', 0.25], ['B', 0.4], ['C', 0.25]] as [string, number][],
};
