import { HeroClass } from './hero';

/**
 * Data model of the hero combat systems (skills, areas, status effects).
 * Everything here is static data — the engine systems (SkillSystem, AreaResolver, StatusSystem,
 * DamageResolver, UltimateGauge …) read it; no hero has its own code path.
 */

// ------------------------------------------------------------------ status effects

/**
 * NONE                  a second application is ignored while one is active
 * REFRESH_DURATION      one instance; re-applying resets its duration (never multiplies)
 * STACK_DURATION        one instance; re-applying adds the duration
 * STACK_MAGNITUDE       one instance; re-applying adds another stack (up to maxStacks)
 * INDEPENDENT_BY_SOURCE one instance per source: same source refreshes, different sources coexist
 */
export type StackPolicy = 'NONE' | 'REFRESH_DURATION' | 'STACK_DURATION' | 'STACK_MAGNITUDE' | 'INDEPENDENT_BY_SOURCE';

export interface StatusModifiers {
  /** multiplies effective attack (e.g. Alpha Howl ×1.25) */
  attackMultiplier?: number;
  /** multiplies all outgoing damage (e.g. Blood Rage ×1.25) */
  damageMultiplier?: number;
  /** multiplies attacks per second */
  attackSpeedMultiplier?: number;
  /** multiplies incoming damage (e.g. Taunt guard ×0.60) */
  damageTakenMultiplier?: number;
  /** chance (0–1) to evade an incoming attack */
  dodgeChance?: number;
}

/** Control flags: stun = no actions / no movement · root = no movement (attacks / casts allowed) · taunted = must target the source */
export type StatusFlag = 'stun' | 'root' | 'taunted';

/** Periodic effect: every `interval` s deal / heal `perSecond × sourceAtk × interval` (snapshot at application) */
export interface StatusTick {
  kind: 'DAMAGE' | 'HEAL';
  /** fraction of the source's ATK per second */
  perSecond: number;
  interval: number;
}

export interface StatusEffectDefinition {
  id: string;
  name: string;
  duration: number;
  stackPolicy: StackPolicy;
  maxStacks?: number;
  modifiers: StatusModifiers;
  flags?: StatusFlag[];
  tick?: StatusTick;
  /** true = positive effect (UI colour / future dispel); default false */
  buff?: boolean;
  /** removed when the unit dies (default true unless persistThroughDeath) */
  removeOnDeath?: boolean;
  /** keep through death / revive (persistent injuries, stage-long modifiers). Default false */
  persistThroughDeath?: boolean;
  /** freeze the timer during wave transitions. Default false */
  pauseDuringWaveTransition?: boolean;
}

// ------------------------------------------------------------------ areas

/**
 * Standard areas (logical grid cells, 8-direction distance):
 * SINGLE        exactly one target
 * ADJACENT_8    centre cell + the 8 around it (3×3)
 * CROSS_1       centre + up / down / forward / behind
 * LINE_2/LINE_3 primary + the next 1 / 2 cells behind it along the attack direction
 * FRONT_ARC     short cone in front of the caster: 1–2 columns ahead, ±1 lane
 * RADIUS_2/3    within 2 / 3 cells of the centre
 * ALL_ALLIES / ALL_ENEMIES every living, valid unit of that team
 */
export type AreaPattern =
  | 'SINGLE' | 'ADJACENT_8' | 'CROSS_1' | 'LINE_2' | 'LINE_3' | 'FRONT_ARC' | 'RADIUS_2' | 'RADIUS_3' | 'ALL_ALLIES' | 'ALL_ENEMIES';

/** where an area is centred */
export type AreaCenter = 'TARGET' | 'SELF';

// ------------------------------------------------------------------ skills

export type SkillSlot = 'attack' | 'skill' | 'skill2' | 'ult';
export type DamageKind = 'PHYSICAL' | 'MAGIC' | 'TRUE';

/**
 * How the primary target of a skill is chosen (the AI's targeting rule for that skill).
 * CURRENT                 the unit's current (Target Resolver) target
 * NEAREST_ENEMY           nearest valid enemy
 * CASTING_INTERRUPTIBLE   an enemy in range that is casting an interruptible skill (focus first) — else fallback
 * CLUSTER                 the enemy in range whose ADJACENT_8 hits the most enemies (needs ≥ minTargets)
 * FOCUS_OR_LOWEST_HP      the player's focus target if valid, else the lowest HP% enemy (blink skills)
 * FARTHEST_BACKROW        the farthest back-row enemy that can be blinked to, else the lowest HP% enemy
 * LOWEST_HP_ENEMY         the lowest HP% enemy (ignores focus)
 * LOWEST_HP_ALLY          the lowest HP% living ally
 * SELF                    the caster
 */
export type TargetRule =
  | 'CURRENT' | 'NEAREST_ENEMY' | 'CASTING_INTERRUPTIBLE' | 'CLUSTER' | 'FOCUS_OR_LOWEST_HP' | 'FARTHEST_BACKROW'
  | 'LOWEST_HP_ENEMY' | 'LOWEST_HP_ALLY' | 'SELF';

/** Effects run in order at the skill's hit moment (or on projectile arrival) */
export type SkillEffect =
  /** damage the units of `area`; the primary target takes `primary`, the others `secondary` (never both) */
  | {
      type: 'DAMAGE'; area: AreaPattern; center?: AreaCenter; primary: number; secondary?: number;
      damageType?: DamageKind;
      /** always crit (×1.5) */
      guaranteedCrit?: boolean;
      /** ×mul when the target's HP% ≤ hpBelow (before the hit) */
      executeBonus?: { hpBelow: number; mul: number };
      /** cancels interruptible casts of the units it hits (dedicated Interrupt — plain damage never interrupts) */
      interrupt?: boolean;
    }
  /** heal allies: atk × sourceAtk + maxHpPct × recipient max HP */
  | { type: 'HEAL'; area: AreaPattern | 'PRIMARY'; center?: AreaCenter; atk: number; maxHpPct?: number }
  /** apply a status to: the units hit by the previous DAMAGE ('HIT'), the caster, the primary, or an area */
  | {
      type: 'APPLY_STATUS'; status: string; to: 'HIT' | 'SELF' | 'PRIMARY' | 'AREA';
      area?: AreaPattern; center?: AreaCenter; team?: 'ENEMY' | 'ALLY';
      /** only when the previous DAMAGE hit at least this many units */
      minHits?: number;
      duration?: number;
    }
  /** interrupt every interruptible caster in the area (no damage) */
  | { type: 'INTERRUPT'; area: AreaPattern; center?: AreaCenter }
  /** push the primary target back (away from the caster) */
  | { type: 'KNOCKBACK'; cells: number }
  /** absorb shields: caster gets selfPct, every other living ally allyPct (of the CASTER's max HP) */
  | { type: 'SHIELD'; selfPct: number; allyPct: number; duration: number }
  /** revive one dead ally (party revive limit applies) */
  | { type: 'REVIVE'; hpPct: number; count: number };

/** Positioning part of a skill (happens at the animation's move frame) */
export type SkillMovement =
  /** teleport next to the target, on the side away from the caster */
  | { type: 'BLINK_BEHIND' }
  /** dash up to the target (adjacent cell) before the hit */
  | { type: 'CHARGE' }
  /** after the hit, pass through the primary target and land behind it (nearest valid cell otherwise) */
  | { type: 'DASH_THROUGH' };

/**
 * When the AI uses a skill (the hero AI walks the tiers in order: EMERGENCY → INTERRUPT → HEAL → HIGH_VALUE → NORMAL)
 * - EMERGENCY / HEAL use `allyHpBelow` (+ optional count) — survival first
 * - INTERRUPT is only taken when the target rule found an interruptible caster
 * - `minTargets` = the effect area must hit at least this many enemies
 */
export interface SkillAI {
  tier: 'EMERGENCY' | 'INTERRUPT' | 'HEAL' | 'HIGH_VALUE' | 'NORMAL';
  minTargets?: number;
  /** area used to count `minTargets` (default: the first DAMAGE area) */
  countArea?: AreaPattern;
  countCenter?: AreaCenter;
  /** healing: an ally (in range) below this HP% */
  allyHpBelow?: number;
  /** healing: at least this many allies below allyHpBelow (default 1) */
  alliesBelowCount?: number;
  /** a lower threshold that promotes the skill to EMERGENCY */
  emergencyHpBelow?: number;
  /** ultimate: an enemy within this many cells is required */
  enemyWithin?: number;
  /** ultimate / heal: fire when a dead ally can be revived */
  whenAllyDead?: boolean;
  /**
   * INTERRUPT skills: don't spend the skill on its fallback targets while an enemy owns an interruptible cast
   * that is ready (or will be within this many seconds) — keep it for the cast bar
   */
  holdForInterrupt?: number;
}

export interface SkillDefinition {
  id: string;
  /** Thai name shown in battle */
  name: string;
  /** English design name (docs / debug) */
  label: string;
  slot: SkillSlot;
  /** seconds (skill / skill2); ultimates use the gauge */
  cooldown?: number;
  /** cells; omitted = the unit's attack range; Infinity = unlimited */
  range?: number;
  target: TargetRule;
  /** fallback rules tried in order when `target` finds nobody (e.g. caster → cluster → current) */
  fallback?: TargetRule[];
  movement?: SkillMovement;
  /** INSTANT (hit frame) · PROJECTILE (flies from the caster, effects on arrival) · SKY (falls onto the target) */
  delivery?: 'INSTANT' | 'PROJECTILE' | 'SKY';
  /** fire `count` independent shots `gap` s apart (Rapid Shot); later shots stop if the target died */
  repeat?: { count: number; gap: number };
  effects: SkillEffect[];
  ai?: SkillAI;
}

/** A hero's combat kit: basic attack + two cooldown skills + ultimate */
export interface HeroKit {
  attack: SkillDefinition;
  skill: SkillDefinition;
  skill2: SkillDefinition;
  ult: SkillDefinition;
  /** healer: basic action heals the lowest HP% ally below this HP% instead of attacking */
  healBolt?: { allyHpBelow: number; atk: number };
}

/** Static hero definition (5★ Lv1 prototype balance) */
export interface HeroDefinition {
  id: string;
  cls: HeroClass;
  /** combat identity, e.g. "Formation Cleave / Multi-target Melee DPS" */
  identity: string;
  kit: HeroKit;
}
