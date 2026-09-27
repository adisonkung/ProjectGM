import type { InterruptPriority, StatusEffectDefinition } from './combat';
import { HeroClass } from './hero';

/**
 * Data model for data-driven monsters (Stage 1–3 and later).
 * Everything here is STATIC definition data — runtime state lives in `MonsterCombatState`
 * (battle/engine/monster-controller.ts) and on the BattleUnit. Never mutate a definition in battle.
 *
 * Units: distances are board cells (8-direction / Chebyshev), times are seconds, speeds are cells/second.
 */

/** COMMON / SPECIAL (one important mechanic) · ELITE (1–2) · BOSS / FINAL_BOSS (phases) */
export type MonsterRank = 'COMMON' | 'SPECIAL' | 'ELITE' | 'BOSS' | 'FINAL_BOSS';
export const isBossRank = (r: MonsterRank) => r === 'BOSS' || r === 'FINAL_BOSS';
/** design role (docs / debug), e.g. FAST_MELEE_DPS, DEBUFFER, BODY_BLOCKER */
export type MonsterRole = string;
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

  /** fraction of the target's DEF ignored by this monster's attacks and skills (Forest Spirit 0.2) */
  defenseIgnore?: number;
  /** heavy body: hostile units cannot walk through its cell (Corrupted Treant) */
  bodyBlock?: boolean;

  // ---- reserved for future systems (stored, no advanced logic yet)
  magicDefense?: number;
  critResistance?: number;
  statusResistance?: number;
  breakResistance?: number;
}

export type TargetStrategy =
  /** 1. nearest reachable FRONT row hero → 2. nearest reachable hero (no attacking through an occupied frontline) */
  | 'NEAREST_REACHABLE_FRONT'
  /** lowest HP% hero (ignores frontline) → prefer in range → nearest among similar (preferBackRow: back row first) */
  | 'LOWEST_HP_PCT'
  /** lowest effective DEF (after this monster's defenseIgnore) → nearest */
  | 'LOWEST_EFFECTIVE_DEF'
  /** by class order (e.g. healer > mage > archer) → lowest HP% — ignores the frontline (divers) */
  | 'CLASS_PRIORITY';

export interface TargetingConfig {
  strategy: TargetStrategy;
  /** keep the current target at least this long before a voluntary switch (invalid targets switch at once) */
  targetLockDuration: number;
  /** LOWEST_HP_PCT: heroes within this HP ratio of the lowest count as "similar" */
  similarHpTolerance?: number;
  /** LOWEST_HP_PCT: consider back-row heroes first */
  preferBackRow?: boolean;
  /** LOWEST_HP_PCT: heroes carrying this status are hunted first (before preferBackRow) — e.g. Mist Wraith → bleed */
  preferStatus?: string;
  /** CLASS_PRIORITY: hero classes in priority order (others after, by lowest HP%) */
  classPriority?: HeroClass[];
}

export type MovementMode =
  /** walk until distance <= attackRange */
  | 'MELEE_CHASE'
  /** approach to preferredRange when out of attackRange; optional small retreat */
  | 'RANGED_HOLD'
  /** treasure carrier: never attacks; holds still, then runs for the far edge of the enemy zone and escapes (`flee`) */
  | 'FLEE';

export interface MonsterAIConfig {
  targeting: TargetingConfig;
  movement: MovementMode;
  /** RANGED_HOLD: how many backward steps are allowed per target (0 = never retreat) */
  maxRetreatSteps?: number;
  /** skill ids checked in this order before normal attacks */
  skillPriority?: string[];
  /** seconds in SPAWNING before the monster starts thinking */
  spawnDuration?: number;
  /**
   * FLEE: start running after `after` s of combat, at once when first damaged (`onHit`), or when at most
   * `guardsAtMost` other non-fleeing allies still stand — escapes at the board edge
   */
  flee?: { after: number; onHit: boolean; guardsAtMost?: number };
  /** ambusher (Mimic Chest): does nothing — not even target — until a hero comes within `wakeRange` or it is hit */
  dormant?: { wakeRange: number };
  /**
   * duel boss holding its arena: never walks further than `leash` cells from where it spawned — heroes must come to
   * it. Skills can still move it (a pounce behind the backline); once off its ground it keeps fighting for
   * `returnAfter` s, then walks home.
   */
  holdArena?: { leash: number; returnAfter: number };
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
  /** every Nth successful hit on the same target applies a status (counter resets when the target changes) */
  onHitEveryN?: { n: number; status: string };
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

/** Monster buffs are ordinary status effects (one system for heroes and monsters) */
export type { StackPolicy, StatusModifiers as BuffModifiers } from './combat';
export type BuffDefinition = StatusEffectDefinition;

/** Who a monster skill affects / aims at (resolved by the MonsterController) */
export type SkillTargetSelector =
  | { type: 'SELF' }
  /** living allies carrying `tag` (self included when it has the tag and includeSelf is true) */
  | { type: 'ALLIES_WITH_TAG'; tag: string; includeSelf: boolean }
  /** every living ally (self included) */
  | { type: 'ALL_ALLIES' }
  /** the lowest HP% living ally (boss / elite allies below `priorityBelow` first) */
  | { type: 'LOWEST_HP_ALLY'; priorityBelow?: number }
  /** the living ally of this definition with the highest HP (Soul Link protector) */
  | { type: 'ALLY_DEFINITION_HIGHEST_HP'; monsterId: string }
  /** the monster's current target */
  | { type: 'CURRENT_TARGET' }
  /** the hero whose `area` (on that hero) covers the most heroes — at least `min`, else the current target */
  | { type: 'HERO_CLUSTER'; area: import('./combat').AreaPattern; min: number }
  /** a back-row hero by class priority (falls back to any back-row hero, then any hero) */
  | { type: 'HERO_PRIORITY'; classes: HeroClass[]; backRowOnly: boolean }
  /** the living hero with the highest ATK */
  | { type: 'HIGHEST_ATK_HERO' }
  /** every living hero */
  | { type: 'ALL_HEROES' };

/** What a monster skill does at SKILL_ACTIVATE (all data — executed by the engine's MonsterSkill executor) */
export type SkillEffect =
  | { type: 'APPLY_BUFF'; buffId: string }
  /** damage around the aim point / caster (mitigated normally; never interrupts heroes) */
  | {
      type: 'DAMAGE'; mul: number; area: import('./combat').AreaPattern; center: 'TARGET' | 'SELF'; damageType?: DamageType;
      /** extra multiplier against a unit carrying `status` (e.g. Mist Strike ×1.2 vs bleeding heroes) */
      bonusVsStatus?: { status: string; mul: number };
    }
  /** status on the units just hit / the aimed unit / every hero / self */
  | { type: 'APPLY_STATUS'; status: string; to: 'HIT' | 'TARGET' | 'ALL_HEROES' | 'SELF'; duration?: number }
  /** heal: `pct` of each recipient's max HP (`excludeSummons`: summoned / non-combat units are skipped) */
  | { type: 'HEAL_PCT'; pct: number; to: 'TARGET' | 'ALL_ALLIES'; excludeSummons?: boolean }
  /** land on the nearest free cell behind the aimed hero (never overlapping a unit) */
  | { type: 'LEAP_BEHIND' }
  /**
   * summon monsters next to the caster, never more than `maxActive` alive from this skill ·
   * `grantWhileAlive`: status on the caster while any add of this skill lives (Ancient Protection)
   */
  | { type: 'SUMMON'; monsters: { id: string; count: number }[]; maxActive: number; grantWhileAlive?: string }
  /** link the caster to the aimed ally: `transfer` of the caster's final damage goes to that ally */
  | { type: 'SOUL_LINK'; status: string }
  /** self-destruct: the caster dies, every boss ally heals `bossHealPct` and gains `buffId` */
  | { type: 'SACRIFICE'; bossHealPct: number; buffId: string }
  /** shield worth `pct` of each recipient's max HP for `duration` s (Page Barrier) */
  | { type: 'SHIELD_PCT'; pct: number; to: 'ALL_ALLIES' | 'SELF'; duration: number }
  /** jump `cells` columns toward the caster's escape edge (treasure carrier Smoke Pouch) */
  | { type: 'BLINK_AWAY'; cells: number };

/** Conditions a monster checks before starting a skill (all must pass) */
export type SkillCondition =
  /** at least `min` living allies with this tag (not counting self) */
  | { type: 'ALLY_TAG_ALIVE'; tag: string; min: number }
  /** at least `min` living allies of this monster definition (not counting self) — e.g. normal Forest Wolves */
  | { type: 'ALLY_DEFINITION_ALIVE'; monsterId: string; min: number }
  /** at least one target of the skill has less than `refreshBelow` s of this buff left */
  | { type: 'TARGETS_NEED_BUFF'; buffId: string; refreshBelow: number }
  /** an enemy (hero) is within this many cells */
  | { type: 'ENEMY_WITHIN'; range: number }
  /** at least `count` living allies (self included) below `pct` HP */
  | { type: 'ALLIES_BELOW'; count: number; pct: number }
  /** a living boss / elite ally (self included) below `pct` HP */
  | { type: 'ELITE_ALLY_BELOW'; pct: number }
  /** at least one ally below `pct` HP */
  | { type: 'ANY_ALLY_BELOW'; pct: number }
  /** any of the nested conditions */
  | { type: 'ANY_OF'; of: SkillCondition[] }
  /** fewer than `max` summons of this skill alive */
  | { type: 'SUMMON_SLOTS_FREE' }
  /** the caster doesn't carry this status */
  | { type: 'SELF_LACKS_STATUS'; status: string }
  /** the caster is below `pct` HP */
  | { type: 'SELF_BELOW'; pct: number }
  /** at least one hero lacks this status (or has ≤ refreshBelow s left) */
  | { type: 'HEROES_NEED_STATUS'; status: string; refreshBelow: number };

export interface MonsterSkillDefinition {
  id: string;
  /** Thai name floated over the head */
  name: string;
  /** cast bar label */
  label: string;
  type: 'BUFF' | 'ATTACK' | 'SUPPORT' | 'SUMMON' | 'MOVEMENT' | 'SPECIAL';
  /** 0 = instant */
  castTime: number;
  cooldown: number;
  /** cooldown after being interrupted (defaults to cooldown) */
  interruptedCooldown?: number;
  interruptible: boolean;
  /** how badly the heroes want to stop this cast (reserved interrupts pick the highest) — default MEDIUM */
  interruptPriority?: InterruptPriority;
  /** Break Gauge: a non-interruptible cast that approved interrupt skills can BREAK with this much break damage */
  breakRequired?: number;
  /** BROKEN status applied on a successful break */
  brokenStatus?: string;
  /** first cast can't happen sooner than this after spawn (tutorial breathing room) — default cooldown × 0.5 */
  firstCastDelay?: number;
  /** ± random seconds added to the first cast (two casters of the same kind don't synchronise) */
  initialDelayRandom?: number;
  /** only once per battle for this unit */
  once?: boolean;
  /** caster is UNTARGETABLE while casting (Mist Form); no cast bar is shown */
  untargetableWhileCasting?: boolean;
  /** cells: the aimed unit must be within this distance */
  range?: number;
  /** clip in AnimationConfig that plays during the cast (optional for mock visuals) */
  clip?: string;
  /** FX played on the caster, synced so its activation frame lands on SKILL_ACTIVATE */
  fx?: { id: string; activationFrame: number; frameMs: number };
  /** FX played on every unit the skill hit / aimed at when it activates (sprite FX key) */
  hitFx?: string;
  /** mock FX shown at the aim point while casting / on activation (placeholder visuals) */
  mockFx?: { color: string; area: import('./combat').AreaPattern };
  target: SkillTargetSelector;
  effects: SkillEffect[];
  conditions: SkillCondition[];
  /** seconds of RECOVERING after activation (rest of the animation) */
  recovery: number;
  /** seconds of RECOVERING after being interrupted */
  interruptRecovery: number;
}

/** Boss phase — entered once when HP ≤ hpBelow (thresholds are processed in order, never skipped) */
export interface BossPhase {
  id: string;
  /** shown on the boss bar */
  label: string;
  /** 0–1 of max HP */
  hpBelow: number;
  /** permanent statuses applied on entry */
  statuses?: string[];
  /** per-skill cooldown overrides from now on (seconds) */
  cooldownOverride?: Record<string, number>;
  /** multiply every skill cooldown from now on */
  cooldownScale?: number;
  /** skills unlocked in this phase, with their first-cast delay */
  enableSkills?: { id: string; firstDelay: number }[];
  /** summon adds on entry */
  summon?: { id: string; count: number }[];
  /** UNTARGETABLE until every add summoned by this phase is dead; pulses damage meanwhile */
  seal?: { pulseEvery: number; pulseAtkPct: number; pulseName: string };
  /** cancel the current cast / idle timers on entry */
  interruptSelf?: boolean;
  /** short phase-setup window (s, ~0.75–1.25): the boss takes no damage while the phase initialises (`phase_shift`) */
  transition?: number;
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
  /** sheet cell width in px (default 132) — big bosses use wider cells; drawn at the same px scale */
  cellW?: number;
  /** token icon when there is no sheet (defaults to the display class icon) */
  tokenIcon?: string;
  clips: Record<string, AnimClip>;
}

export interface MonsterDefinition {
  id: string;
  /** generated variant (dungeon tier / role re-skin): the design it was made from — rules keyed by monster id use this */
  baseId?: string;
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
  /** visual definition id (core/data/visuals.ts) — gameplay never depends on it */
  visual?: string;
  /** CC this unit ignores (bosses): e.g. KNOCKBACK, STUN, ROOT, TAUNT */
  immune?: ('KNOCKBACK' | 'STUN' | 'ROOT' | 'TAUNT')[];
  /** boss phases in HP order */
  phases?: BossPhase[];
}
