import { MonsterDefinition, MonsterSkillDefinition, MonsterStats } from '../models/monster';

/**
 * Farm-dungeon roster (Phase 3 special modes) — pure data like Stage 4–10:
 *   Ascension I–III = BOSS DUEL guardians (one boss, one lesson each)
 *     I   Stone Sentinel   — interrupt STONE SKIN (or fight through −60 % damage)
 *     II  Pack Lord        — interrupt LORD'S HOWL (wolves + Pack Fury while they live), dives the back row
 *     III Ancient Colossus — BREAK Colossal Ruin (100, two breakers), seal phase with spirit adds
 *   Equipment Hunt = TREASURE CHASE carriers (FLEE: hold, then run for the edge when hit / after a while)
 * Mock visuals (visuals.ts) until art exists.
 */
const mock = { clips: {} };

const base = (o: Partial<MonsterStats> & Pick<MonsterStats, 'maxHp' | 'attack' | 'defense' | 'moveSpeed' | 'attackRange' | 'attackCooldown'>): MonsterStats => ({
  preferredRange: Math.max(0.8, o.attackRange - 0.2),
  attackWindup: 0.35,
  attackRecovery: 0.25,
  targetThinkInterval: 0.3,
  hitReactionDuration: 0.1,
  minHitReactionInterval: 3,
  collisionRadius: 0.6,
  ...o,
});

export const FARM_SKILLS: Record<string, MonsterSkillDefinition> = {
  // ---- Ascension I — Stone Sentinel
  sentinel_slam: {
    id: 'sentinel_slam', name: 'ทุบศิลา', label: 'SENTINEL SLAM', type: 'ATTACK',
    castTime: 1.2, cooldown: 7, interruptible: false, range: 2,
    target: { type: 'CURRENT_TARGET' },
    effects: [
      { type: 'DAMAGE', mul: 1.5, area: 'FRONT_ARC', center: 'SELF' },
      { type: 'APPLY_STATUS', status: 'stun', to: 'HIT', duration: 1 },
    ],
    mockFx: { color: '#b0a080', area: 'FRONT_ARC' },
    conditions: [{ type: 'ENEMY_WITHIN', range: 2 }], recovery: 0.4, interruptRecovery: 0.5,
  },
  stone_skin: {
    id: 'stone_skin', name: 'ผิวศิลา', label: 'STONE SKIN', type: 'BUFF',
    castTime: 2.5, cooldown: 14, interruptible: true, interruptPriority: 'HIGH', firstCastDelay: 6,
    target: { type: 'SELF' },
    effects: [{ type: 'APPLY_STATUS', status: 'stone_skin', to: 'SELF' }],
    mockFx: { color: '#d8c8a0', area: 'RADIUS_2' },
    conditions: [{ type: 'SELF_LACKS_STATUS', status: 'stone_skin' }], recovery: 0.3, interruptRecovery: 0.8,
  },

  // ---- Ascension II — Pack Lord
  lords_howl: {
    id: 'lords_howl', name: 'เสียงเรียกราชันฝูง', label: "LORD'S HOWL", type: 'SUMMON',
    castTime: 2.5, cooldown: 13, interruptible: true, interruptPriority: 'CRITICAL', firstCastDelay: 4,
    target: { type: 'SELF' },
    effects: [{ type: 'SUMMON', monsters: [{ id: 'forest_wolf', count: 2 }], maxActive: 3, grantWhileAlive: 'pack_fury' }],
    mockFx: { color: '#c0c8ff', area: 'RADIUS_2' },
    conditions: [{ type: 'SUMMON_SLOTS_FREE' }], recovery: 0.4, interruptRecovery: 0.8,
  },
  lord_pounce: {
    id: 'lord_pounce', name: 'ตะครุบคอ', label: 'POUNCE', type: 'MOVEMENT',
    castTime: 0.7, cooldown: 10, interruptible: false, range: 8, firstCastDelay: 7,
    target: { type: 'HERO_PRIORITY', classes: ['healer', 'mage', 'archer'], backRowOnly: true },
    effects: [
      { type: 'LEAP_BEHIND' },
      { type: 'DAMAGE', mul: 1.5, area: 'SINGLE', center: 'TARGET' },
      { type: 'APPLY_STATUS', status: 'bleed', to: 'TARGET' },
    ],
    conditions: [], recovery: 0.3, interruptRecovery: 0.4,
  },

  // ---- Ascension III — Ancient Colossus
  quake_stomp: {
    id: 'quake_stomp', name: 'กระทืบธรณี', label: 'QUAKE STOMP', type: 'ATTACK',
    castTime: 1, cooldown: 8, interruptible: false, firstCastDelay: 3,
    target: { type: 'SELF' },
    effects: [
      { type: 'DAMAGE', mul: 1.2, area: 'RADIUS_2', center: 'SELF' },
      { type: 'APPLY_STATUS', status: 'root', to: 'HIT', duration: 1.5 },
    ],
    mockFx: { color: '#a08060', area: 'RADIUS_2' },
    conditions: [{ type: 'ENEMY_WITHIN', range: 2 }], recovery: 0.4, interruptRecovery: 0.5,
  },
  colossal_ruin: {
    id: 'colossal_ruin', name: 'มหาวินาศ', label: 'COLOSSAL RUIN', type: 'ATTACK',
    castTime: 5, cooldown: 16, interruptible: false, interruptPriority: 'CRITICAL', breakRequired: 100, brokenStatus: 'broken', firstCastDelay: 8,
    target: { type: 'ALL_HEROES' },
    effects: [{ type: 'DAMAGE', mul: 2, area: 'ALL_ENEMIES', center: 'SELF', damageType: 'MAGIC' }],
    mockFx: { color: '#ff7a3a', area: 'ALL_ENEMIES' },
    conditions: [], recovery: 0.6, interruptRecovery: 0,
  },
};

export const FARM_MONSTERS: Record<string, MonsterDefinition> = {
  stone_sentinel: {
    id: 'stone_sentinel', name: 'ศิลาผู้พิทักษ์', rank: 'BOSS', role: 'BOSS DUEL / INTERRUPT CHECK', tags: ['golem', 'ascension'],
    displayClass: 'tank', visual: 'mock_stone_sentinel', immune: ['KNOCKBACK', 'STUN'],
    stats: base({ maxHp: 15000, attack: 80, defense: 34, moveSpeed: 1.1, attackRange: 1.5, attackCooldown: 1.9 }),
    ai: { targeting: { strategy: 'NEAREST_REACHABLE_FRONT', targetLockDuration: 2 }, movement: 'MELEE_CHASE', skillPriority: ['stone_skin', 'sentinel_slam'] },
    attack: { id: 'stone_fist', damageType: 'PHYSICAL', damageMultiplier: 1.1, delivery: 'MELEE', clip: 'attack', event: 'DAMAGE', hitTolerance: 0.5 },
    skills: ['stone_skin', 'sentinel_slam'], animation: mock,
    phases: [
      // ≤ 50 %: faster fists, two slimes crawl out of the rubble, Stone Skin comes back sooner
      {
        id: 'crumbling_fury', label: 'หินแตกคลั่ง', hpBelow: 0.5, transition: 1, statuses: ['sentinel_fury'],
        summon: [{ id: 'forest_slime', count: 2 }], cooldownOverride: { stone_skin: 11 },
      },
    ],
  },
  pack_lord: {
    id: 'pack_lord', name: 'ราชันฝูงหมาป่า', rank: 'BOSS', role: 'BOSS DUEL / SUMMONER / DIVER', tags: ['wolf', 'ascension'],
    displayClass: 'assassin', visual: 'mock_pack_lord', immune: ['KNOCKBACK'],
    stats: base({ maxHp: 20000, attack: 105, defense: 26, moveSpeed: 3.2, attackRange: 1.3, attackCooldown: 1.3, attackWindup: 0.25, targetThinkInterval: 0.25 }),
    ai: { targeting: { strategy: 'NEAREST_REACHABLE_FRONT', targetLockDuration: 1.5 }, movement: 'MELEE_CHASE', skillPriority: ['lords_howl', 'lord_pounce'] },
    attack: { id: 'lord_bite', damageType: 'PHYSICAL', damageMultiplier: 1, delivery: 'MELEE', clip: 'attack', event: 'DAMAGE', hitTolerance: 0.4 },
    skills: ['lords_howl', 'lord_pounce'], animation: mock,
    phases: [
      { id: 'blood_moon', label: 'จันทร์สีเลือด', hpBelow: 0.5, transition: 1, statuses: ['lord_frenzy'], cooldownOverride: { lords_howl: 10 } },
    ],
  },
  ancient_colossus: {
    id: 'ancient_colossus', name: 'ยักษ์ศิลาโบราณ', rank: 'BOSS', role: 'BOSS DUEL / BREAK CHECK', tags: ['golem', 'ascension'],
    displayClass: 'tank', visual: 'mock_ancient_colossus', immune: ['KNOCKBACK', 'STUN', 'ROOT'],
    stats: base({ maxHp: 24000, attack: 125, defense: 40, moveSpeed: 1.0, attackRange: 2, attackCooldown: 2, attackWindup: 0.45, collisionRadius: 0.8 }),
    ai: { targeting: { strategy: 'NEAREST_REACHABLE_FRONT', targetLockDuration: 2.5 }, movement: 'MELEE_CHASE', skillPriority: ['colossal_ruin', 'quake_stomp'] },
    attack: { id: 'colossus_smash', damageType: 'PHYSICAL', damageMultiplier: 1.15, delivery: 'MELEE', clip: 'attack', event: 'DAMAGE', hitTolerance: 0.5 },
    skills: ['colossal_ruin', 'quake_stomp'], animation: mock,
    phases: [
      // ≤ 60 %: sealed behind two spirits (untargetable, pulses) until they fall
      {
        id: 'spirit_seal', label: 'ผนึกวิญญาณ', hpBelow: 0.6, interruptSelf: true, transition: 1,
        summon: [{ id: 'forest_spirit', count: 2 }], seal: { pulseEvery: 3, pulseAtkPct: 0.35, pulseName: 'SEAL PULSE' },
      },
      { id: 'last_stand', label: 'ยืนหยัดสุดท้าย', hpBelow: 0.25, transition: 1, statuses: ['sentinel_fury'], cooldownOverride: { colossal_ruin: 12 } },
    ],
  },

  // ---- Equipment Hunt: treasure carriers (never attack; the loot is only yours if you catch them)
  treasure_goblin: {
    id: 'treasure_goblin', name: 'ก็อบลินขนสมบัติ', rank: 'SPECIAL', role: 'TREASURE / FLEES', tags: ['goblin', 'treasure'],
    displayClass: 'assassin', visual: 'mock_treasure_goblin', immune: ['KNOCKBACK'],
    stats: base({ maxHp: 380, attack: 1, defense: 14, moveSpeed: 0.6, attackRange: 1, attackCooldown: 9, collisionRadius: 0.4, minHitReactionInterval: 1.5 }),
    ai: { targeting: { strategy: 'NEAREST_REACHABLE_FRONT', targetLockDuration: 1 }, movement: 'FLEE', flee: { after: 20, onHit: true } },
    attack: { id: 'none', damageType: 'PHYSICAL', damageMultiplier: 0, delivery: 'MELEE', clip: 'attack', event: 'DAMAGE', hitTolerance: 0 },
    skills: [], animation: mock,
  },
  treasure_goblin_elite: {
    id: 'treasure_goblin_elite', name: 'ก็อบลินขนสมบัติหัวหน้า', rank: 'SPECIAL', role: 'TREASURE / FLEES', tags: ['goblin', 'treasure'],
    displayClass: 'assassin', visual: 'mock_treasure_goblin_elite', immune: ['KNOCKBACK'],
    stats: base({ maxHp: 650, attack: 1, defense: 20, moveSpeed: 0.6, attackRange: 1, attackCooldown: 9, collisionRadius: 0.45, minHitReactionInterval: 1.5 }),
    ai: { targeting: { strategy: 'NEAREST_REACHABLE_FRONT', targetLockDuration: 1 }, movement: 'FLEE', flee: { after: 20, onHit: true } },
    attack: { id: 'none', damageType: 'PHYSICAL', damageMultiplier: 0, delivery: 'MELEE', clip: 'attack', event: 'DAMAGE', hitTolerance: 0 },
    skills: [], animation: mock,
  },
};
