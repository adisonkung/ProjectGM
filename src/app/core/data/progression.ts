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
import { BREAKTHROUGHS } from './economy';
import { BreakthroughGate, FloorBand, PowerProfile, SkillRankEffect } from '../models/progression';

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

/**
 * Simulation power profiles (spec §13). Floor 10 design targets (AUTO / TACTICAL):
 * A fresh ≈ 0 / 0 · B early ≈ almost impossible · C mid 0–5 / 5–20 · D endgame-ready 10–25 / 40–65 ·
 * E developed 30–55 / 70–90 · F near-max 50–65 / 85–95.
 */
export const POWER_PROFILES: Record<string, PowerProfile> = {
  A: { id: 'A', label: 'Fresh', level: 1, gear: null, ranks: { skill: 1, skill2: 1, ult: 1 } },
  B: { id: 'B', label: 'Early', level: 5, gear: 'BASIC', ranks: { skill: 1, skill2: 2, ult: 1 } },
  C: { id: 'C', label: 'First wall (basic gear)', level: 7, gear: 'BASIC', ranks: { skill: 2, skill2: 2, ult: 1 } },
  D: { id: 'D', label: 'Mid', level: 8, gear: 'MID', ranks: { skill: 2, skill2: 3, ult: 2 } },
  E: { id: 'E', label: 'Endgame ready', level: 9, gear: 'GOOD', ranks: { skill: 3, skill2: 4, ult: 3 } },
  F: { id: 'F', label: 'Developed', level: 10, gear: 'VERY_GOOD', ranks: { skill: 4, skill2: 5, ult: 4 } },
  G: { id: 'G', label: 'Near-max Patch 1', level: 10, gear: 'NEAR_MAX', ranks: { skill: 5, skill2: 5, ult: 5 } },
  // diagnostics: one system alone must not guarantee late floors
  LVL: { id: 'LVL', label: 'Level only (no gear, rank 1)', level: 10, gear: null, ranks: { skill: 1, skill2: 1, ult: 1 } },
  GEAR: { id: 'GEAR', label: 'Gear only (Lv1, Very Good gear, rank 1)', level: 1, gear: 'VERY_GOOD', ranks: { skill: 1, skill2: 1, ult: 1 } },
  // equipment-only ladder (Equipment spec §56): Lv10, skill rank 1, gear profile 0–5
  EQ0: { id: 'EQ0', label: 'Lv10 SR1 · no gear', level: 10, gear: null, ranks: { skill: 1, skill2: 1, ult: 1 } },
  EQ1: { id: 'EQ1', label: 'Lv10 SR1 · Basic gear', level: 10, gear: 'BASIC', ranks: { skill: 1, skill2: 1, ult: 1 } },
  EQ2: { id: 'EQ2', label: 'Lv10 SR1 · Mid gear', level: 10, gear: 'MID', ranks: { skill: 1, skill2: 1, ult: 1 } },
  EQ3: { id: 'EQ3', label: 'Lv10 SR1 · Good gear', level: 10, gear: 'GOOD', ranks: { skill: 1, skill2: 1, ult: 1 } },
  EQ4: { id: 'EQ4', label: 'Lv10 SR1 · Very Good gear', level: 10, gear: 'VERY_GOOD', ranks: { skill: 1, skill2: 1, ult: 1 } },
  EQ5: { id: 'EQ5', label: 'Lv10 SR1 · Near-max gear', level: 10, gear: 'NEAR_MAX', ranks: { skill: 1, skill2: 1, ult: 1 } },
};

/** Floor 10 design targets per profile (diagnostic ranges, never forced) — rebalance spec §33 */
export const FLOOR10_TARGETS: Record<string, { auto: [number, number]; tactical: [number, number] }> = {
  A: { auto: [0, 0], tactical: [0, 0] },
  B: { auto: [0, 0], tactical: [0, 2] },
  C: { auto: [0, 2], tactical: [0, 5] },
  D: { auto: [0, 5], tactical: [0, 15] },
  E: { auto: [5, 15], tactical: [25, 45] },
  F: { auto: [15, 35], tactical: [50, 75] },
  G: { auto: [35, 55], tactical: [75, 90] },
  LVL: { auto: [0, 0], tactical: [0, 5] },
};

/** the Patch 1 tower journey (recommendations, never entry locks) */
export const FLOOR_BANDS: Record<number, FloorBand> = {
  1: { levels: [1, 1], role: 'ONBOARDING', gear: null, skillRank: 1, simProfile: 'A', failureHints: ['basic combat', 'formation'] },
  2: { levels: [1, 1], role: 'ONBOARDING', gear: null, skillRank: 1, simProfile: 'A', failureHints: ['protect the backline from archers', 'Focus Target'] },
  3: { levels: [1, 2], role: 'ONBOARDING', gear: null, skillRank: 1, simProfile: 'A', failureHints: ['interrupt the Alpha Howl'] },
  4: { levels: [2, 3], role: 'EARLY', gear: null, skillRank: 1, simProfile: 'A', failureHints: ['spread out against Poison Cloud', 'HP carries between waves'] },
  5: { levels: [4, 5], role: 'EARLY', gear: 'BASIC', skillRank: 2, simProfile: 'B', simLevel: 4, failureHints: ['backline placement vs Shadow Panther'] },
  6: { levels: [5, 6], role: 'TRANSITION', gear: 'BASIC', skillRank: 2, simProfile: 'B', simLevel: 5, failureHints: ['Focus / interrupt the Goblin Shaman', 'start upgrading heroes'] },
  7: {
    levels: [6, 8], role: 'WALL', gear: 'BASIC', skillRank: 2, simProfile: 'C', simLevel: 7,
    failureHints: ['need levels', 'save an interrupt for Call of the Forest', 'need equipment'],
  },
  8: {
    levels: [7, 8], role: 'WALL', gear: 'MID', skillRank: 3, simProfile: 'D', simLevel: 8,
    failureHints: ['backline too fragile', 'defensive gear / bleed resistance', 'formation vs Mist Wraith dives'],
  },
  9: {
    levels: [8, 10], role: 'WALL', gear: 'GOOD', skillRank: 3, simProfile: 'E', simLevel: 9,
    failureHints: ['support enemies not controlled', 'Focus the Dark Shaman', 'interrupt Dark Heal / Nightmare', 'more burst'],
  },
  10: {
    levels: [9, 10], role: 'ENDGAME', gear: 'GOOD', skillRank: 4, simProfile: 'E', simLevel: 9,
    failureHints: ['interrupt Sacrifice', 'keep 100 Break for Forest Oblivion', 'hold ultimates for the late phases', 'team not developed enough'],
  },
};
