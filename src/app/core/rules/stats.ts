import { CLASS_BASE, HERO_CLASS_BASE, starMultiplier } from '../data/classes';
import { gearStatBonus, levelCap } from './progression';
import { HeroTemplate, OwnedHero, Potential, Stats } from '../models/hero';
import { EnemyTemplate, StageDef } from '../models/stage';

/**
 * Level growth per level, linear on the final Lv1 stats (Patch 1 Hero Level spec): HP +4.5 %, ATK +4.0 %, DEF +3.5 %
 * (Lv10 = ×1.405 / ×1.36 / ×1.315). Attack speed, range and cooldowns never grow with level.
 */
export const LEVEL_GROWTH = { hp: 0.03, atk: 0.025, def: 0.02 };
/** potential nudges level growth a little (B = the table above) */
export const POTENTIAL_GROWTH: Record<Potential, number> = { C: 0.9, B: 1, A: 1.1, S: 1.2 };

/** Patch 1: every hero caps at Lv10 (breakthrough gates at 5→6, 8→9, 9→10 — core/data/progression.ts) */
export const maxLevel = (_t?: HeroTemplate) => levelCap();
export const levelUpCost = (h: OwnedHero) => 30 + h.level * 25;

/**
 * Hero stats = 1★ base (`HERO_CLASS_BASE`) × star multiplier (1.00 / 1.05 / 1.10 / 1.15 / 1.20) × linear level growth
 * × (1 + equipped item stat fractions). Skill ranks / gear utility go to the engine as `CombatModifiers`.
 */
export function heroStats(t: HeroTemplate, h: OwnedHero): Stats {
  const base = HERO_CLASS_BASE[t.cls];
  const starMul = starMultiplier(t.star);
  const lv = (h.level - 1) * POTENTIAL_GROWTH[h.potential];
  const gear = gearStatBonus(h);
  return {
    ...base,
    hp: Math.round(base.hp * starMul * (1 + lv * LEVEL_GROWTH.hp) * (1 + gear.hp)),
    atk: Math.round(base.atk * starMul * (1 + lv * LEVEL_GROWTH.atk) * (1 + gear.atk)),
    def: Math.round(base.def * starMul * (1 + lv * LEVEL_GROWTH.def) * (1 + gear.def)),
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
