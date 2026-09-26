import {
  AnimClip,
  AnimationConfig,
  BuffDefinition,
  MonsterDefinition,
  MonsterSkillDefinition,
  ProjectileDefinition,
  SemanticEvent,
} from '../models/monster';
import { STATUS_EFFECTS } from './status-effects';
import { STAGE4_10_MONSTERS, STAGE4_10_SKILLS } from './monsters-stage4-10';
import { TRIAL_MONSTERS, TRIAL_SKILLS } from './monsters-trials';
import { FARM_MONSTERS, FARM_SKILLS } from './monsters-farm';

/**
 * Data-driven monsters — Normal Forest, Stage 1–3.
 * The combat systems (MonsterController, targeting, DamageResolver, projectiles, casting, buffs) read these
 * definitions; nothing here is monster-specific code. New monsters = new entries.
 *
 * Animation frames/rows are 1-based as labelled on the art sheets. Gameplay only uses the semantic events.
 */

const F = 85; // default ms per frame (same as FRAME_MS in sprites.ts)

const clip = (row: number, frames: number, events: AnimClip['events'] = [], frameMs = F): AnimClip => ({ row, frames, frameMs, events });
const death = (row: number, frames: number) => clip(row, frames, [{ frame: frames, event: 'DEATH_COMPLETE', name: 'DEATH_COMPLETE' }]);

// ------------------------------------------------------------------ buffs

/** monster buffs are entries of the shared status-effect table */
export const BUFFS: Record<string, BuffDefinition> = {
  alpha_howl_buff: STATUS_EFFECTS['alpha_howl_buff'],
};

// ------------------------------------------------------------------ projectiles

export const PROJECTILES: Record<string, ProjectileDefinition> = {
  spore_shot: { id: 'spore_shot', speed: 8, damageMultiplier: 1, damageType: 'MAGIC', collisionRadius: 0.25, maxLifetime: 2.5, hits: 'TARGET', fx: 'magic-bolt' },
  spirit_bolt: { id: 'spirit_bolt', speed: 10, damageMultiplier: 1, damageType: 'MAGIC', collisionRadius: 0.25, maxLifetime: 2.5, hits: 'TARGET', fx: 'magic-bolt' },
  hex_bolt: { id: 'hex_bolt', speed: 9, damageMultiplier: 1, damageType: 'MAGIC', collisionRadius: 0.25, maxLifetime: 2.5, hits: 'TARGET', fx: 'magic-bolt' },
  dark_bolt: { id: 'dark_bolt', speed: 9, damageMultiplier: 1, damageType: 'MAGIC', collisionRadius: 0.25, maxLifetime: 2.5, hits: 'TARGET', fx: 'magic-bolt' },
  goblin_arrow: {
    id: 'goblin_arrow',
    speed: 10,
    damageMultiplier: 1,
    damageType: 'PHYSICAL',
    collisionRadius: 0.2,
    maxLifetime: 2.5,
    hits: 'TARGET',
    fx: 'goblin-arrow',
  },
};

// ------------------------------------------------------------------ monster skills (cast system)

export const MONSTER_SKILLS: Record<string, MonsterSkillDefinition> = {
  alpha_howl: {
    id: 'alpha_howl',
    name: 'เสียงหอนจ่าฝูง',
    label: 'ALPHA HOWL',
    type: 'BUFF',
    castTime: 2,
    cooldown: 12,
    interruptedCooldown: 12,
    interruptible: true, interruptPriority: 'HIGH',
    // counted from the start of combat of its wave (tutorial timing 2.25 s)
    firstCastDelay: 2.25,
    clip: 'howl',
    fx: { id: 'alpha-howl', activationFrame: 5, frameMs: 90 },
    target: { type: 'ALLIES_WITH_TAG', tag: 'wolf', includeSelf: true },
    effects: [{ type: 'APPLY_BUFF', buffId: 'alpha_howl_buff' }],
    // at least one NORMAL Forest Wolf alive (Alpha itself doesn't count) — kill the pack and the Howl stops
    conditions: [
      { type: 'ALLY_DEFINITION_ALIVE', monsterId: 'forest_wolf', min: 1 },
      { type: 'TARGETS_NEED_BUFF', buffId: 'alpha_howl_buff', refreshBelow: 2 },
    ],
    recovery: 0.35,
    interruptRecovery: 0.6,
  },
  ...STAGE4_10_SKILLS,
  ...TRIAL_SKILLS,
  ...FARM_SKILLS,
};

// ------------------------------------------------------------------ monsters

export const MONSTERS: Record<string, MonsterDefinition> = {
  forest_slime: {
    id: 'forest_slime',
    name: 'สไลม์ป่า',
    rank: 'COMMON',
    role: 'BASIC_MELEE',
    tags: ['slime'],
    displayClass: 'tank',
    stats: {
      maxHp: 100, attack: 18, defense: 5, moveSpeed: 1.8,
      attackRange: 1.0, preferredRange: 0.8, attackCooldown: 1.8,
      attackWindup: 0.34, attackRecovery: 0.3, targetThinkInterval: 0.4,
      hitReactionDuration: 0.2, minHitReactionInterval: 0.8, collisionRadius: 0.4,
    },
    ai: { targeting: { strategy: 'NEAREST_REACHABLE_FRONT', targetLockDuration: 1.2 }, movement: 'MELEE_CHASE' },
    attack: { id: 'slime_body_slam', damageType: 'PHYSICAL', damageMultiplier: 1, delivery: 'MELEE', clip: 'attack', event: 'DAMAGE', hitTolerance: 0.3 },
    skills: [],
    animation: {
      sheet: 'enemy-slime.png',
      clips: {
        idle: clip(1, 4, [], 150),
        move: clip(2, 6),
        hurt: clip(3, 3),
        death: death(4, 6),
        attack: clip(5, 6, [{ frame: 5, event: 'DAMAGE', name: 'BODY_SLAM_DAMAGE' }]),
      },
    },
  },

  goblin_fighter: {
    id: 'goblin_fighter',
    name: 'ก็อบลินนักรบ',
    rank: 'COMMON',
    role: 'FRONTLINE_MELEE',
    tags: ['goblin'],
    displayClass: 'fighter',
    stats: {
      maxHp: 140, attack: 22, defense: 10, moveSpeed: 2.4,
      attackRange: 1.3, preferredRange: 1.1, attackCooldown: 1.5,
      attackWindup: 0.255, attackRecovery: 0.25, targetThinkInterval: 0.35,
      hitReactionDuration: 0.2, minHitReactionInterval: 0.8, collisionRadius: 0.4,
    },
    ai: { targeting: { strategy: 'NEAREST_REACHABLE_FRONT', targetLockDuration: 1.2 }, movement: 'MELEE_CHASE' },
    attack: { id: 'goblin_sword_slash', damageType: 'PHYSICAL', damageMultiplier: 1, delivery: 'MELEE', clip: 'attack', event: 'DAMAGE', hitTolerance: 0.25 },
    skills: [],
    animation: {
      sheet: 'enemy-goblin-fighter.png',
      clips: {
        idle: clip(1, 4, [], 150),
        move: clip(2, 6),
        hurt: clip(3, 3),
        death: death(4, 6),
        attack: clip(5, 6, [{ frame: 4, event: 'DAMAGE', name: 'SWORD_DAMAGE' }]),
      },
    },
  },

  goblin_archer: {
    id: 'goblin_archer',
    name: 'ก็อบลินพลธนู',
    rank: 'COMMON',
    role: 'RANGED_DPS',
    tags: ['goblin'],
    displayClass: 'archer',
    stats: {
      maxHp: 90, attack: 20, defense: 4, moveSpeed: 2.2,
      attackRange: 7.0, preferredRange: 6.0, minComfortableRange: 3.0, rangeTolerance: 0.5,
      attackCooldown: 1.8, attackWindup: 0.34, attackRecovery: 0.3, targetThinkInterval: 0.35,
      hitReactionDuration: 0.2, minHitReactionInterval: 0.8, collisionRadius: 0.35,
    },
    ai: {
      targeting: { strategy: 'LOWEST_HP_PCT', targetLockDuration: 1.0, similarHpTolerance: 0.05 },
      movement: 'RANGED_HOLD',
      maxRetreatSteps: 1,
    },
    attack: {
      id: 'goblin_arrow_shot', damageType: 'PHYSICAL', damageMultiplier: 1, delivery: 'PROJECTILE',
      projectileId: 'goblin_arrow', clip: 'attack', event: 'PROJECTILE_SPAWN', hitTolerance: 0,
    },
    skills: [],
    animation: {
      sheet: 'enemy-goblin-archer.png',
      clips: {
        idle: clip(1, 4, [], 150),
        move: clip(2, 6),
        hurt: clip(3, 3),
        death: death(4, 6),
        // 6 frames on the sheet; frame 5 = RELEASE (the arrow is cut out of it and flies as the projectile)
        attack: clip(5, 6, [{ frame: 5, event: 'PROJECTILE_SPAWN', name: 'PROJECTILE_SPAWN' }]),
      },
    },
  },

  forest_wolf: {
    id: 'forest_wolf',
    name: 'หมาป่าป่าลึก',
    rank: 'COMMON',
    role: 'FAST_MELEE_DPS',
    tags: ['wolf'],
    displayClass: 'fighter',
    stats: {
      maxHp: 110, attack: 24, defense: 6, moveSpeed: 4.2,
      attackRange: 1.2, preferredRange: 1.0, attackCooldown: 1.15,
      attackWindup: 0.255, attackRecovery: 0.15, targetThinkInterval: 0.25,
      hitReactionDuration: 0.2, minHitReactionInterval: 0.8, collisionRadius: 0.4,
    },
    ai: { targeting: { strategy: 'NEAREST_REACHABLE_FRONT', targetLockDuration: 1.0 }, movement: 'MELEE_CHASE' },
    attack: { id: 'forest_wolf_bite', damageType: 'PHYSICAL', damageMultiplier: 1, delivery: 'MELEE', clip: 'attack', event: 'DAMAGE', hitTolerance: 0.4 },
    skills: [],
    animation: {
      sheet: 'enemy-wolf.png',
      tokenIcon: 'wolf',
      clips: {
        idle: clip(1, 4, [], 150),
        move: clip(2, 6),
        hurt: clip(3, 3),
        death: death(4, 6),
        attack: clip(5, 6, [{ frame: 4, event: 'DAMAGE', name: 'BITE_DAMAGE' }]),
      },
    },
  },

  alpha_wolf: {
    id: 'alpha_wolf',
    name: 'จ่าฝูงหมาป่า',
    rank: 'ELITE',
    role: 'ELITE_MELEE_SUPPORT',
    tags: ['wolf'],
    displayClass: 'fighter',
    stats: {
      maxHp: 450, attack: 32, defense: 15, moveSpeed: 3.5,
      attackRange: 1.4, preferredRange: 1.2, attackCooldown: 1.35,
      attackWindup: 0.255, attackRecovery: 0.2, targetThinkInterval: 0.25,
      // elite: shorter and rarer flinch
      hitReactionDuration: 0.1, minHitReactionInterval: 2.0, collisionRadius: 0.5,
    },
    ai: {
      targeting: { strategy: 'NEAREST_REACHABLE_FRONT', targetLockDuration: 1.0 },
      movement: 'MELEE_CHASE',
      skillPriority: ['alpha_howl'],
    },
    attack: { id: 'alpha_savage_bite', damageType: 'PHYSICAL', damageMultiplier: 1.25, delivery: 'MELEE', clip: 'attack', event: 'DAMAGE', hitTolerance: 0.4 },
    skills: ['alpha_howl'],
    animation: {
      sheet: 'enemy-alpha-wolf.png',
      cellH: 120,
      tokenIcon: 'wolf',
      clips: {
        idle: clip(1, 4, [], 150),
        move: clip(2, 6),
        hurt: clip(3, 3),
        death: death(4, 7), // 7 frames on the sheet (… RESIST, FALL, COLLAPSE …)
        attack: clip(5, 6, [{ frame: 4, event: 'DAMAGE', name: 'SAVAGE_BITE_DAMAGE' }]),
        howl: {
          row: 6, frames: 8, frameMs: 90, castDriven: true,
          events: [
            { frame: 2, event: 'CAST_START', name: 'HOWL_CAST_START' },
            { frame: 5, event: 'SKILL_ACTIVATE', name: 'ALPHA_HOWL_ACTIVATED' },
          ],
        },
      },
    },
  },

  // ---- Stage 4–10 (mock visuals, data in monsters-stage4-10.ts)
  ...STAGE4_10_MONSTERS,
  // ---- Skill Trial only (monsters-trials.ts)
  ...TRIAL_MONSTERS,
  ...FARM_MONSTERS,
};

// ------------------------------------------------------------------ helpers (pure)

/** seconds from clip start to the first frame carrying `event` (null if the clip has none) */
export function clipEventTime(anim: AnimationConfig, clipName: string, event: SemanticEvent): number | null {
  const c = anim.clips[clipName];
  const mark = c?.events?.find(e => e.event === event);
  return c && mark ? ((mark.frame - 1) * c.frameMs) / 1000 : null;
}

export function clipDuration(anim: AnimationConfig, clipName: string): number {
  const c = anim.clips[clipName];
  return c ? (c.frames * c.frameMs) / 1000 : 0;
}

/** gameplay windup of the normal attack: the animation event when present, else the stat */
export function attackWindupOf(def: MonsterDefinition): number {
  return clipEventTime(def.animation, def.attack.clip, def.attack.event) ?? def.stats.attackWindup;
}

/** semantic name of the attack's resolving event (e.g. BITE_DAMAGE) */
export function attackEventName(def: MonsterDefinition): string {
  return def.animation.clips[def.attack.clip]?.events?.find(e => e.event === def.attack.event)?.name ?? def.attack.event;
}

/**
 * Cast timeline, all relative to cast start (seconds):
 * - character: CAST_START frame is shown at 0, SKILL_ACTIVATE frame at castTime (frames between are stretched)
 * - FX: starts early so that its activation frame is on screen exactly at castTime
 */
export function castTimeline(skill: MonsterSkillDefinition, anim: AnimationConfig) {
  const c = skill.clip ? anim.clips[skill.clip] : undefined;
  const startFrame = c?.events?.find(e => e.event === 'CAST_START')?.frame ?? 1;
  const activateFrame = c?.events?.find(e => e.event === 'SKILL_ACTIVATE')?.frame ?? c?.frames ?? 1;
  const perFrame = activateFrame > startFrame ? skill.castTime / (activateFrame - startFrame) : 0;
  const characterActivation = (activateFrame - startFrame) * perFrame;
  const fxStart = skill.fx ? skill.castTime - ((skill.fx.activationFrame - 1) * skill.fx.frameMs) / 1000 : null;
  const fxActivation = skill.fx && fxStart != null ? fxStart + ((skill.fx.activationFrame - 1) * skill.fx.frameMs) / 1000 : null;
  return { startFrame, activateFrame, perFrame, characterActivation, fxStart, fxActivation, activation: skill.castTime };
}
