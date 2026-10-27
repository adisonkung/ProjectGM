import { HeroClass } from './hero';
import type { SemanticEvent } from './monster';

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
  /** multiplies physical DEF; also the DEF fallback when no explicit magicDefense exists */
  defenseMultiplier?: number;
  /** multiplies effective attack (e.g. Alpha Howl ×1.25) */
  attackMultiplier?: number;
  /** multiplies all outgoing damage (e.g. Blood Rage ×1.25) */
  damageMultiplier?: number;
  /** multiplies attacks per second */
  attackSpeedMultiplier?: number;
  /** multiplies voluntary movement speed (Slow), without changing base stats */
  moveSpeedMultiplier?: number;
  /** multiplies cast progress speed of channelled casts (Mordrienne hexes ×0.8 = casts take 25 % longer) */
  castSpeedMultiplier?: number;
  /** multiplies incoming damage (e.g. Taunt guard ×0.60) */
  damageTakenMultiplier?: number;
  /** chance (0–1) to evade an incoming attack */
  dodgeChance?: number;
  /** ranged units only (range > 1): basic-attack / skill damage multipliers (DARK_FOG 0.75 / 0.85) */
  rangedAttackMultiplier?: number;
  rangedSkillMultiplier?: number;
  /** multiplies healing received (Forest Oblivion −50% = 0.5) */
  healingReceivedMultiplier?: number;
  /** share of the damage this unit takes that is sent back to the attacker as TRUE damage (Mirror Stance) */
  reflectDamage?: number;
  /** multiplies this unit's retaliation eruption damage (Blood Dominion → Blood Reprisal) */
  retaliationDamageMultiplier?: number;
  /** multiplies this unit's retaliation self-heal and its cap (Blood Dominion → Blood Reprisal) */
  retaliationHealMultiplier?: number;
}

/** Control flags: stun = no actions / no movement · root = no movement (attacks / casts allowed) · taunted = must target the source */
export type StatusFlag =
  | 'stun' | 'root' | 'taunted'
  /** cannot be selected / hit (Mist Form, boss seal); Focus on it becomes temporarily invalid */
  | 'untargetable'
  /** BROKEN: cannot attack or cast (Break Gauge result) */
  | 'broken'
  /** SILENCE: heroes cannot use skills / ultimates (basic attacks still allowed) */
  | 'silence'
  /** UNSTOPPABLE (stagger resistance): stun / root / knockback do not land */
  | 'unstoppable';

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
  /** opt-in refresh: retain the lower (stronger reduction) value of each modifier */
  refreshModifiers?: 'MINIMUM';
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
  /** SOUL LINK: this share of the carrier's final damage goes to the status source instead (no crit, no on-hit, no chain) */
  damageTransfer?: number;
  /** control statuses (stun / root / taunt) only land on bosses when true */
  bossValid?: boolean;
  /** COUNTER (Garrick Brace for Impact): the first direct hit from a foe while this status is up puts `status` on the
   *  attacker (once per application — a refresh re-arms it) */
  counterStatus?: { status: string; duration?: number };
  /**
   * RETALIATION (Draeven Blood Debt): every direct hit a foe lands on the carrier adds one stack; at `hits` stacks the
   * carrier erupts once — `damage` × own ATK to every valid foe within `radius` cells (8-direction) — heals
   * `healPerStack` × max HP per stack, capped at `healCap` × max HP — and the status ends
   */
  retaliation?: { hits: number; radius: number; damage: number; damageType?: 'PHYSICAL' | 'MAGIC'; healPerStack: number; healCap: number;
    /** seconds from the threshold hit (status ends, `retaliateStart`) to the eruption's damage + heal (VFX peak); 0 = same tick */
    delay?: number };
  /** DRAIN (Draeven Blood Brand): damage the status source deals to the carrier heals the source by this share */
  drainToSource?: number;
  /** stance statuses (Mirror Stance) end at once when the unit is stunned or knocked back */
  endOnControl?: boolean;
  /** DoT / HoT ticks can't crit; they ignore DEF (direct damage) — documented, always true for now */
}

// ------------------------------------------------------------------ areas

/**
 * Standard areas (logical grid cells, 8-direction distance):
 * SINGLE        exactly one target
 * SQUARE_2      primary + one column toward enemy, two lanes (previous lane at bottom edge)
 * RECT_3X2      three columns around primary, two lanes; footprint shifts inside board edges
 * RECT_6X3      six columns across all lanes, clamped onto the board
 * RECT_6X3_CENTERED exact target centre, six columns × three lanes; clips at board edges
 * ADJACENT_8    centre cell + the 8 around it (3×3)
 * CROSS_1       centre + up / down / forward / behind
 * LINE_2/LINE_3 primary + the next 1 / 2 cells behind it along the attack direction
 * FRONT_CELL    every unit in the cell in front of the caster (ground-targeted: stacked units all hit)
 * FRONT_3X3     3 × 3 centred on the cell in front of the caster (front cell = primary multiplier)
 * FRONT_LINE_2  ground: the 2 cells straight ahead, both main
 * FRONT_COLUMN_3 ground: the column in front (lane −1 / 0 / +1), all main
 * FRONT_CROSS   ground: main in front, splash above / below it and one cell further
 * FRONT_T3      ground: main in front, splash on the cells above / below it
 * FRONT_RECT_2X3 ground: two columns strictly forward, lane −1 / 0 / +1; front cell main
 * FRONT_LINE_4  ground: the 4 cells straight ahead, all main (sword wave down the lane)
 * FRONT_ARC     short cone in front of the caster: 1–2 columns ahead, ±1 lane
 * RADIUS_2/3    within 2 / 3 cells of the centre
 * ALL_ALLIES / ALL_ENEMIES every living, valid unit of that team
 */
export type AreaPattern =
  | 'SINGLE' | 'SQUARE_2' | 'RECT_3X2' | 'RECT_6X3' | 'RECT_6X3_CENTERED' | 'ADJACENT_8' | 'CROSS_1' | 'LINE_2' | 'LINE_3' | 'FRONT_ARC' | 'FRONT_CELL' | 'FRONT_3X3' | 'FRONT_LINE_2' | 'FRONT_COLUMN_3' | 'FRONT_CROSS' | 'FRONT_T3' | 'FRONT_RECT_2X3' | 'FRONT_LINE_4' | 'RADIUS_2' | 'RADIUS_3' | 'ALL_ALLIES' | 'ALL_ENEMIES';

/** where an area is centred */
export type AreaCenter = 'TARGET' | 'SELF';

// ------------------------------------------------------------------ skills

export type SkillSlot = 'attack' | 'skill' | 'skill2' | 'ult';

/**
 * How the AI may spend a skill / ultimate (per hero, changeable by the player / tactical bot):
 * AUTO        whenever its normal AI condition holds (interrupt skills fall back to damage when no cast is up)
 * CONDITIONAL only when its SkillDefinition condition holds (interrupt skills: only on a cast — no damage fallback)
 * RESERVE     kept for high-value tactical moments (interrupts / breaks of important casts, emergencies)
 * MANUAL      never by the AI — player command only
 */
export type SkillUseMode = 'AUTO' | 'CONDITIONAL' | 'RESERVE' | 'MANUAL';

/** how important it is to stop an enemy cast (reserved interrupts go for the highest one) */
export type InterruptPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export const INTERRUPT_PRIORITY_RANK: Record<InterruptPriority, number> = { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 };
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
 * FOCUS                   the player's focus target if valid (nothing else)
 * MARKED                  an enemy in range carrying the skill's `markStatus` (lowest HP% first) — e.g. Open Wound
 * SELF                    the caster
 */
export type TargetRule =
  | 'CURRENT' | 'NEAREST_ENEMY' | 'CASTING_INTERRUPTIBLE' | 'CLUSTER' | 'FOCUS_OR_LOWEST_HP' | 'FARTHEST_BACKROW'
  | 'LOWEST_HP_ENEMY' | 'LOWEST_HP_ALLY' | 'FOCUS' | 'MARKED' | 'SELF';

/** Effects run in order at the skill's hit moment (or on projectile arrival) */
export type SkillEffect = SkillEffectCore & {
  /**
   * multi-hit skills (`repeat`): this effect only runs on these hit indices (0-based) — e.g. Severing Chain interrupts
   * and marks on throw 3 only; absent = every hit
   */
  onHits?: number[];
};
export interface FieldDefinition {
  area: 'SQUARE_2' | 'RECT_3X2' | 'RECT_6X3' | 'RECT_6X3_CENTERED' | 'ADJACENT_8';
  /** Omitted: activation target cell. HOME_ZONE: fixed centre of the source side's formation zone. */
  anchor?: 'HOME_ZONE';
  /** Continuous occupancy-based protection; independent of pulse cadence and never leaves a lingering buff. */
  aura?: { team: 'ALLY' | 'ENEMY'; modifiers: StatusModifiers };
  /** combat seconds; first pulse after interval, final pulse may land at duration */
  duration: number;
  /** pulse once the moment the field opens (then every interval, the last one before `duration`): same pulse count,
   *  the opening pulse = the activation hit (Mordrienne House of Ashes) */
  pulseOnStart?: boolean;
  interval: number;
  /** pulse damage/statuses only; geometry is the field area, no nested fields */
  effects: Extract<SkillEffect, { type: 'DAMAGE' | 'APPLY_STATUS' }>[];
}

export type SkillEffectCore =
  | { type: 'FIELD'; field: FieldDefinition }
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
      /**
       * Break Gauge damage dealt to a breakable cast (e.g. Forest Oblivion) by this hit. Without `interrupt` the hit only
       * breaks: it fills the gauge of a breakable cast but never cancels an interruptible one (and the AI does not plan
       * interrupts around it)
       */
      breakPower?: number;
      /** ×mul against a guarded target: it carries a shield or a damage-reducing status (damage taken < ×1) */
      bonusVsGuard?: number;
      /** ×mul against a unit carrying `status` before this cast's effects (e.g. Mordrienne's Hex Mark amplifies her spells) */
      bonusVsStatus?: { status: string; mul: number };
      /** only units carrying this status before this cast's effects are hit (e.g. House of Ashes burst on hexed foes) */
      requireStatus?: string;
      /**
       * line pierce (LINE_2 / LINE_3): the n-th unit behind the primary is hit this many seconds after it (one entry per
       * unit, the last repeats) — the same blade reaching it — with its own `impact` event (index n) for FX / feel
       */
      pierceDelays?: number[];
      /**
       * ground shapes only: the strike travels as a wave at this many cells / s from the caster — the cell k ahead
       * resolves (k − 0.5) / travel s after the hit, on whoever stands in it then, each unit at most once per cast
       * (own `impact` event per collision, index k − 1). No damage at the release itself.
       */
      travel?: number;
    }
  /**
   * heal allies: atk × sourceAtk + maxHpPct × recipient max HP. `center: 'TARGET'` centres the area on the primary
   * (an ally), `skipPrimary` leaves the primary out (splash part of a targeted heal)
   */
  | { type: 'HEAL'; area: AreaPattern | 'PRIMARY'; center?: AreaCenter; atk: number; maxHpPct?: number; skipPrimary?: boolean }
  /** remove up to `count` debuffs (newest first; untargetable seals excluded) from the primary ally or every living ally */
  | { type: 'CLEANSE'; to: 'PRIMARY' | 'ALL_ALLIES'; count?: number }
  /** apply a status to: the units hit by the previous DAMAGE ('HIT'), the caster, the primary, or an area */
  | {
      type: 'APPLY_STATUS'; status: string; to: 'HIT' | 'SELF' | 'PRIMARY' | 'AREA';
      area?: AreaPattern; center?: AreaCenter; team?: 'ENEMY' | 'ALLY';
      /** only when the previous DAMAGE hit at least this many units */
      minHits?: number;
      /** recipient status BEFORE this hit's effects; absent = unconditional */
      when?: { status: string; present: boolean };
      duration?: number;
      /** skill rank: DoT / HoT magnitude = final ATK × potency (default 1) */
      potency?: number;
      /** skill rank: this application's modifiers replace the status's defaults (e.g. taunt_guard 0.60 → 0.55) */
      modifiers?: Partial<StatusModifiers>;
    }
  /** interrupt every interruptible caster in the area (no damage) */
  | { type: 'INTERRUPT'; area: AreaPattern; center?: AreaCenter; breakPower?: number }
  /** push the primary target back (away from the caster) */
  | { type: 'KNOCKBACK'; cells: number }
  /**
   * absorb shields: caster gets selfPct, every other living ally allyPct (of the CASTER's max HP);
   * `to: 'PRIMARY'` shields only the primary ally (allyPct, or selfPct when it is the caster)
   */
  | { type: 'SHIELD'; selfPct: number; allyPct: number; duration: number; to?: 'PRIMARY' }
  /** revive one dead ally (party revive limit applies) */
  /**
   * revive dead allies (party revive limit applies) · `delay` (s): the ally is chosen NOW (listed in this hit's impact
   * `hits` → revival cue FX at its body) and comes back `delay` later (the sync sheet's REVIVE_APPLY)
   */
  | { type: 'REVIVE'; hpPct: number; count: number; delay?: number };

/** Positioning part of a skill (happens at the animation's move frame) */
export type SkillMovement =
  /** straight committed dash: cross distance-1 cells, mark unique crossed foes, damage them once after arrival */
  | { type: 'DASH_PATH'; distance: number; duration: number }
  /** teleport next to the target, on the side away from the caster */
  | { type: 'BLINK_BEHIND' }
  /** dash up to the target (adjacent cell) before the hit */
  | { type: 'CHARGE' }
  /** after the hit, pass through the primary target; firstHitOnly prevents repeated crossings in a multi-hit cast */
  | { type: 'DASH_THROUGH'; firstHitOnly?: boolean };

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
  /** the status the MARKED target rule looks for (e.g. 'open_wound') */
  markStatus?: string;
  /** projectile speed multiplier of this skill's shots (flight time ÷ speed; 2 = twice as fast, the damage lands
   *  sooner) — omitted = the engine's default flight */
  projectileSpeed?: number;
  movement?: SkillMovement;
  /** Opt-in action lock: absolute semantic hit times, explicit interruption and optional authored retreat/finishing turn. */
  action?: { type: 'STATIONARY'; interruptible: boolean; lockedTarget?: boolean;
    /** Optional opening blink on a semantic event; a blocked retreat keeps the original cell. */
    retreat?: { event: SemanticEvent; cells: number };
    /** Turn once before a finishing pose, then keep the action's facing lock. */
    faceAway?: { event: SemanticEvent; index?: number };
  };
  /** default AI use mode (heroes may override per slot) — AUTO when omitted */
  useMode?: SkillUseMode;
  /** INSTANT (hit frame) · PROJECTILE (flies from the caster, effects on arrival) · SKY (falls onto the target) */
  delivery?: 'INSTANT' | 'PROJECTILE' | 'SKY';
  /** fire `count` independent shots `gap` s apart (Rapid Shot); later shots stop if the target died */
  /**
   * several hits from one use. `gap` = seconds between hits, unless the caster's clip authors one DAMAGE event per hit
   * (then the hits land on those events). `weights` split the skill's multipliers over the hits (sum 1 = same total
   * as one hit). `keepAfterKill` = later hits still land (areas centred on the last cell) when the target dies.
   */
  /**
   * multi-hit. `comboBonus`: the last hit deals ×(1 + comboBonus) when every earlier hit damaged the same primary
   * target (Kael Relentless Cross)
   */
  repeat?: { count: number; gap: number; weights?: number[]; keepAfterKill?: boolean; comboBonus?: number };
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
