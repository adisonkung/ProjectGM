/**
 * Patch 1 economy model (spec: claude/patch1-hero-level-spec.md): hero EXP / levels, breakthroughs, items,
 * generic reward bundles and data-driven farm dungeons (Training Ground, Ascension Trial — later Equipment / Skill).
 * All numbers live in core/data/economy.ts.
 */
import { StageDef } from './stage';

/** one step of the level curve */
export interface HeroLevelDefinition {
  level: number;
  /** EXP needed for level → level + 1 (0 at the cap) */
  expToNextLevel: number;
  /** level → level + 1 is gated by a breakthrough */
  breakthroughRequired: boolean;
  breakthroughDefinitionId?: string;
}

/** things a breakthrough unlocks besides the next level (flags for systems that arrive later) */
export type UnlockFlag = 'SKILL_RANK_CAP_3' | 'GEAR_TIER_UP' | 'PATCH1_TALENT_SLOT';

export interface ItemStack {
  itemId: string;
  count: number;
}

export interface BreakthroughDefinition {
  id: string;
  /** 1, 2, 3 — the hero's breakthroughTier after it */
  tier: number;
  fromLevel: number;
  toLevel: number;
  requiredItems: ItemStack[];
  unlockFlags: UnlockFlag[];
}

export type ItemKind = 'EXP_POTION' | 'BREAKTHROUGH_STONE' | 'BREAKTHROUGH_FRAGMENT' | 'MATERIAL' | 'EQUIPMENT_FRAGMENT' | 'SKILL_TOME' | 'SKILL_TOME_FRAGMENT' | 'HERO_MEMORY';

export interface ItemDefinition {
  id: string;
  name: string;
  kind: ItemKind;
  /** EXP potions: EXP granted per item */
  exp?: number;
  /** fragments: `fragmentsPerItem` of them turn into one `combinesInto` automatically */
  combinesInto?: string;
  fragmentsPerItem?: number;
  /** stones: the fragment used when a reward would be a fraction of this stone */
  fragmentId?: string;
}

/** a generic reward (every source uses it: tower, training, ascension, later equipment / skill dungeons) */
export interface RewardBundle {
  /** EXP for every participating hero (battle-clear EXP, never per kill) */
  heroExp?: number;
  gold?: number;
  items?: ItemStack[];
  /** independent extra drops: `chance` to add `items` */
  bonusDrops?: { chance: number; items: ItemStack[] }[];
}

export type FarmDungeonType = 'TRAINING' | 'ASCENSION' | 'EQUIPMENT' | 'SKILL' | 'MATERIAL';

/** how hero deaths are treated after the run — Patch 1: nothing lasts (injury system removed), kept for future rules */
export type DeathRule = 'EVENT_KO';

export interface FarmDungeonDefinition {
  id: string;
  type: FarmDungeonType;
  name: string;
  /** highest tower floor that must be cleared (0 = available from the start) */
  unlockFloor: number;
  recommendedLevel: [number, number];
  baseRewards: RewardBundle;
  /** one-time bonus on the first clear */
  firstClearBonus?: RewardBundle;
  /** daily bonus pool shared by every dungeon of the type (e.g. 3 Training bonus clears a day) */
  dailyBonusPool: string;
  dailyBonusMultiplier: number;
  /** reward multiplier of the base reward once the daily bonus is used (0.7 = 70 % of base, not of the bonus) */
  repeatRewardMultiplier: number;
  deathRule: DeathRule;
  /** clear rating: 3★ = no hero death and under `targetTime` s (QoL unlocks later: auto repeat, sweep) */
  targetTime: number;
  stage: StageDef;
  /** EQUIPMENT dungeons: item drop table per clear + the guaranteed first-clear item rarity */
  equipmentDrops?: import('./equipment').EquipmentDropTable;
  firstClearItem?: import('./equipment').Rarity;
}

/** per-run reward breakdown (debug / result screen) */
export interface RewardBreakdown {
  base: RewardBundle;
  /** 'DAILY_BONUS' | 'REPEAT' | 'TOWER_FIRST' | 'TOWER_REPEAT' */
  kind: string;
  multiplier: number;
  firstClear?: RewardBundle;
  /** what is actually granted: EXP per hero + items (after bonus / repeat / fragments) */
  final: { heroExp: number; gold: number; items: ItemStack[] };
  /** Equipment Hunt: items that dropped (instances already added to the bag) */
  equipment?: import('./equipment').EquipmentInstance[];
}

export type HeroLevelState = 'NORMAL' | 'BREAKTHROUGH_READY' | 'MAX';

/** what the hero screen shows */
export interface HeroProgressView {
  level: number;
  exp: number;
  expToNext: number;
  levelCap: number;
  state: HeroLevelState;
  breakthrough?: { def: BreakthroughDefinition; have: ItemStack[] };
}

/** daily bonus usage, reset at the local day change */
export interface DailyState {
  /** local day key, e.g. 2026-09-26 */
  day: string;
  /** bonus clears used per pool */
  used: Record<string, number>;
}
