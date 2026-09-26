/**
 * Patch 1 progression model (spec: claude/patch1-progression-spec.md).
 * Power comes from several systems — hero level (+ breakthrough gates), equipment, skill ranks — resolved into
 * final Stats (raw numbers) + CombatModifiers (utility the combat engine reads). No system is a hidden multiplier:
 * every number lives in core/data/progression.ts.
 */
/** the three upgradable skill slots */
export type SkillKind = 'skill' | 'skill2' | 'ult';

import type { GearProfileId } from '../data/equipment';
export type { EquipmentSlot } from './equipment';

/** status ids whose duration equipment can shorten (poison / root; bleed is a damage reduction instead) */
export type ResistableStatus = 'bleed' | 'poison' | 'root' | 'corruption' | 'stun';

/** skill rank 1–5 (Patch 1) per skill slot */
export type SkillRanks = Record<SkillKind, number>;

export interface SkillRankEffect {
  /** skill damage / healing / shield multiplier */
  power: number;
  /** cooldown multiplier (skill 1 / 2) */
  cooldown: number;
  /** extra Break power for Break-capable skills */
  breakBonus: number;
}

/** breakthrough gate: level `from` → `from + 1` needs a breakthrough first (materials: next task) */
export interface BreakthroughGate {
  from: number;
  kind: 'MILESTONE' | 'MAJOR';
}

/** what the combat engine reads from a hero's progression (besides its final Stats) */
export interface CombatModifiers {
  /** per skill slot: skill rank power × gear skill damage (skills / ults) — basic attacks stay 1 */
  skillPower: Record<SkillKind, number>;
  /** per skill slot: cooldown multiplier (rank × gear CDR, gear capped at 15 %) */
  cooldown: Record<SkillKind, number>;
  /** per skill slot: flat extra Break power (rank + gear, gear capped at +20) */
  breakBonus: Record<SkillKind, number>;
  /** outgoing healing multiplier (skill rank is separate) · outgoing shields multiplier */
  healing: number;
  shieldPower: number;
  /** incoming healing multiplier */
  healingReceived: number;
  /** crit chance (base 10 % + gear) · crit damage multiplier (base 1.5 + gear) */
  critChance: number;
  critMultiplier: number;
  /** incoming damage: every hit × (1 − damageReduction) · bleed ticks × (1 − bleedReduction) · dive skills × (1 − diveReduction) */
  damageReduction: number;
  bleedReduction: number;
  diveReduction: number;
  /** outgoing damage bonuses: vs targets below 30 % HP · vs targets back from untargetable (3 s) */
  execution: number;
  mistHunter: number;
  /** status duration reduction on this hero, 0–1 */
  statusResist: Partial<Record<ResistableStatus, number>>;
}

/** the tower role of a floor in the Patch 1 journey */
export type FloorRole = 'ONBOARDING' | 'EARLY' | 'TRANSITION' | 'WALL' | 'ENDGAME';

/** expected (not enforced) power of a floor: recommended level band + development */
export interface FloorBand {
  levels: [number, number];
  role: FloorRole;
  /** expected gear profile / skill ranks (null = none needed) */
  gear: GearProfileId | null;
  skillRank: number;
  /** what the player should learn / improve after failing here (shown later on the result screen) */
  failureHints?: string[];
  /** simulation profile the balance tool uses for "rec" (+ the level to test at, default: profile level clamped to the band) */
  simProfile: string;
  simLevel?: number;
}

/** a named power profile for simulations (and future "recommended power" UI) */
export interface PowerProfile {
  id: string;
  label: string;
  level: number;
  /** equipment profile (core/data/equipment.ts GEAR_PROFILES) — built per class */
  gear: GearProfileId | null;
  /** skill ranks of every hero (core skills = skill2 + ult for most kits) */
  ranks: SkillRanks;
}
