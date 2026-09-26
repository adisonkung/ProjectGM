/**
 * Patch 1 Equipment model (spec: claude/patch1-equipment-spec.md). Pure data types — every number lives in
 * core/data/equipment.ts, every rule in core/rules/equipment.ts. Combat never reads items: they are resolved into
 * final Stats + CombatModifiers before a battle.
 */
import { HeroClass } from './hero';

export type EquipmentSlot = 'WEAPON' | 'ARMOR' | 'ACCESSORY';
export type Rarity = 'COMMON' | 'UNCOMMON' | 'RARE' | 'ELITE' | 'EPIC';
/** weapon families (armor / accessories are usable by every role) */
export type WeaponGroup = 'HEAVY' | 'LIGHT' | 'BOW' | 'CATALYST';

/**
 * Every stat an item line can carry. Fractions (0.05 = +5 %) except `breakPower` (flat Break) and `atkFlat`.
 *   atkPct / hpPct / defPct       raw stats (applied after level growth, once)
 *   critChance / critDamage       + base crit 10 % / ×1.5
 *   skillDamage                   skills + ultimates (not basic attacks)
 *   healingPower                  outgoing heals only · shieldPower: outgoing shields only
 *   healingReceived               incoming heals
 *   cooldownReduction             skill cooldowns (capped 15 %)
 *   attackSpeed / moveSpeed       small (attack speed capped 10 %)
 *   damageReduction               every incoming hit
 *   bleedReduction                bleed damage taken · poisonReduction / rootReduction: status duration
 *   diveReduction                 damage from teleport / dive skills (Shadow Leap, Mist Strike)
 *   execution                     damage vs enemies below 30 % HP · mistHunter: vs targets back from untargetable (3 s)
 */
export type EquipStat =
  | 'atkPct' | 'atkFlat' | 'hpPct' | 'defPct'
  | 'critChance' | 'critDamage' | 'skillDamage'
  | 'healingPower' | 'shieldPower' | 'healingReceived'
  | 'cooldownReduction' | 'attackSpeed' | 'moveSpeed'
  | 'breakPower' | 'damageReduction'
  | 'bleedReduction' | 'poisonReduction' | 'rootReduction' | 'diveReduction'
  | 'execution' | 'mistHunter';

export interface StatLine {
  stat: EquipStat;
  value: number;
}

/** an item base: what can drop / be crafted (the instance rolls its lines from these pools) */
export interface EquipmentDefinition {
  id: string;
  name: string;
  slot: EquipmentSlot;
  /** weapons only: who can wield it */
  weaponGroup?: WeaponGroup;
  /** main stat choices (one is rolled / chosen when crafting) */
  mainStats: EquipStat[];
  /** secondary stat pool */
  secondaryPool: EquipStat[];
  /** affixes this base can roll (Rare+) */
  affixPool: string[];
}

export interface EquipmentAffixDefinition {
  id: string;
  name: string;
  /** what it does (one stat line, or a mechanic stat such as bleedReduction) */
  effect: StatLine;
  validSlots: EquipmentSlot[];
  /** roles that make sense (drops / sim builds prefer these; never an equip restriction) */
  validRoles?: HeroClass[];
  /** ADD = sums with other sources up to the stat cap */
  stackRule: 'ADD';
  description: string;
}

/** one owned item (all rolled values are stored at +0; upgrades scale the main stat) */
export interface EquipmentInstance {
  instanceId: number;
  definitionId: string;
  rarity: Rarity;
  upgradeLevel: number;
  main: StatLine;
  secondaries: StatLine[];
  affix?: string;
  locked: boolean;
  /** uid of the hero wearing it (null = in the bag) */
  equippedHeroId: number | null;
  /** Enhancement Ore invested (75 % refunded on dismantle) */
  oreInvested: number;
}

/** future loadouts (Boss-specific builds): slot → instance id */
export type EquipmentLoadout = Partial<Record<EquipmentSlot, number>>;

/** a drop table: chance of an item per clear + rarity weights */
export interface EquipmentDropTable {
  itemChance: number;
  rarityWeights: Partial<Record<Rarity, number>>;
}

/** deterministic crafting: fragments of the rarity (+ gold) → an item of that rarity for a chosen base + main stat */
export interface EquipmentCraftRecipe {
  rarity: Rarity;
  fragmentId: string;
  fragments: number;
  gold: number;
}

/** aggregated gear effect of a hero (after caps) */
export type GearTotals = Record<EquipStat, number>;

/** which slot a Hunt's drops / target pool favours */
export type HuntTarget = EquipmentSlot | 'ANY';
