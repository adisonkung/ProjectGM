import { HeroClass } from './hero';

/**
 * Data model for data-driven monsters (Stage 1–3 and later).
 * Everything here is STATIC definition data — runtime state lives in `MonsterCombatState`
 * (battle/engine/monster-controller.ts) and on the BattleUnit. Never mutate a definition in battle.
 *
 * Units: distances are board cells (8-direction / Chebyshev), times are seconds, speeds are cells/second.
 */

export type MonsterRank = 'COMMON' | 'ELITE' | 'BOSS';
export type MonsterRole = 'BASIC_MELEE' | 'FRONTLINE_MELEE' | 'RANGED_DPS' | 'FAST_MELEE_DPS' | 'ELITE_MELEE_SUPPORT';
export type DamageType = 'PHYSICAL' | 'MAGIC' | 'TRUE';

/** Gameplay events that an animation clip can fire. Gameplay listens to these, never to frame indexes. */
export type SemanticEvent = 'DAMAGE' | 'PROJECTILE_SPAWN' | 'CAST_START' | 'SKILL_ACTIVATE' | 'FX_START' | 'DEATH_COMPLETE';

export interface MonsterStats {
  maxHp: number;
  attack: number;
  defense: number;
  /** cells per second */
  moveSpeed: number;
  /** cells: may attack when distance <= attackRange */
  attackRange: number;
  /** cells: ranged monsters stop approaching once inside this distance */
  preferredRange: number;
  /** seconds between the starts of two normal attacks */
  attackCooldown: number;
  /** seconds from attack start to its hit/spawn event — derived from the animation event when the clip has one */
  attackWindup: number;
  /** seconds of RECOVERING after the attack animation ends */
  attackRecovery: number;
  targetThinkInterval: number;
  /** seconds the monster is stopped by a hit reaction */
  hitReactionDuration: number;
  /** a new hit reaction can't start sooner than this after the previous one (anti stun-lock) */
  minHitReactionInterval: number;
  /** cells — used by projectile collision */
  collisionRadius: number;
  /** ranged: distance under which the monster may take a small step back */
  minComfortableRange?: number;
  /** ranged: dead zone around preferredRange */
  rangeTolerance?: number;

  // ---- reserved for future systems (stored, no advanced logic yet)
  magicDefense?: number;
  critResistance?: number;
  statusResistance?: number;
  breakResistance?: number;
}

export type TargetStrategy =
  /** 1. nearest reachable FRONT row hero → 2. nearest reachable hero (no attacking through an occupied frontline) */
  | 'NEAREST_REACHABLE_FRONT'
  /** lowest HP% hero (ignores frontline) → prefer in range → nearest among similar */
  | 'LOWEST_HP_PCT';

export interface TargetingConfig {
  strategy: TargetStrategy;
  /** keep the current target at least this long before a voluntary switch (invalid targets switch at once) */
  targetLockDuration: number;
  /** LOWEST_HP_PCT: heroes within this HP ratio of the lowest count as "similar" */
  similarHpTolerance?: number;
}

export type MovementMode =
  /** walk until distance <= attackRange */
  | 'MELEE_CHASE'
  /** approach to preferredRange when out of attackRange; optional small retreat */
  | 'RANGED_HOLD';

export interface MonsterAIConfig {
  targeting: TargetingConfig;
  movement: MovementMode;
  /** RANGED_HOLD: how many backward steps are allowed per target (0 = never retreat) */
  maxRetreatSteps?: number;
  /** skill ids checked in this order before normal attacks */
  skillPriority?: string[];
  /** seconds in SPAWNING before the monster starts thinking */
  spawnDuration?: number;
}

export interface AttackDefinition {
  id: string;
  damageType: DamageType;
  /** × effective attack */
  damageMultiplier: number;
  delivery: 'MELEE' | 'PROJECTILE';
  /** PROJECTILE: key of PROJECTILES */
  projectileId?: string;
  /** clip in AnimationConfig that plays this attack */
  clip: string;
  /** semantic event that resolves the attack (DAMAGE for melee, PROJECTILE_SPAWN for projectiles) */
  event: SemanticEvent;
  /** melee: target may drift up to attackRange + hitTolerance before the hit still lands */
  hitTolerance: number;
}

export interface ProjectileDefinition {
  id: string;
  /** cells per second */
  speed: number;
  damageMultiplier: number;
  damageType: DamageType;
  /** cells */
  collisionRadius: number;
  maxLifetime: number;
  /** TARGET = only the hero it was fired at can be hit (lobbed shot, no line-of-sight in prototype) */
  hits: 'TARGET' | 'ANY_ENEMY';
  /** FX key used by the renderer */
  fx: string;
}

export interface BuffModifiers {
  /** multiplies effective attack while active */
  attackMultiplier?: number;
}

export type StackPolicy = 'REFRESH_DURATION' | 'IGNORE';

export interface BuffDefinition {
  id: string;
  name: string;
  duration: number;
  stackPolicy: StackPolicy;
  modifiers: BuffModifiers;
}

/** Who a skill affects */
export type SkillTargetSelector =
  | { type: 'SELF' }
  /** living allies carrying `tag` (self included when it has the tag and includeSelf is true) */
  | { type: 'ALLIES_WITH_TAG'; tag: string; includeSelf: boolean };

export type SkillEffect = { type: 'APPLY_BUFF'; buffId: string };

/** Conditions a monster checks before starting a skill (all must pass) */
export type SkillCondition =
  /** at least `min` living allies with this tag (not counting self) */
  | { type: 'ALLY_TAG_ALIVE'; tag: string; min: number }
  /** at least one target of the skill has less than `refreshBelow` s of this buff left */
  | { type: 'TARGETS_NEED_BUFF'; buffId: string; refreshBelow: number }
  /** an enemy (hero) is within this many cells */
  | { type: 'ENEMY_WITHIN'; range: number };

export interface MonsterSkillDefinition {
  id: string;
  /** Thai name floated over the head */
  name: string;
  /** cast bar label */
  label: string;
  type: 'BUFF';
  castTime: number;
  cooldown: number;
  /** cooldown after being interrupted (defaults to cooldown) */
  interruptedCooldown?: number;
  interruptible: boolean;
  /** first cast can't happen sooner than this after spawn (tutorial breathing room) */
  firstCastDelay?: number;
  /** clip in AnimationConfig that plays during the cast */
  clip: string;
  /** FX played on the caster, synced so its activation frame lands on SKILL_ACTIVATE */
  fx?: { id: string; activationFrame: number; frameMs: number };
  target: SkillTargetSelector;
  effects: SkillEffect[];
  conditions: SkillCondition[];
  /** seconds of RECOVERING after activation (rest of the animation) */
  recovery: number;
  /** seconds of RECOVERING after being interrupted */
  interruptRecovery: number;
}

export interface AnimEventMark {
  /** 1-based frame number as labelled on the art sheet (authoring reference) */
  frame: number;
  event: SemanticEvent;
  /** monster-specific name for logs/debug, e.g. BODY_SLAM_DAMAGE */
  name: string;
}

export interface AnimClip {
  /** 1-based row on the art sheet (authoring reference) */
  row: number;
  frames: number;
  frameMs: number;
  events?: AnimEventMark[];
  /** cast clips: the frames between CAST_START and SKILL_ACTIVATE are stretched over the cast time */
  castDriven?: boolean;
}

export interface AnimationConfig {
  /** sprite sheet in public/sprites (undefined = token) */
  sheet?: string;
  /** sheet cell height in px (cells are 132 wide; default 100 — tall poses like the Alpha's howl use 120) */
  cellH?: number;
  /** token icon when there is no sheet (defaults to the display class icon) */
  tokenIcon?: 'wolf';
  clips: Record<string, AnimClip>;
}

export interface MonsterDefinition {
  id: string;
  name: string;
  rank: MonsterRank;
  role: MonsterRole;
  /** tags used by skills/conditions (e.g. 'wolf', 'goblin') */
  tags: string[];
  /** class used for the token icon and hero-side target priorities */
  displayClass: HeroClass;
  stats: MonsterStats;
  ai: MonsterAIConfig;
  attack: AttackDefinition;
  skills: string[];
  animation: AnimationConfig;
}
