import { BREAKTHROUGHS } from '../data/economy';
import { currentLevelCap } from './leveling';
import { BREAKTHROUGH_GATES, PATCH_1, SKILL_RANK_EFFECTS } from '../data/progression';
import { HERO_BY_ID } from '../data/heroes';
import { OwnedHero } from '../models/hero';
import { CombatModifiers, PowerProfile, SkillKind, SkillRanks } from '../models/progression';
import { CRIT_CHANCE_BASE, CRIT_MULTIPLIER_BASE } from '../data/classes';
import { heroGearTotals, profileGear } from './equipment';

const SLOTS: SkillKind[] = ['skill', 'skill2', 'ult'];
const clampRank = (r: number | undefined) => Math.max(1, Math.min(PATCH_1.maxSkillRank, Math.round(r ?? 1)));

/** Patch 1 level cap (Lv10) */
export const levelCap = () => PATCH_1.levelCap;

/** a breakthrough gate sits at this level (level → level + 1 is locked until it is done) */
export const gateAt = (level: number) => BREAKTHROUGH_GATES.find(g => g.from === level) ?? null;

/** the hero stands at a gate it has not broken through yet */
export const needsBreakthrough = (h: OwnedHero) => h.level < levelCap() && h.level >= currentLevelCap(h);

/** a level can still be gained with EXP alone (no breakthrough / cap in the way) */
export const canLevelUp = (h: OwnedHero) => h.level < levelCap() && !needsBreakthrough(h);

export function skillRanksOf(h: OwnedHero): SkillRanks {
  return { skill: clampRank(h.skillRanks?.skill), skill2: clampRank(h.skillRanks?.skill2), ult: clampRank(h.skillRanks?.ult) };
}

/** equipment raw-stat bonuses (applied once, after level growth): % stats + flat ATK */
export function gearStatBonus(h: OwnedHero): { hp: number; atk: number; def: number; atkFlat: number; attackSpeed: number; moveSpeed: number } {
  const t = heroGearTotals(h);
  return { hp: t.hpPct, atk: t.atkPct, def: t.defPct, atkFlat: t.atkFlat, attackSpeed: t.attackSpeed, moveSpeed: t.moveSpeed };
}

/** skill ranks + equipment utility → what the combat engine reads (gear already capped in gearTotals) */
export function combatModifiers(h: OwnedHero): CombatModifiers {
  const ranks = skillRanksOf(h);
  const g = heroGearTotals(h);
  const per = <T>(f: (k: SkillKind) => T) => Object.fromEntries(SLOTS.map(k => [k, f(k)])) as Record<SkillKind, T>;
  return {
    skillPower: per(k => SKILL_RANK_EFFECTS[ranks[k]].power * (1 + g.skillDamage)),
    cooldown: per(k => SKILL_RANK_EFFECTS[ranks[k]].cooldown * (1 - g.cooldownReduction)),
    breakBonus: per(k => SKILL_RANK_EFFECTS[ranks[k]].breakBonus + g.breakPower),
    healing: 1 + g.healingPower,
    shieldPower: 1 + g.shieldPower,
    healingReceived: 1 + g.healingReceived,
    critChance: CRIT_CHANCE_BASE + g.critChance,
    critMultiplier: CRIT_MULTIPLIER_BASE + g.critDamage,
    damageReduction: g.damageReduction,
    bleedReduction: g.bleedReduction,
    diveReduction: g.diveReduction,
    execution: g.execution,
    mistHunter: g.mistHunter,
    statusResist: { poison: g.poisonReduction, root: g.rootReduction },
  };
}

/** a hero developed to a power profile (simulations / future "recommended power" previews) */
export function applyProfile(h: OwnedHero, p: PowerProfile, level = p.level): OwnedHero {
  const cls = HERO_BY_ID[h.templateId].cls;
  const lv = Math.min(levelCap(), level);
  const gear = p.gear ? profileGear(cls, p.gear) : {};
  for (const i of Object.values(gear)) if (i) i.equippedHeroId = h.uid;
  const tier = BREAKTHROUGHS.filter(b => lv >= b.toLevel).length;
  return { ...h, level: lv, exp: 0, breakthroughTier: tier, skillRanks: { ...p.ranks }, gear };
}
