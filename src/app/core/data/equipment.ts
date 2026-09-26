/**
 * Patch 1 Equipment configuration (spec: claude/patch1-equipment-spec.md). Every number is tuning data:
 * stat values per rarity, affixes, caps, upgrade curve / costs, dismantle, crafting, Hunt drop tables and the
 * simulation gear profiles. Rules: core/rules/equipment.ts.
 */
import { HeroClass } from '../models/hero';
import {
  EquipmentAffixDefinition, EquipmentCraftRecipe, EquipmentDefinition, EquipmentSlot, EquipStat, Rarity, WeaponGroup,
} from '../models/equipment';

export const SLOTS: EquipmentSlot[] = ['WEAPON', 'ARMOR', 'ACCESSORY'];
export const RARITIES: Rarity[] = ['COMMON', 'UNCOMMON', 'RARE', 'ELITE', 'EPIC'];
export const RARITY_NAME: Record<Rarity, string> = { COMMON: 'Common', UNCOMMON: 'Uncommon', RARE: 'Rare', ELITE: 'Elite', EPIC: 'Epic' };
const R = (c: number, u: number, r: number, e: number, ep: number): Record<Rarity, number> => ({ COMMON: c, UNCOMMON: u, RARE: r, ELITE: e, EPIC: ep });

/** who wields which weapon family (armor / accessories: everyone) */
export const WEAPON_GROUP_OF: Record<HeroClass, WeaponGroup> = {
  tank: 'HEAVY', fighter: 'HEAVY', assassin: 'LIGHT', archer: 'BOW', mage: 'CATALYST', healer: 'CATALYST',
};

export const STAT_LABEL: Record<EquipStat, string> = {
  atkPct: 'ATK', atkFlat: 'ATK', hpPct: 'HP', defPct: 'DEF', critChance: 'Crit', critDamage: 'Crit DMG', skillDamage: 'Skill DMG',
  healingPower: 'Healing Power', shieldPower: 'Shield Power', healingReceived: 'Healing Received', cooldownReduction: 'Cooldown',
  attackSpeed: 'Attack Speed', moveSpeed: 'Move Speed', breakPower: 'Break', damageReduction: 'Damage Reduction',
  bleedReduction: 'Bleed DMG taken', poisonReduction: 'Poison duration', rootReduction: 'Root duration', diveReduction: 'Dive DMG taken',
  execution: 'DMG vs < 30 % HP', mistHunter: 'DMG vs revealed',
};
/** flat stats (everything else is a fraction) */
export const FLAT_STATS: EquipStat[] = ['breakPower', 'atkFlat'];

// ------------------------------------------------------------------ main stats (value at +0 per rarity)

/**
 * Main stat at +0. Upgrades: × (1 + UPGRADE_STEP × level) → +10 = ×1.40 (spec: +35–45 %).
 * Weapon ATK at +10: Common 4.9 % · Uncommon 7 % · Rare 9.1 % · Elite 11.2 % · Epic 14 % (spec 4–6 / 6–8 / 8–11 / 11–14 / 14–17).
 */
export const MAIN_STAT_VALUES: Partial<Record<EquipStat, Record<Rarity, number>>> = {
  atkPct: R(0.035, 0.05, 0.065, 0.08, 0.1),
  healingPower: R(0.05, 0.07, 0.09, 0.11, 0.13),
  breakPower: R(3, 4, 5, 6, 8),
  hpPct: R(0.04, 0.055, 0.07, 0.085, 0.105),
  defPct: R(0.05, 0.07, 0.09, 0.11, 0.13),
  damageReduction: R(0.015, 0.02, 0.025, 0.03, 0.035),
  cooldownReduction: R(0.02, 0.025, 0.03, 0.04, 0.05),
  critChance: R(0.02, 0.03, 0.04, 0.05, 0.06),
  healingReceived: R(0.04, 0.05, 0.06, 0.08, 0.1),
};
/** accessory raw-stat mains are smaller (accessories are the utility slot) */
export const ACCESSORY_MAIN_VALUES: Partial<Record<EquipStat, Record<Rarity, number>>> = {
  hpPct: R(0.02, 0.025, 0.03, 0.04, 0.05),
  atkPct: R(0.015, 0.02, 0.025, 0.03, 0.04),
  breakPower: R(2, 3, 4, 5, 6),
};

// ------------------------------------------------------------------ secondary stats (fixed, never upgraded)

export const SECONDARY_VALUES: Partial<Record<EquipStat, Record<Rarity, number>>> = {
  hpPct: R(0, 0.02, 0.025, 0.03, 0.035),
  atkPct: R(0, 0.015, 0.02, 0.025, 0.03),
  defPct: R(0, 0.025, 0.03, 0.035, 0.04),
  critChance: R(0, 0.015, 0.02, 0.025, 0.03),
  critDamage: R(0, 0.05, 0.07, 0.09, 0.1),
  skillDamage: R(0, 0.03, 0.04, 0.05, 0.06),
  healingPower: R(0, 0.03, 0.04, 0.05, 0.06),
  healingReceived: R(0, 0.03, 0.04, 0.05, 0.06),
  cooldownReduction: R(0, 0.01, 0.015, 0.02, 0.025),
  moveSpeed: R(0, 0.03, 0.04, 0.05, 0.06),
  breakPower: R(0, 2, 3, 3, 4),
  attackSpeed: R(0, 0.015, 0.02, 0.025, 0.03),
};

/** rarity → secondary lines [min, max] · tactical affix chance · upgrade cap · affix strength */
export const RARITY_RULES: Record<Rarity, { secondaries: [number, number]; affixChance: number; upgradeCap: number; affixScale: number }> = {
  COMMON: { secondaries: [0, 0], affixChance: 0, upgradeCap: 6, affixScale: 1 },
  UNCOMMON: { secondaries: [1, 1], affixChance: 0, upgradeCap: 8, affixScale: 1 },
  RARE: { secondaries: [1, 1], affixChance: 0.35, upgradeCap: 10, affixScale: 1 },
  ELITE: { secondaries: [1, 2], affixChance: 1, upgradeCap: 10, affixScale: 1 },
  EPIC: { secondaries: [2, 2], affixChance: 1, upgradeCap: 10, affixScale: 1.25 },
};

// ------------------------------------------------------------------ tactical affixes (help, never disable)

const affix = (id: string, name: string, stat: EquipStat, value: number, validSlots: EquipmentSlot[], description: string, validRoles?: HeroClass[]): EquipmentAffixDefinition =>
  ({ id, name, effect: { stat, value }, validSlots, validRoles, stackRule: 'ADD', description });

export const AFFIXES: Record<string, EquipmentAffixDefinition> = Object.fromEntries([
  affix('bleed_guard', 'Bleed Guard', 'bleedReduction', 0.2, ['ARMOR', 'ACCESSORY'], 'Bleed damage taken −20 %'),
  affix('poison_ward', 'Poison Ward', 'poisonReduction', 0.2, ['ARMOR', 'ACCESSORY'], 'Poison duration −20 %'),
  affix('rootbreaker', 'Rootbreaker', 'rootReduction', 0.2, ['ARMOR', 'ACCESSORY'], 'Root duration −20 %'),
  affix('mist_hunter', 'Mist Hunter', 'mistHunter', 0.1, ['WEAPON'], '+10 % damage to targets back from untargetable (3 s)', ['assassin', 'archer', 'fighter']),
  affix('guardian', 'Guardian', 'shieldPower', 0.1, ['ARMOR', 'ACCESSORY'], 'Shields you cast +10 %', ['tank', 'healer']),
  affix('medic', 'Medic', 'healingReceived', 0.12, ['ARMOR', 'ACCESSORY'], 'Healing received +12 %'),
  affix('breaker', 'Breaker', 'breakPower', 10, ['WEAPON', 'ACCESSORY'], 'Interrupt / Break power +10', ['tank', 'archer']),
  affix('execution', 'Execution', 'execution', 0.08, ['WEAPON'], '+8 % damage to enemies below 30 % HP', ['assassin', 'fighter', 'archer', 'mage']),
  affix('backline_guard', 'Backline Guard', 'diveReduction', 0.15, ['ARMOR', 'ACCESSORY'], 'Damage from teleport / dive attacks −15 %', ['archer', 'mage', 'healer']),
  affix('focus', 'Focus', 'cooldownReduction', 0.04, ['WEAPON', 'ACCESSORY'], 'Skill cooldowns −4 %'),
  affix('bulwark', 'Bulwark', 'damageReduction', 0.04, ['ARMOR'], 'All damage taken −4 %', ['tank', 'fighter']),
  affix('keen_eye', 'Keen Eye', 'critChance', 0.04, ['WEAPON', 'ACCESSORY'], 'Crit chance +4 %', ['assassin', 'archer', 'fighter']),
  affix('mender', 'Mender', 'healingPower', 0.1, ['WEAPON', 'ACCESSORY'], 'Healing done +10 %', ['healer']),
].map(a => [a.id, a]));

/**
 * Totals caps (every source on one hero summed, then capped). CDR 15 %, crit +20 %, attack speed +10 % (spec §12–14),
 * mechanic reductions 40 % / dive 30 %, healing received 25 %, Break +20 (Forest Oblivion still needs two breakers).
 */
export const STAT_CAPS: Partial<Record<EquipStat, number>> = {
  critChance: 0.2, critDamage: 0.25, cooldownReduction: 0.15, attackSpeed: 0.1, moveSpeed: 0.15, skillDamage: 0.2,
  healingPower: 0.3, shieldPower: 0.25, healingReceived: 0.25, breakPower: 20, damageReduction: 0.12,
  bleedReduction: 0.4, poisonReduction: 0.4, rootReduction: 0.4, diveReduction: 0.3, execution: 0.16, mistHunter: 0.2,
};

// ------------------------------------------------------------------ item bases

const WEAPON_SECONDARIES: Record<WeaponGroup, EquipStat[]> = {
  HEAVY: ['hpPct', 'atkPct', 'critChance', 'critDamage', 'skillDamage', 'defPct', 'attackSpeed'],
  LIGHT: ['critChance', 'critDamage', 'atkPct', 'moveSpeed', 'attackSpeed', 'skillDamage'],
  BOW: ['critChance', 'critDamage', 'atkPct', 'skillDamage', 'cooldownReduction', 'attackSpeed'],
  CATALYST: ['skillDamage', 'healingPower', 'cooldownReduction', 'hpPct', 'atkPct', 'critChance'],
};

export const EQUIPMENT_DEFS: Record<string, EquipmentDefinition> = Object.fromEntries(([
  { id: 'heavy_blade', name: 'Heavy Blade', slot: 'WEAPON', weaponGroup: 'HEAVY', mainStats: ['atkPct', 'breakPower'], secondaryPool: WEAPON_SECONDARIES.HEAVY, affixPool: ['breaker', 'execution', 'mist_hunter', 'keen_eye', 'focus'] },
  { id: 'twin_daggers', name: 'Twin Daggers', slot: 'WEAPON', weaponGroup: 'LIGHT', mainStats: ['atkPct'], secondaryPool: WEAPON_SECONDARIES.LIGHT, affixPool: ['execution', 'mist_hunter', 'keen_eye', 'focus'] },
  { id: 'longbow', name: 'Longbow', slot: 'WEAPON', weaponGroup: 'BOW', mainStats: ['atkPct', 'breakPower'], secondaryPool: WEAPON_SECONDARIES.BOW, affixPool: ['breaker', 'execution', 'mist_hunter', 'keen_eye', 'focus'] },
  { id: 'focus_staff', name: 'Focus Staff', slot: 'WEAPON', weaponGroup: 'CATALYST', mainStats: ['atkPct', 'healingPower'], secondaryPool: WEAPON_SECONDARIES.CATALYST, affixPool: ['mender', 'focus', 'execution', 'breaker'] },
  { id: 'guard_armor', name: 'Guard Armor', slot: 'ARMOR', mainStats: ['hpPct', 'defPct', 'damageReduction'], secondaryPool: ['hpPct', 'defPct', 'healingReceived', 'moveSpeed', 'atkPct'], affixPool: ['bleed_guard', 'poison_ward', 'rootbreaker', 'guardian', 'medic', 'bulwark', 'backline_guard'] },
  { id: 'trinket', name: 'Trinket', slot: 'ACCESSORY', mainStats: ['cooldownReduction', 'critChance', 'healingReceived', 'breakPower', 'hpPct', 'atkPct'], secondaryPool: ['hpPct', 'atkPct', 'critChance', 'cooldownReduction', 'healingReceived', 'moveSpeed', 'breakPower'], affixPool: ['rootbreaker', 'poison_ward', 'bleed_guard', 'focus', 'breaker', 'keen_eye', 'medic', 'mender', 'guardian', 'backline_guard'] },
] as EquipmentDefinition[]).map(d => [d.id, d]));

export const WEAPON_DEF_OF: Record<WeaponGroup, string> = { HEAVY: 'heavy_blade', LIGHT: 'twin_daggers', BOW: 'longbow', CATALYST: 'focus_staff' };

// ------------------------------------------------------------------ upgrades / dismantle / sell / craft

/** main stat multiplier per upgrade level: +10 = ×1.40 */
export const UPGRADE_STEP = 0.04;
/** relative ore cost of reaching +1 … +10 (spec §73) */
export const UPGRADE_COST_CURVE = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6.5, 8];
/** ore cost of the +1 step per rarity (later steps × curve) · gold = ore × GOLD_PER_ORE */
export const UPGRADE_ORE_BASE: Record<Rarity, number> = R(4, 6, 10, 15, 22);
export const GOLD_PER_ORE = 8;

/** dismantle: ore + fragments + 75 % of the ore invested in upgrades (gold is not refunded) */
export const DISMANTLE_ORE: Record<Rarity, number> = R(3, 5, 8, 12, 18);
export const DISMANTLE_REFUND = 0.75;
export const DISMANTLE_FRAGMENTS: Record<Rarity, { itemId: string; count: number }> = {
  COMMON: { itemId: 'equip_frag_basic', count: 1 },
  UNCOMMON: { itemId: 'equip_frag_basic', count: 3 },
  RARE: { itemId: 'equip_frag_rare', count: 3 },
  ELITE: { itemId: 'equip_frag_elite', count: 3 },
  EPIC: { itemId: 'equip_frag_epic', count: 3 },
};
export const SELL_GOLD: Record<Rarity, number> = R(20, 40, 80, 150, 250);

/** targeted crafting: choose the base (slot / weapon group) + main stat — secondaries / affix still roll */
export const CRAFT_RECIPES: Partial<Record<Rarity, EquipmentCraftRecipe>> = {
  UNCOMMON: { rarity: 'UNCOMMON', fragmentId: 'equip_frag_basic', fragments: 25, gold: 300 },
  RARE: { rarity: 'RARE', fragmentId: 'equip_frag_rare', fragments: 40, gold: 800 },
  ELITE: { rarity: 'ELITE', fragmentId: 'equip_frag_elite', fragments: 70, gold: 2000 },
  EPIC: { rarity: 'EPIC', fragmentId: 'equip_frag_epic', fragments: 110, gold: 4000 },
};

/** the chosen target slot gets this share of Hunt drops (the rest is spread evenly) */
export const HUNT_TARGET_SHARE = 0.6;

// ------------------------------------------------------------------ simulation gear profiles (spec §51)

export type GearProfileId = 'BASIC' | 'MID' | 'GOOD' | 'VERY_GOOD' | 'NEAR_MAX';

/** per slot: rarity + upgrade level + whether the build found its wanted affix */
export interface ProfilePiece { rarity: Rarity; level: number; affix: boolean }
export const GEAR_PROFILES: Record<GearProfileId, { label: string; pieces: Record<EquipmentSlot, ProfilePiece> }> = {
  BASIC: { label: 'Basic (Uncommon +2 weapon, Common +4 armor, Common +2 accessory)', pieces: { WEAPON: { rarity: 'UNCOMMON', level: 2, affix: false }, ARMOR: { rarity: 'COMMON', level: 4, affix: false }, ACCESSORY: { rarity: 'COMMON', level: 2, affix: false } } },
  MID: { label: 'Mid (Rare +5, armor affix)', pieces: { WEAPON: { rarity: 'RARE', level: 5, affix: false }, ARMOR: { rarity: 'RARE', level: 5, affix: true }, ACCESSORY: { rarity: 'RARE', level: 5, affix: false } } },
  GOOD: { label: 'Good (Elite +5 weapon / armor, Rare +6 accessory, affixes)', pieces: { WEAPON: { rarity: 'ELITE', level: 5, affix: true }, ARMOR: { rarity: 'ELITE', level: 5, affix: true }, ACCESSORY: { rarity: 'RARE', level: 6, affix: true } } },
  VERY_GOOD: { label: 'Very Good (Epic +4 weapon, Elite +8 armor / accessory)', pieces: { WEAPON: { rarity: 'EPIC', level: 4, affix: true }, ARMOR: { rarity: 'ELITE', level: 8, affix: true }, ACCESSORY: { rarity: 'ELITE', level: 8, affix: true } } },
  NEAR_MAX: { label: 'Near max (Epic +10)', pieces: { WEAPON: { rarity: 'EPIC', level: 10, affix: true }, ARMOR: { rarity: 'EPIC', level: 10, affix: true }, ACCESSORY: { rarity: 'EPIC', level: 10, affix: true } } },
};

/** what a sensible player builds per class: main stat, secondaries (in order) and affix per slot */
export interface ClassBuildPiece { main: EquipStat; secondaries: EquipStat[]; affix: string }
export const CLASS_BUILDS: Record<HeroClass, Record<EquipmentSlot, ClassBuildPiece>> = {
  tank: {
    WEAPON: { main: 'atkPct', secondaries: ['hpPct', 'defPct'], affix: 'breaker' },
    ARMOR: { main: 'hpPct', secondaries: ['defPct', 'healingReceived'], affix: 'bleed_guard' },
    ACCESSORY: { main: 'cooldownReduction', secondaries: ['hpPct', 'healingReceived'], affix: 'guardian' },
  },
  fighter: {
    WEAPON: { main: 'atkPct', secondaries: ['critChance', 'hpPct'], affix: 'execution' },
    ARMOR: { main: 'hpPct', secondaries: ['defPct', 'atkPct'], affix: 'bleed_guard' },
    ACCESSORY: { main: 'critChance', secondaries: ['atkPct', 'hpPct'], affix: 'medic' },
  },
  assassin: {
    WEAPON: { main: 'atkPct', secondaries: ['critChance', 'critDamage'], affix: 'execution' },
    ARMOR: { main: 'hpPct', secondaries: ['atkPct', 'moveSpeed'], affix: 'bleed_guard' },
    ACCESSORY: { main: 'critChance', secondaries: ['atkPct', 'critChance'], affix: 'keen_eye' },
  },
  archer: {
    WEAPON: { main: 'atkPct', secondaries: ['critChance', 'critDamage'], affix: 'breaker' },
    ARMOR: { main: 'hpPct', secondaries: ['defPct', 'atkPct'], affix: 'backline_guard' },
    ACCESSORY: { main: 'cooldownReduction', secondaries: ['critChance', 'atkPct'], affix: 'rootbreaker' },
  },
  mage: {
    WEAPON: { main: 'atkPct', secondaries: ['skillDamage', 'cooldownReduction'], affix: 'execution' },
    ARMOR: { main: 'hpPct', secondaries: ['defPct', 'atkPct'], affix: 'backline_guard' },
    ACCESSORY: { main: 'cooldownReduction', secondaries: ['atkPct', 'hpPct'], affix: 'rootbreaker' },
  },
  healer: {
    WEAPON: { main: 'healingPower', secondaries: ['cooldownReduction', 'hpPct'], affix: 'mender' },
    ARMOR: { main: 'hpPct', secondaries: ['defPct', 'healingReceived'], affix: 'backline_guard' },
    ACCESSORY: { main: 'cooldownReduction', secondaries: ['hpPct', 'healingReceived'], affix: 'focus' },
  },
};
