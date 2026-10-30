import { MonsterDefinition, MonsterSkillDefinition } from '../models/monster';

/** Supplied Jadecrest replacement, user-reviewed S1 V4 / charge+S2 V5 / S3 V6. Kit numbers remain provisional. */
export const JADECREST_SKILLS: Record<string, MonsterSkillDefinition> = {
  jadecrest_stomp: {
    id: 'jadecrest_stomp', name: 'อุ้งเท้าสะเทือนปฐพี', label: 'JADE EARTH STOMP', type: 'ATTACK',
    castTime: 1.3, cooldown: 13, firstCastDelay: 3, interruptible: false, range: 3,
    clip: 'stomp', target: { type: 'CURRENT_TARGET' },
    effects: [{ type: 'DAMAGE', mul: 1.2, area: 'FRONT_RECT_2X3', center: 'SELF' }],
    conditions: [{ type: 'ENEMY_WITHIN', range: 3 }], recovery: .8, interruptRecovery: .3,
    mockFx: { color: '#8df5bb', area: 'FRONT_RECT_2X3' }, hitFx: 'jc-contact',
  },
  jadecrest_pounce: {
    id: 'jadecrest_pounce', name: 'กระโดดตะปบหยก', label: 'JADE POUNCE', type: 'ATTACK',
    castTime: 1.8, leapTravel: .6, cooldown: 16, firstCastDelay: 7, interruptible: false, range: 10,
    clip: 'pounce', target: { type: 'CURRENT_TARGET' },
    effects: [{ type: 'LEAP_BEHIND' }, { type: 'DAMAGE', mul: 1.3, area: 'RADIUS_2', center: 'SELF' }],
    conditions: [{ type: 'ENEMY_WITHIN', range: 10 }], recovery: .8, interruptRecovery: .3,
    mockFx: { color: '#a6ffe0', area: 'RADIUS_2' }, hitFx: 'jc-contact',
  },
  jadecrest_roar: {
    id: 'jadecrest_roar', name: 'คำรามพิทักษ์หยก', label: 'JADE GUARDIAN ROAR', type: 'ATTACK',
    castTime: 1.05, cooldown: 14, firstCastDelay: 12, interruptible: false, breakRequired: 100,
    brokenStatus: 'broken', interruptPriority: 'HIGH', range: 3,
    clip: 'roar', target: { type: 'CURRENT_TARGET' },
    effects: [{ type: 'DAMAGE', mul: 1, area: 'FRONT_RECT_2X3', center: 'SELF' },
      { type: 'APPLY_STATUS', status: 'stun', to: 'HIT', duration: .8 }],
    conditions: [{ type: 'ENEMY_WITHIN', range: 3 }], recovery: 1.7, interruptRecovery: 0,
    mockFx: { color: '#92efc1', area: 'FRONT_RECT_2X3' }, hitFx: 'jc-contact',
  },
};
export const JADECREST_GUARDIAN: MonsterDefinition = {
  id: 'jadecrest_guardian', name: 'พยัคฆ์พิทักษ์หยก', rank: 'BOSS', role: 'BOSS DUEL / STOMP / POUNCE',
  tags: ['beast', 'ascension'], displayClass: 'fighter', immune: ['KNOCKBACK', 'STUN'],
  // Retain the outgoing second guardian's base HP/ATK/DEF and tier multipliers; no balance pass.
  stats: { maxHp: 20000, attack: 100, defense: 24, moveSpeed: 2.4, attackRange: 1.5, preferredRange: 1.3,
    attackCooldown: 1.4, attackWindup: .4, attackRecovery: .25, targetThinkInterval: .3,
    hitReactionDuration: .1, minHitReactionInterval: 3, collisionRadius: .7,
    footprint: { cols: 3, rows: 2, anchorC: 1, anchorR: 1 }, bodyBlock: true },
  ai: { targeting: { strategy: 'NEAREST_REACHABLE_FRONT', targetLockDuration: 1.5 }, movement: 'MELEE_CHASE',
    skillPriority: ['jadecrest_roar', 'jadecrest_pounce', 'jadecrest_stomp'], holdArena: { leash: 0, returnAfter: 2.5 } },
  attack: { id: 'jadecrest_claw', damageType: 'PHYSICAL', damageMultiplier: 1.1, delivery: 'MELEE',
    clip: 'attack', event: 'DAMAGE', hitTolerance: .35 },
  skills: ['jadecrest_stomp', 'jadecrest_pounce', 'jadecrest_roar'],
  animation: { sheet: 'enemy-jadecrest-guardian.png', cellW: 320, cellH: 280, clips: {
    idle: { row: 1, frames: 24, frameMs: 85 }, move: { row: 2, frames: 32, frameMs: 60 },
    hurt: { row: 3, frames: 6, frameMs: 30 }, death: { row: 4, frames: 28, frameMs: 70 },
    attack: { row: 5, frames: 14, frameMs: 50, events: [{ frame: 9, event: 'DAMAGE', name: 'CLAW_CONTACT' }] },
    stomp: { row: 6, frames: 36, frameMs: 50, castDriven: true,
      events: [{ frame: 1, event: 'CAST_START', name: 'STOMP_CHARGE' }, { frame: 21, event: 'SKILL_ACTIVATE', name: 'STOMP_CONTACT' }] },
    pounce: { row: 7, frames: 40, frameMs: 50, castDriven: true,
      events: [{ frame: 1, event: 'CAST_START', name: 'POUNCE_CROUCH' }, { frame: 25, event: 'SKILL_ACTIVATE', name: 'POUNCE_LANDING' }] },
    roar: { row: 8, frames: 50, frameMs: 50, castDriven: true,
      events: [{ frame: 1, event: 'CAST_START', name: 'ROAR_CHARGE' }, { frame: 17, event: 'SKILL_ACTIVATE', name: 'ROAR_RELEASE' }] },
    broken: { row: 9, frames: 30, frameMs: 100, castDriven: true,
      events: [{ frame: 1, event: 'CAST_START', name: 'JADE_STAGGER' }, { frame: 1, event: 'SKILL_ACTIVATE', name: 'JADE_STAGGER' }] },
  } },
};
