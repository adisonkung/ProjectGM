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
import { FOREST_ARC_MONSTERS, FOREST_ARC_SKILLS } from './monsters-forest-arc';
import { LEGACY_TOWER_MONSTERS } from './legacy-tower-monsters';
import { TRIAL_MONSTERS, TRIAL_SKILLS } from './monsters-trials';
import { FARM_MONSTERS, FARM_SKILLS } from './monsters-farm';
import { DUNGEON_MONSTERS, DUNGEON_PROJECTILES, DUNGEON_SKILLS, dungeonVariants } from './monsters-dungeon';

/**
 * Data-driven monsters. Tower Stages 1–10 = the Forest Arc roster (monsters-forest-arc.ts, spec
 * claude/eldervane-monster-spec-s1-10.md) + Forest Slime below (existing art, spec LOCKED). The pre-spec tower roster
 * lives in legacy-tower-monsters.ts (dungeon stat sources + test fixture only, never registered here).
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
  alpha_pack_command: STATUS_EFFECTS['alpha_pack_command'],
  dark_chant_buff: STATUS_EFFECTS['dark_chant_buff'],
  rally_haste: STATUS_EFFECTS['rally_haste'],
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
  ...DUNGEON_PROJECTILES,
};

// ------------------------------------------------------------------ monster skills (cast system)

export const MONSTER_SKILLS: Record<string, MonsterSkillDefinition> = {
  ...FOREST_ARC_SKILLS,
  ...TRIAL_SKILLS,
  ...FARM_SKILLS,
  ...DUNGEON_SKILLS,
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
      // Forest Arc spec (LOCKED): the existing slime, drawn smaller. 0.8 = PROVISIONAL (exact multiplier TBD)
      displayScale: 0.8,
      clips: {
        idle: clip(1, 4, [], 150),
        move: clip(2, 6),
        hurt: clip(3, 3),
        death: death(4, 6),
        attack: clip(5, 6, [{ frame: 5, event: 'DAMAGE', name: 'BODY_SLAM_DAMAGE' }]),
      },
    },
  },

  // ---- Forest Arc, tower Stages 1–10 (round mocks until art arrives)
  ...FOREST_ARC_MONSTERS,
  // ---- Skill Trial only (monsters-trials.ts)
  ...TRIAL_MONSTERS,
  ...FARM_MONSTERS,
  // ---- special-dungeon rosters (monsters-dungeon.ts)
  ...DUNGEON_MONSTERS,
};
// role / tier variants of the dungeon monsters (same art + skills, the power of the monster they replace)
// stat sources = the legacy tower roster (user 2026-11-05: dungeons keep their old power) + everything registered
Object.assign(MONSTERS, dungeonVariants(MONSTERS, { ...MONSTERS, ...LEGACY_TOWER_MONSTERS }));

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
