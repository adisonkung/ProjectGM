import { MonsterDefinition, MonsterSkillDefinition } from '../models/monster';

/** User-approved replacement of the first Ascension guardian; provisional kit, same base HP/ATK/DEF as Shishi. */
export const AEGIS_SKILLS: Record<string, MonsterSkillDefinition> = {
  aegis_guard: {
    id: 'aegis_guard', name: 'ตั้งโล่พิทักษ์', label: 'AEGIS GUARD', type: 'BUFF',
    castTime: 2.5, cooldown: 20, firstCastDelay: 4, interruptible: true, interruptPriority: 'HIGH',
    clip: 'guard', target: { type: 'SELF' }, effects: [{ type: 'APPLY_STATUS', status: 'aegis_guard', to: 'SELF' }],
    conditions: [{ type: 'SELF_LACKS_STATUS', status: 'aegis_guard' }], recovery: .3, interruptRecovery: .5,
  },
  aegis_lance: {
    id: 'aegis_lance', name: 'ทวนแสงทะลวงแนว', label: 'PIERCING LIGHT LANCE', type: 'ATTACK',
    castTime: 1.8, cooldown: 13, firstCastDelay: 2, interruptible: false, range: 16,
    clip: 'lance', target: { type: 'CURRENT_TARGET' },
    effects: [{ type: 'DAMAGE', mul: 1.2, area: 'FRONT_BEAM_3', center: 'SELF', damageType: 'MAGIC' }],
    conditions: [{ type: 'ENEMY_WITHIN', range: 16 }], recovery: .96, interruptRecovery: .4,
    mockFx: { color: '#5ddfff', area: 'FRONT_BEAM_3' }, hitFx: 'ae-s2-impact',
  },
  aegis_judgement: {
    id: 'aegis_judgement', name: 'คำพิพากษาแห่งประตู', label: 'GATE JUDGEMENT', type: 'ATTACK',
    castTime: 3, cooldown: 18, firstCastDelay: 14, interruptible: false, interruptPriority: 'CRITICAL', breakRequired: 100,
    brokenStatus: 'broken', clip: 'judgement', target: { type: 'SELF' },
    effects: [{ type: 'DAMAGE', mul: 1.5, area: 'FRONT_RECT_3X2', center: 'SELF' }],
    conditions: [{ type: 'ENEMY_WITHIN', range: 3 }], recovery: .78, interruptRecovery: 0,
    mockFx: { color: '#efc66d', area: 'FRONT_RECT_3X2' }, hitFx: 'ae-s3-impact',
  },
};

export const AEGIS_SENTINEL: MonsterDefinition = {
  id: 'aegis_sentinel', name: 'ผู้พิทักษ์ตราปฐม', rank: 'BOSS', role: 'BOSS DUEL / GUARD / BREAK CHECK',
  tags: ['construct', 'ascension'], displayClass: 'tank', immune: ['KNOCKBACK', 'STUN'],
  stats: { footprint: { cols: 3, rows: 2, anchorC: 1, anchorR: 1 }, bodyBlock: true,
    maxHp: 20000, attack: 85, defense: 30, moveSpeed: 1.6, attackRange: 1.5, preferredRange: 1.3,
    attackCooldown: 1.9, attackWindup: .3, attackRecovery: .25, targetThinkInterval: .3,
    hitReactionDuration: .1, minHitReactionInterval: 3, collisionRadius: .8 },
  ai: { targeting: { strategy: 'NEAREST_REACHABLE_FRONT', targetLockDuration: 2 }, movement: 'MELEE_CHASE',
    skillPriority: ['aegis_judgement', 'aegis_guard', 'aegis_lance'], holdArena: { leash: 0, returnAfter: 0 } },
  attack: { id: 'aegis_thrust', damageType: 'PHYSICAL', damageMultiplier: 1.1, delivery: 'MELEE',
    clip: 'attack', event: 'DAMAGE', hitTolerance: .35 },
  skills: ['aegis_guard', 'aegis_lance', 'aegis_judgement'],
  animation: { sheet: 'enemy-aegis-sentinel.png', cellW: 340, cellH: 280, clips: {
    idle: { row: 1, frames: 24, frameMs: 85 }, move: { row: 2, frames: 24, frameMs: 60 },
    hurt: { row: 3, frames: 6, frameMs: 30 }, death: { row: 4, frames: 20, frameMs: 70 },
    attack: { row: 5, frames: 12, frameMs: 50, events: [{ frame: 7, event: 'DAMAGE', name: 'LANCE_THRUST' }] },
    guard: { row: 6, frames: 11, frameMs: 50, castDriven: true,
      events: [{ frame: 1, event: 'CAST_START', name: 'GUARD_WINDUP' }, { frame: 6, event: 'SKILL_ACTIVATE', name: 'GUARD_ACTIVE' }] },
    lance: { row: 7, frames: 24, frameMs: 80, castDriven: true,
      events: [{ frame: 1, event: 'CAST_START', name: 'LANCE_WINDUP' }, { frame: 13, event: 'SKILL_ACTIVATE', name: 'LANCE_RELEASE' }] },
    judgement: { row: 8, frames: 24, frameMs: 65, castDriven: true,
      events: [{ frame: 1, event: 'CAST_START', name: 'JUDGEMENT_WINDUP' }, { frame: 13, event: 'SKILL_ACTIVATE', name: 'JUDGEMENT_CONTACT' }] },
    // Optional presentation-only break clip; gameplay BROKEN still owns the three-second stun.
    broken: { row: 9, frames: 20, frameMs: 150, castDriven: true,
      events: [{ frame: 1, event: 'CAST_START', name: 'CORE_EXPOSED' }, { frame: 1, event: 'SKILL_ACTIVATE', name: 'CORE_EXPOSED' }] },
  } },
};
