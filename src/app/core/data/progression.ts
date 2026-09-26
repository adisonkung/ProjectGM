/**
 * Patch 1 progression configuration (spec: claude/patch1-progression-spec.md).
 *
 * PROVISIONAL numbers: equipment stats / utility and skill-rank effects are first-pass values so the simulation
 * profiles can run. Hero EXP / breakthrough items / farm dungeons live in core/data/economy.ts
 * (next tasks: Equipment farming → Skill upgrade farming).
 *
 * Intended share of Patch 1 power (conceptual, not arithmetic): hero level 30–35 %, equipment 25–30 %,
 * skill ranks 15–20 %, composition + tactics on top.
 */
import { HeroClass } from '../models/hero';
import { BREAKTHROUGHS } from './economy';
import {
  BreakthroughGate, EquipmentDefinition, EquipmentSlot, EquipmentUtility, FloorBand, GearTier, PowerProfile, SkillRankEffect,
} from '../models/progression';

export const PATCH_1 = {
  /** hero level cap of the released Patch 1 (Lv10 = a meaningful endgame milestone) */
  levelCap: 10,
  floors: 10,
  /** Floor 10 = Patch 1 endgame */
  endgameFloor: 10,
  maxSkillRank: 5,
};

/** level → level + 1 needs a breakthrough first — derived from BREAKTHROUGHS (core/data/economy.ts, items + unlocks) */
export const BREAKTHROUGH_GATES: BreakthroughGate[] = BREAKTHROUGHS.map(b => ({ from: b.fromLevel, kind: b.tier === 3 ? 'MAJOR' : 'MILESTONE' }));

/** skill rank 1–5 (PROVISIONAL): power = damage / healing / shields · cooldown multiplier · extra Break power */
export const SKILL_RANK_EFFECTS: Record<number, SkillRankEffect> = {
  1: { power: 1.0, cooldown: 1.0, breakBonus: 0 },
  2: { power: 1.08, cooldown: 1.0, breakBonus: 0 },
  3: { power: 1.16, cooldown: 0.95, breakBonus: 5 },
  4: { power: 1.25, cooldown: 0.92, breakBonus: 10 },
  5: { power: 1.35, cooldown: 0.9, breakBonus: 15 },
};

export const GEAR_TIERS: GearTier[] = ['EARLY', 'MID', 'GOOD', 'VERY_GOOD'];
const TIER_NAME: Record<GearTier, string> = { EARLY: 'Worn', MID: 'Sturdy', GOOD: 'Fine', VERY_GOOD: 'Masterwork' };
const T = (early: number, mid: number, good: number, veryGood: number): Record<GearTier, number> => ({ EARLY: early, MID: mid, GOOD: good, VERY_GOOD: veryGood });

/** PROVISIONAL tier scaling (fractions of the hero's level-adjusted stat) */
const WEAPON_ATK = T(0.05, 0.1, 0.15, 0.2);
const ARMOR_HP = T(0.05, 0.09, 0.13, 0.18);
const ARMOR_DEF = T(0.05, 0.08, 0.11, 0.15);
const ACC_STAT = T(0.02, 0.03, 0.05, 0.06);
const RESIST = T(0.15, 0.25, 0.35, 0.45);
const BREAK = T(5, 10, 15, 20);
const CDR = T(0.03, 0.05, 0.08, 0.1);
const HEAL = T(0.05, 0.1, 0.15, 0.2);

/** accessory families: raw stats stay small, the point is the mechanical utility */
export type AccessoryKind = 'ward' | 'anchor' | 'breaker' | 'focus' | 'mending';
const ACCESSORY: Record<AccessoryKind, { name: string; utility: (t: GearTier) => EquipmentUtility; stat: 'hp' | 'atk' }> = {
  ward: { name: 'Ward Charm', stat: 'hp', utility: t => ({ statusResist: { bleed: RESIST[t], poison: RESIST[t] } }) },
  anchor: { name: 'Rootbreaker Band', stat: 'hp', utility: t => ({ statusResist: { root: RESIST[t], corruption: RESIST[t], stun: RESIST[t] / 2 } }) },
  breaker: { name: 'Breaker Sigil', stat: 'atk', utility: t => ({ breakBonus: BREAK[t] }) },
  focus: { name: 'Focus Ring', stat: 'atk', utility: t => ({ cooldownReduction: CDR[t] }) },
  mending: { name: 'Mending Pendant', stat: 'hp', utility: t => ({ healingBonus: HEAL[t] }) },
};

function buildCatalog(): Record<string, EquipmentDefinition> {
  const out: Record<string, EquipmentDefinition> = {};
  for (const t of GEAR_TIERS) {
    const k = t.toLowerCase();
    out[`weapon_${k}`] = { id: `weapon_${k}`, name: `${TIER_NAME[t]} Weapon`, slot: 'WEAPON', tier: t, stats: { atk: WEAPON_ATK[t] } };
    out[`armor_${k}`] = { id: `armor_${k}`, name: `${TIER_NAME[t]} Armor`, slot: 'ARMOR', tier: t, stats: { hp: ARMOR_HP[t], def: ARMOR_DEF[t] } };
    for (const [kind, a] of Object.entries(ACCESSORY)) {
      out[`${kind}_${k}`] = {
        id: `${kind}_${k}`, name: `${TIER_NAME[t]} ${a.name}`, slot: 'ACCESSORY', tier: t,
        stats: { [a.stat]: ACC_STAT[t] }, utility: a.utility(t),
      };
    }
  }
  return out;
}

/** every Patch 1 item (4 tiers × weapon / armor / 5 accessory families) — drop sources come later */
export const EQUIPMENT: Record<string, EquipmentDefinition> = buildCatalog();

export const equipmentId = (slot: EquipmentSlot, tier: GearTier, accessory: AccessoryKind = 'ward') =>
  slot === 'WEAPON' ? `weapon_${tier.toLowerCase()}` : slot === 'ARMOR' ? `armor_${tier.toLowerCase()}` : `${accessory}_${tier.toLowerCase()}`;

/** the accessory a sensible player gives each class in simulations */
export const PROFILE_ACCESSORY: Record<HeroClass, AccessoryKind> = {
  tank: 'breaker', fighter: 'ward', assassin: 'ward', archer: 'breaker', mage: 'focus', healer: 'mending',
};

/**
 * Simulation power profiles (spec §13). Floor 10 design targets (AUTO / TACTICAL):
 * A fresh ≈ 0 / 0 · B early ≈ almost impossible · C mid 0–5 / 5–20 · D endgame-ready 10–25 / 40–65 ·
 * E developed 30–55 / 70–90 · F near-max 50–65 / 85–95.
 */
export const POWER_PROFILES: Record<string, PowerProfile> = {
  A: { id: 'A', label: 'Fresh', level: 1, gear: null, ranks: { skill: 1, skill2: 1, ult: 1 } },
  B: { id: 'B', label: 'Early', level: 5, gear: 'EARLY', ranks: { skill: 1, skill2: 2, ult: 1 } },
  C: { id: 'C', label: 'Mid', level: 7, gear: 'MID', ranks: { skill: 2, skill2: 3, ult: 2 } },
  D: { id: 'D', label: 'Endgame ready', level: 9, gear: 'GOOD', ranks: { skill: 3, skill2: 4, ult: 3 } },
  E: { id: 'E', label: 'Developed', level: 10, gear: { WEAPON: 'VERY_GOOD', ARMOR: 'GOOD', ACCESSORY: 'VERY_GOOD' }, ranks: { skill: 4, skill2: 5, ult: 4 } },
  F: { id: 'F', label: 'Near-max Patch 1', level: 10, gear: 'VERY_GOOD', ranks: { skill: 5, skill2: 5, ult: 5 } },
  // diagnostics: one system alone must not guarantee Floor 10
  LVL: { id: 'LVL', label: 'Level only (Lv10, no gear, rank 1)', level: 10, gear: null, ranks: { skill: 1, skill2: 1, ult: 1 } },
  GEAR: { id: 'GEAR', label: 'Gear only (Lv1, Very Good gear, rank 1)', level: 1, gear: 'VERY_GOOD', ranks: { skill: 1, skill2: 1, ult: 1 } },
};

/** Floor 10 design targets per profile (diagnostic ranges, never forced) */
export const FLOOR10_TARGETS: Record<string, { auto: [number, number]; tactical: [number, number] }> = {
  A: { auto: [0, 0], tactical: [0, 0] },
  B: { auto: [0, 2], tactical: [0, 5] },
  C: { auto: [0, 5], tactical: [5, 20] },
  D: { auto: [10, 25], tactical: [40, 65] },
  E: { auto: [30, 55], tactical: [70, 90] },
  F: { auto: [50, 65], tactical: [85, 95] },
};

/** the Patch 1 tower journey (recommendations, never entry locks) */
export const FLOOR_BANDS: Record<number, FloorBand> = {
  1: { levels: [1, 1], role: 'ONBOARDING', gear: null, skillRank: 1, simProfile: 'A', failureHints: ['basic combat', 'formation'] },
  2: { levels: [1, 1], role: 'ONBOARDING', gear: null, skillRank: 1, simProfile: 'A', failureHints: ['protect the backline from archers', 'Focus Target'] },
  3: { levels: [1, 2], role: 'ONBOARDING', gear: null, skillRank: 1, simProfile: 'A', failureHints: ['interrupt the Alpha Howl'] },
  4: { levels: [2, 3], role: 'EARLY', gear: null, skillRank: 1, simProfile: 'A', failureHints: ['spread out against Poison Cloud', 'HP carries between waves'] },
  5: { levels: [3, 4], role: 'EARLY', gear: 'EARLY', skillRank: 2, simProfile: 'B', failureHints: ['backline placement vs Shadow Panther'] },
  6: { levels: [4, 5], role: 'TRANSITION', gear: 'EARLY', skillRank: 2, simProfile: 'B', failureHints: ['Focus / interrupt the Goblin Shaman', 'start upgrading heroes'] },
  7: {
    levels: [5, 6], role: 'WALL', gear: 'MID', skillRank: 2, simProfile: 'C', simLevel: 6,
    failureHints: ['need levels', 'save an interrupt for Call of the Forest', 'need equipment'],
  },
  8: {
    levels: [6, 8], role: 'WALL', gear: 'MID', skillRank: 3, simProfile: 'C', simLevel: 8,
    failureHints: ['backline too fragile', 'defensive gear / bleed resistance', 'formation vs Mist Wraith dives'],
  },
  9: {
    levels: [8, 9], role: 'WALL', gear: 'GOOD', skillRank: 3, simProfile: 'D',
    failureHints: ['support enemies not controlled', 'Focus the Dark Shaman', 'interrupt Dark Heal / Nightmare', 'more burst'],
  },
  10: {
    levels: [9, 10], role: 'ENDGAME', gear: 'GOOD', skillRank: 4, simProfile: 'D', simLevel: 9,
    failureHints: ['interrupt Sacrifice', 'keep 100 Break for Forest Oblivion', 'hold ultimates for the late phases', 'team not developed enough'],
  },
};
