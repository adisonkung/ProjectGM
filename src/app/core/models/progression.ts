/**
 * Patch 1 progression model (spec: claude/patch1-progression-spec.md).
 * Power comes from several systems — hero level (+ breakthrough gates), equipment, skill ranks — resolved into
 * final Stats (raw numbers) + CombatModifiers (utility the combat engine reads). No system is a hidden multiplier:
 * every number lives in core/data/progression.ts.
 */
/** the three upgradable skill slots */
export type SkillKind = 'skill' | 'skill2' | 'ult';

export type EquipmentSlot = 'WEAPON' | 'ARMOR' | 'ACCESSORY';
/** Patch 1 gear tiers (EARLY → VERY_GOOD = best normal Patch 1 gear) */
export type GearTier = 'EARLY' | 'MID' | 'GOOD' | 'VERY_GOOD';

/** status ids whose duration equipment can shorten (bleed / poison / root / corruption …) */
export type ResistableStatus = 'bleed' | 'poison' | 'root' | 'corruption' | 'stun';

/** mechanical utility of an item (all optional, additive between items) */
export interface EquipmentUtility {
  /** duration reduction per status, 0–1 (0.3 = −30%) */
  statusResist?: Partial<Record<ResistableStatus, number>>;
  /** flat Break power added to every Break-capable skill */
  breakBonus?: number;
  /** skill cooldown reduction, 0–1 */
  cooldownReduction?: number;
  /** outgoing healing / shields +x (0.1 = +10%) */
  healingBonus?: number;
}

export interface EquipmentDefinition {
  id: string;
  name: string;
  slot: EquipmentSlot;
  tier: GearTier;
  /** raw stats as a fraction of the hero's level-adjusted stat (class-agnostic): 0.1 = +10% */
  stats: { hp?: number; atk?: number; def?: number };
  utility?: EquipmentUtility;
}

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
  /** per skill slot: skill rank power (damage / heal / shield) */
  skillPower: Record<SkillKind, number>;
  /** per skill slot: cooldown multiplier (rank × gear) */
  cooldown: Record<SkillKind, number>;
  /** per skill slot: flat extra Break power (rank + gear) */
  breakBonus: Record<SkillKind, number>;
  /** outgoing healing / shields multiplier (gear) */
  healing: number;
  /** status duration reduction on this hero, 0–1 */
  statusResist: Partial<Record<ResistableStatus, number>>;
}

/** the tower role of a floor in the Patch 1 journey */
export type FloorRole = 'ONBOARDING' | 'EARLY' | 'TRANSITION' | 'WALL' | 'ENDGAME';

/** expected (not enforced) power of a floor: recommended level band + development */
export interface FloorBand {
  levels: [number, number];
  role: FloorRole;
  /** expected gear / skill ranks (null = none needed) */
  gear: GearTier | null;
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
  /** one tier for every slot, or per slot (e.g. a Very Good weapon with Good armor) */
  gear: GearTier | Partial<Record<EquipmentSlot, GearTier>> | null;
  /** skill ranks of every hero (core skills = skill2 + ult for most kits) */
  ranks: SkillRanks;
}
