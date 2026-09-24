import { CLASS_BASE } from '../data/classes';
import { HeroTemplate, OwnedHero, Potential, Stats } from '../models/hero';
import { EnemyTemplate, StageDef } from '../models/stage';

export const POTENTIAL_GROWTH: Record<Potential, number> = { C: 0.07, B: 0.09, A: 0.11, S: 0.14 };

export const maxLevel = (t: HeroTemplate) => 10 + t.star * 4;
export const levelUpCost = (h: OwnedHero) => 30 + h.level * 25;

/** ค่าพลังของฮีโร่ตามดาว เลเวล และศักยภาพ */
export function heroStats(t: HeroTemplate, h: OwnedHero): Stats {
  const base = CLASS_BASE[t.cls];
  const starMul = 1 + (t.star - 1) * 0.28;
  const g = POTENTIAL_GROWTH[h.potential];
  const lvlMul = 1 + (h.level - 1) * g;
  return {
    ...base,
    hp: Math.round(base.hp * starMul * lvlMul),
    atk: Math.round(base.atk * starMul * lvlMul),
    def: Math.round(base.def * starMul * (1 + (h.level - 1) * g * 0.6)),
    atkSpeed: +(base.atkSpeed * (1 + (t.star - 1) * 0.04)).toFixed(3),
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
