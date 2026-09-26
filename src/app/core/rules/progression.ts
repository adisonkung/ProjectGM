import { BREAKTHROUGHS } from '../data/economy';
import { currentLevelCap } from './leveling';
import { BREAKTHROUGH_GATES, EQUIPMENT, equipmentId, PATCH_1, PROFILE_ACCESSORY, SKILL_RANK_EFFECTS } from '../data/progression';
import { HERO_BY_ID } from '../data/heroes';
import { OwnedHero } from '../models/hero';
import { CombatModifiers, EquipmentDefinition, EquipmentSlot, PowerProfile, ResistableStatus, SkillKind, SkillRanks } from '../models/progression';

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

export function equipmentOf(h: OwnedHero): EquipmentDefinition[] {
  return Object.values(h.equipment ?? {}).map(id => (id ? EQUIPMENT[id] : undefined)).filter((x): x is EquipmentDefinition => !!x);
}

/** summed raw-stat fractions of the equipped items (applied on top of the level-adjusted stats) */
export function gearStatBonus(h: OwnedHero): { hp: number; atk: number; def: number } {
  const b = { hp: 0, atk: 0, def: 0 };
  for (const e of equipmentOf(h)) {
    b.hp += e.stats.hp ?? 0;
    b.atk += e.stats.atk ?? 0;
    b.def += e.stats.def ?? 0;
  }
  return b;
}

/** skill ranks + equipment utility → what the combat engine reads */
export function combatModifiers(h: OwnedHero): CombatModifiers {
  const ranks = skillRanksOf(h);
  const gear = equipmentOf(h);
  const cdr = Math.min(0.3, gear.reduce((a, e) => a + (e.utility?.cooldownReduction ?? 0), 0));
  const breakGear = gear.reduce((a, e) => a + (e.utility?.breakBonus ?? 0), 0);
  const healing = 1 + gear.reduce((a, e) => a + (e.utility?.healingBonus ?? 0), 0);
  const statusResist: Partial<Record<ResistableStatus, number>> = {};
  for (const e of gear) {
    for (const [id, v] of Object.entries(e.utility?.statusResist ?? {}) as [ResistableStatus, number][]) {
      statusResist[id] = Math.min(0.75, (statusResist[id] ?? 0) + v);
    }
  }
  const per = <T>(f: (k: SkillKind) => T) => Object.fromEntries(SLOTS.map(k => [k, f(k)])) as Record<SkillKind, T>;
  return {
    skillPower: per(k => SKILL_RANK_EFFECTS[ranks[k]].power),
    cooldown: per(k => SKILL_RANK_EFFECTS[ranks[k]].cooldown * (1 - cdr)),
    breakBonus: per(k => SKILL_RANK_EFFECTS[ranks[k]].breakBonus + breakGear),
    healing,
    statusResist,
  };
}

/** a hero developed to a power profile (simulations / future "recommended power" previews) */
export function applyProfile(h: OwnedHero, p: PowerProfile, level = p.level): OwnedHero {
  const cls = HERO_BY_ID[h.templateId].cls;
  const lv = Math.min(levelCap(), level);
  const tierOf = (slot: EquipmentSlot) => (typeof p.gear === 'string' ? p.gear : p.gear?.[slot]);
  const equipment: Partial<Record<EquipmentSlot, string>> = {};
  for (const slot of ['WEAPON', 'ARMOR', 'ACCESSORY'] as EquipmentSlot[]) {
    const t = tierOf(slot);
    if (t) equipment[slot] = equipmentId(slot, t, PROFILE_ACCESSORY[cls]);
  }
  const tier = BREAKTHROUGHS.filter(b => lv >= b.toLevel).length;
  return { ...h, level: lv, exp: 0, breakthroughTier: tier, skillRanks: { ...p.ranks }, equipment };
}
