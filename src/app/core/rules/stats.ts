import { CLASS_BASE, HERO_CLASS_BASE, starMultiplier } from '../data/classes';
import { HeroTemplate, OwnedHero, Potential, Stats } from '../models/hero';
import { EnemyTemplate, StageDef } from '../models/stage';

/**
 * Level growth per level (fraction of the star-adjusted base) — deliberately moderate so levels never erase mechanics:
 * HP +3.0%, ATK +2.5%, DEF +2.0% per level (Lv10 ATK = 122.5% of Lv1). Long-term power comes from other systems later.
 */
export const LEVEL_GROWTH = { hp: 0.03, atk: 0.025, def: 0.02 };
/** potential nudges level growth a little (B = the table above) */
export const POTENTIAL_GROWTH: Record<Potential, number> = { C: 0.9, B: 1, A: 1.1, S: 1.2 };

export const maxLevel = (t: HeroTemplate) => 10 + t.star * 4;
export const levelUpCost = (h: OwnedHero) => 30 + h.level * 25;

/**
 * Hero stats = 1★ base (`HERO_CLASS_BASE`) × star multiplier (1.00 / 1.05 / 1.10 / 1.15 / 1.20) × linear level growth.
 * One multiplication chain — no other rarity / equipment / promotion bonus exists in the vertical slice.
 */
export function heroStats(t: HeroTemplate, h: OwnedHero): Stats {
  const base = HERO_CLASS_BASE[t.cls];
  const starMul = starMultiplier(t.star);
  const lv = (h.level - 1) * POTENTIAL_GROWTH[h.potential];
  return {
    ...base,
    hp: Math.round(base.hp * starMul * (1 + lv * LEVEL_GROWTH.hp)),
    atk: Math.round(base.atk * starMul * (1 + lv * LEVEL_GROWTH.atk)),
    def: Math.round(base.def * starMul * (1 + lv * LEVEL_GROWTH.def)),
  };
}

/** ค่าพลังศัตรูตามชั้น */
export function enemyStats(e: EnemyTemplate, stage: StageDef): Stats {
  const n = stage.floor;
  const scale = (1 + (n - 1) * 0.32) * (stage.mode === 'survive' ? 0.85 : 1);
  const base = CLASS_BASE[e.cls];
  return {
    ...base,
    hp: Math.round(e.hp * scale),
    atk: Math.round(e.atk * scale),
    def: Math.round(e.def * (1 + (n - 1) * 0.2)),
  };
}

/** ตัวเลขพลังรวมคร่าว ๆ ไว้เทียบทีม */
export const power = (s: Stats) => Math.round(s.hp * 0.1 + s.atk * s.atkSpeed * 2.2 + s.def * 0.8);
