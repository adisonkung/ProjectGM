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

/** breakthrough gate: level `from` → `from + 1` needs a breakthrough first (materials: next task) */
export interface BreakthroughGate {
  from: number;
  kind: 'MILESTONE' | 'MAJOR';
}

/** what the combat engine reads from a hero's progression (besides its final Stats) */
export interface CombatModifiers {
  /** per skill slot: gear skill damage (skills / ults) — basic attacks stay 1. Skill ranks are baked into the unit's kit */
  skillPower: Record<SkillKind, number>;
  /** per skill slot: gear cooldown multiplier (gear CDR capped at 15 %; rank CDR is in the ranked skill) */
  cooldown: Record<SkillKind, number>;
  /** per skill slot: gear Break bonus (capped at +20; rank Break is in the ranked skill, final capped < 100) */
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
  /** ultimate gauge at battle start (star perks 4★+), 0–100 */
  startGauge?: number;
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
  /** skill profile S0–S5 (core/data/skill-ranks.ts): ranks per hero by slot priority — overrides `ranks` */
  skillProfile?: string;
}
