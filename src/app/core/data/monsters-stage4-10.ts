import { MonsterDefinition, MonsterSkillDefinition, MonsterStats } from '../models/monster';

/**
 * Stage 4–10 roster (Enchanted Grove → Heart of the Dark Forest).
 * Pure data read by the shared systems (MonsterController, cast system, statuses, phases) — no monster code.
 * These monsters have no sprite sheets yet: `visual` points at a mock shape in visuals.ts, `animation.clips` is empty
 * (attack timing falls back to `attackWindup`). Swapping in art later changes only the visual/animation data.
 *
 * Normal monsters carry one important mechanic, elites 1–2, bosses several + phases.
 */

const mock = { clips: {} };

/** shared defaults for the new monsters (timings of a generic swing / shot) */
const base = (o: Partial<MonsterStats> & Pick<MonsterStats, 'maxHp' | 'attack' | 'defense' | 'moveSpeed' | 'attackRange' | 'attackCooldown'>): MonsterStats => ({
  preferredRange: o.attackRange > 2 ? o.attackRange - 1 : Math.max(0.8, o.attackRange - 0.2),
  attackWindup: 0.3,
  attackRecovery: 0.25,
  targetThinkInterval: 0.3,
  hitReactionDuration: 0.2,
  minHitReactionInterval: 0.8,
  collisionRadius: 0.4,
  ...o,
});

// ------------------------------------------------------------------ skills

export const STAGE4_10_SKILLS: Record<string, MonsterSkillDefinition> = {
  // Stage 4 — Magic Mushroom: the one mechanic is a cluster-seeking poison AoE
  poison_cloud: {
    id: 'poison_cloud', name: 'เมฆสปอร์พิษ', label: 'POISON CLOUD', type: 'ATTACK',
    castTime: 1.5, cooldown: 9, interruptible: true, range: 5,
    target: { type: 'HERO_CLUSTER', area: 'ADJACENT_8', min: 2 },
    effects: [
      { type: 'DAMAGE', mul: 0.8, area: 'ADJACENT_8', center: 'TARGET', damageType: 'MAGIC' },
      { type: 'APPLY_STATUS', status: 'poison', to: 'HIT' },
    ],
    mockFx: { color: '#7ee05a', area: 'ADJACENT_8' },
    conditions: [], recovery: 0.3, interruptRecovery: 0.6,
  },

  // Stage 5 — Shadow Panther: backline leap
  shadow_leap: {
    id: 'shadow_leap', name: 'กระโจนเงา', label: 'SHADOW LEAP', type: 'MOVEMENT',
    castTime: 0.6, cooldown: 10, interruptible: false, range: 7,
    target: { type: 'HERO_PRIORITY', classes: ['healer', 'mage', 'archer'], backRowOnly: true },
    effects: [
      { type: 'LEAP_BEHIND' },
      { type: 'DAMAGE', mul: 1.8, area: 'SINGLE', center: 'TARGET' },
      { type: 'APPLY_STATUS', status: 'panther_frenzy', to: 'SELF' },
    ],
    conditions: [], recovery: 0.2, interruptRecovery: 0.4,
  },

  // Stage 6 — Goblin Shaman: group heal (only when needed)
  healing_ritual: {
    id: 'healing_ritual', name: 'พิธีเยียวยา', label: 'HEALING RITUAL', type: 'SUPPORT',
    castTime: 3, cooldown: 11, interruptible: true, initialDelayRandom: 1,
    target: { type: 'ALL_ALLIES' },
    effects: [{ type: 'HEAL_PCT', pct: 0.2, to: 'ALL_ALLIES', excludeSummons: true }],
    mockFx: { color: '#8cff9c', area: 'ALL_ALLIES' },
    conditions: [{ type: 'ANY_OF', of: [{ type: 'ALLIES_BELOW', count: 2, pct: 0.7 }, { type: 'ELITE_ALLY_BELOW', pct: 0.5 }] }],
    recovery: 0.3, interruptRecovery: 0.6,
  },

  // Stage 7 — Elder Treant
  root_slam: {
    id: 'root_slam', name: 'รากกระแทก', label: 'ROOT SLAM', type: 'ATTACK',
    castTime: 1.5, cooldown: 8, interruptible: false, range: 2,
    target: { type: 'CURRENT_TARGET' },
    effects: [
      { type: 'DAMAGE', mul: 1.7, area: 'FRONT_ARC', center: 'SELF' },
      { type: 'APPLY_STATUS', status: 'root', to: 'HIT', duration: 2 },
    ],
    mockFx: { color: '#a0703a', area: 'FRONT_ARC' },
    conditions: [{ type: 'ENEMY_WITHIN', range: 2 }], recovery: 0.4, interruptRecovery: 0.6,
  },
  entangling_roots: {
    id: 'entangling_roots', name: 'รากพันธนาการ', label: 'ENTANGLING ROOTS', type: 'ATTACK',
    castTime: 2, cooldown: 10, interruptible: true,
    target: { type: 'HERO_PRIORITY', classes: ['healer', 'mage', 'archer'], backRowOnly: true },
    effects: [
      { type: 'DAMAGE', mul: 1, area: 'SINGLE', center: 'TARGET', damageType: 'MAGIC' },
      { type: 'APPLY_STATUS', status: 'root', to: 'TARGET', duration: 3 },
      { type: 'APPLY_STATUS', status: 'corruption', to: 'TARGET', duration: 3 },
    ],
    mockFx: { color: '#6b8f3a', area: 'SINGLE' },
    conditions: [], recovery: 0.3, interruptRecovery: 0.6,
  },
  call_of_the_forest: {
    id: 'call_of_the_forest', name: 'เสียงเรียกแห่งพงไพร', label: 'CALL OF THE FOREST', type: 'SUMMON',
    castTime: 3, cooldown: 14, interruptible: true,
    target: { type: 'SELF' },
    effects: [{ type: 'SUMMON', monsters: [{ id: 'forest_spirit', count: 2 }, { id: 'magic_mushroom', count: 1 }], maxActive: 3 }],
    mockFx: { color: '#5ec8e0', area: 'RADIUS_2' },
    conditions: [{ type: 'SUMMON_SLOTS_FREE' }], recovery: 0.4, interruptRecovery: 0.6,
  },

  // Stage 8 — Mist Wraith: untargetable dash + strike from behind (no cast bar: it is "instant")
  mist_form: {
    id: 'mist_form', name: 'ร่างหมอก', label: 'MIST FORM', type: 'MOVEMENT',
    castTime: 1.5, cooldown: 8, interruptible: false, untargetableWhileCasting: true,
    target: { type: 'CURRENT_TARGET' },
    effects: [
      { type: 'LEAP_BEHIND' },
      { type: 'DAMAGE', mul: 1.5, area: 'SINGLE', center: 'TARGET' },
    ],
    conditions: [{ type: 'SELF_LACKS_STATUS', status: 'untargetable' }], recovery: 0.2, interruptRecovery: 0.3,
  },

  // Stage 9 — Dark Shaman
  dark_heal: {
    id: 'dark_heal', name: 'เยียวยามืด', label: 'DARK HEAL', type: 'SUPPORT',
    castTime: 2, cooldown: 10, interruptible: true,
    target: { type: 'LOWEST_HP_ALLY', priorityBelow: 0.6 },
    effects: [{ type: 'HEAL_PCT', pct: 0.25, to: 'TARGET' }],
    mockFx: { color: '#b58cff', area: 'SINGLE' },
    conditions: [{ type: 'ANY_ALLY_BELOW', pct: 0.8 }], recovery: 0.3, interruptRecovery: 0.6,
  },
  soul_link: {
    id: 'soul_link', name: 'พันธะวิญญาณ', label: 'SOUL LINK', type: 'SUPPORT',
    castTime: 2.5, cooldown: 14, interruptible: true,
    target: { type: 'ALLY_DEFINITION_HIGHEST_HP', monsterId: 'corrupted_treant' },
    effects: [{ type: 'SOUL_LINK', status: 'soul_link' }],
    mockFx: { color: '#c78cff', area: 'SINGLE' },
    conditions: [{ type: 'ALLY_DEFINITION_ALIVE', monsterId: 'corrupted_treant', min: 1 }, { type: 'SELF_LACKS_STATUS', status: 'soul_link' }],
    recovery: 0.3, interruptRecovery: 0.6,
  },
  /** Stage 10 only (dark_shaman_ritual): once, 2 s after spawning */
  sacrifice: {
    id: 'sacrifice', name: 'บูชายัญ', label: 'SACRIFICE', type: 'SPECIAL',
    castTime: 5, cooldown: 999, interruptible: true, once: true, firstCastDelay: 2,
    target: { type: 'SELF' },
    effects: [{ type: 'SACRIFICE', bossHealPct: 0.2, buffId: 'guardian_empowered' }],
    mockFx: { color: '#ff3b3b', area: 'SINGLE' },
    conditions: [], recovery: 0, interruptRecovery: 0.6,
  },

  // Stage 9 — Mist Witch
  nightmare: {
    id: 'nightmare', name: 'ฝันร้าย', label: 'NIGHTMARE', type: 'ATTACK',
    castTime: 2.5, cooldown: 10, interruptible: true,
    target: { type: 'HIGHEST_ATK_HERO' },
    effects: [
      { type: 'DAMAGE', mul: 1, area: 'SINGLE', center: 'TARGET', damageType: 'MAGIC' },
      { type: 'APPLY_STATUS', status: 'stun', to: 'TARGET', duration: 3 },
    ],
    mockFx: { color: '#a06bff', area: 'SINGLE' },
    conditions: [], recovery: 0.3, interruptRecovery: 0.6,
  },
  dark_fog: {
    id: 'dark_fog', name: 'หมอกมืด', label: 'DARK FOG', type: 'SUPPORT',
    castTime: 1.5, cooldown: 16, interruptible: false,
    target: { type: 'ALL_HEROES' },
    effects: [{ type: 'APPLY_STATUS', status: 'dark_fog', to: 'ALL_HEROES' }],
    mockFx: { color: '#4b3a6b', area: 'ALL_ENEMIES' },
    conditions: [{ type: 'HEROES_NEED_STATUS', status: 'dark_fog', refreshBelow: 1 }], recovery: 0.3, interruptRecovery: 0.6,
  },

  // Stage 10 — The Fallen Forest Guardian
  corrupted_slam: {
    id: 'corrupted_slam', name: 'ทุบคำสาป', label: 'CORRUPTED SLAM', type: 'ATTACK',
    castTime: 1.5, cooldown: 7, interruptible: false, range: 2,
    target: { type: 'CURRENT_TARGET' },
    effects: [{ type: 'DAMAGE', mul: 1.9, area: 'FRONT_ARC', center: 'SELF' }],
    mockFx: { color: '#8b1a1a', area: 'FRONT_ARC' },
    conditions: [{ type: 'ENEMY_WITHIN', range: 2 }], recovery: 0.4, interruptRecovery: 0.6,
  },
  death_root: {
    id: 'death_root', name: 'รากมรณะ', label: 'DEATH ROOT', type: 'ATTACK',
    castTime: 2, cooldown: 9, interruptible: true,
    target: { type: 'HERO_PRIORITY', classes: ['healer', 'mage', 'archer'], backRowOnly: true },
    effects: [
      { type: 'DAMAGE', mul: 1.2, area: 'SINGLE', center: 'TARGET', damageType: 'MAGIC' },
      { type: 'APPLY_STATUS', status: 'root', to: 'TARGET', duration: 3 },
      { type: 'APPLY_STATUS', status: 'corruption', to: 'TARGET', duration: 4 },
    ],
    mockFx: { color: '#5a1a3a', area: 'SINGLE' },
    conditions: [], recovery: 0.3, interruptRecovery: 0.6,
  },
  /** Phase 4 only — not interruptible, but breakable (Break Gauge 100) */
  forest_oblivion: {
    id: 'forest_oblivion', name: 'พงไพรสูญสิ้น', label: 'FOREST OBLIVION', type: 'ATTACK',
    castTime: 6, cooldown: 12, interruptible: false, breakRequired: 100, brokenStatus: 'broken',
    target: { type: 'ALL_HEROES' },
    effects: [
      { type: 'DAMAGE', mul: 2.6, area: 'ALL_ENEMIES', center: 'SELF' },
      { type: 'APPLY_STATUS', status: 'healing_reduction', to: 'HIT', duration: 6 },
    ],
    mockFx: { color: '#ff2020', area: 'ALL_ENEMIES' },
    conditions: [], recovery: 0.5, interruptRecovery: 0,
  },
};

// ------------------------------------------------------------------ monsters

export const STAGE4_10_MONSTERS: Record<string, MonsterDefinition> = {
  magic_mushroom: {
    id: 'magic_mushroom', name: 'เห็ดเวทมนตร์', rank: 'COMMON', role: 'DEBUFFER / AREA CONTROL', tags: ['forest', 'mushroom'],
    displayClass: 'mage', visual: 'mock_magic_mushroom',
    stats: base({ maxHp: 135, attack: 30, defense: 8, moveSpeed: 1.4, attackRange: 4, preferredRange: 3.5, attackCooldown: 1.8, minComfortableRange: 2, rangeTolerance: 0.5 }),
    ai: { targeting: { strategy: 'NEAREST_REACHABLE_FRONT', targetLockDuration: 1.2 }, movement: 'RANGED_HOLD', maxRetreatSteps: 1 },
    attack: { id: 'spore_shot', damageType: 'MAGIC', damageMultiplier: 0.9, delivery: 'PROJECTILE', projectileId: 'spore_shot', clip: 'attack', event: 'PROJECTILE_SPAWN', hitTolerance: 0 },
    skills: ['poison_cloud'], animation: mock,
  },
  forest_spirit: {
    id: 'forest_spirit', name: 'ภูติป่า', rank: 'COMMON', role: 'MAGIC_RANGED_DPS', tags: ['forest', 'spirit'],
    displayClass: 'mage', visual: 'mock_forest_spirit',
    stats: base({ maxHp: 105, attack: 38, defense: 4, moveSpeed: 2.1, attackRange: 6, preferredRange: 5, attackCooldown: 1.6, defenseIgnore: 0.2, minComfortableRange: 2.5, rangeTolerance: 0.5 }),
    ai: { targeting: { strategy: 'LOWEST_EFFECTIVE_DEF', targetLockDuration: 1.2 }, movement: 'RANGED_HOLD', maxRetreatSteps: 1 },
    attack: { id: 'spirit_bolt', damageType: 'MAGIC', damageMultiplier: 1, delivery: 'PROJECTILE', projectileId: 'spirit_bolt', clip: 'attack', event: 'PROJECTILE_SPAWN', hitTolerance: 0 },
    skills: [], animation: mock,
  },
  shadow_panther: {
    id: 'shadow_panther', name: 'เสือดำเงา', rank: 'SPECIAL', role: 'ASSASSIN / BACKLINE DIVER', tags: ['beast'],
    displayClass: 'assassin', visual: 'mock_shadow_panther',
    stats: base({ maxHp: 175, attack: 42, defense: 12, moveSpeed: 4.8, attackRange: 1.2, attackCooldown: 1.25, attackWindup: 0.25, targetThinkInterval: 0.25 }),
    ai: { targeting: { strategy: 'CLASS_PRIORITY', classPriority: ['healer', 'mage', 'archer'], targetLockDuration: 1.5 }, movement: 'MELEE_CHASE', skillPriority: ['shadow_leap'] },
    attack: { id: 'panther_claw', damageType: 'PHYSICAL', damageMultiplier: 1, delivery: 'MELEE', clip: 'attack', event: 'DAMAGE', hitTolerance: 0.4 },
    skills: ['shadow_leap'], animation: mock,
  },
  goblin_guard: {
    id: 'goblin_guard', name: 'ก็อบลินองครักษ์', rank: 'COMMON', role: 'FRONTLINE_BODYGUARD', tags: ['goblin'],
    displayClass: 'tank', visual: 'mock_goblin_guard',
    stats: base({ maxHp: 220, attack: 33, defense: 24, moveSpeed: 2.0, attackRange: 1.2, attackCooldown: 1.6 }),
    ai: { targeting: { strategy: 'NEAREST_REACHABLE_FRONT', targetLockDuration: 1.2 }, movement: 'MELEE_CHASE' },
    attack: { id: 'heavy_chop', damageType: 'PHYSICAL', damageMultiplier: 1.1, delivery: 'MELEE', clip: 'attack', event: 'DAMAGE', hitTolerance: 0.3 },
    skills: [], animation: mock,
  },
  goblin_shaman: {
    id: 'goblin_shaman', name: 'ก็อบลินหมอผี', rank: 'SPECIAL', role: 'HEALER / SUPPORT', tags: ['goblin', 'caster'],
    displayClass: 'healer', visual: 'mock_goblin_shaman',
    stats: base({ maxHp: 145, attack: 35, defense: 10, moveSpeed: 1.8, attackRange: 6, preferredRange: 5.5, attackCooldown: 1.9, minComfortableRange: 3, rangeTolerance: 0.5 }),
    ai: { targeting: { strategy: 'NEAREST_REACHABLE_FRONT', targetLockDuration: 1.2 }, movement: 'RANGED_HOLD', maxRetreatSteps: 1 },
    attack: { id: 'hex_bolt', damageType: 'MAGIC', damageMultiplier: 0.9, delivery: 'PROJECTILE', projectileId: 'hex_bolt', clip: 'attack', event: 'PROJECTILE_SPAWN', hitTolerance: 0 },
    skills: ['healing_ritual'], animation: mock,
  },
  elder_treant: {
    id: 'elder_treant', name: 'ทรีแอนต์ผู้เฒ่า', rank: 'BOSS', role: 'TANK / CONTROL / SUMMONER', tags: ['treant', 'forest'],
    displayClass: 'tank', visual: 'mock_elder_treant', immune: ['KNOCKBACK', 'STUN'],
    stats: base({ maxHp: 1800, attack: 48, defense: 32, moveSpeed: 1.2, attackRange: 2, attackCooldown: 1.8, attackWindup: 0.45, hitReactionDuration: 0.1, minHitReactionInterval: 3, collisionRadius: 0.7 }),
    ai: {
      targeting: { strategy: 'NEAREST_REACHABLE_FRONT', targetLockDuration: 2.5 }, movement: 'MELEE_CHASE',
      skillPriority: ['call_of_the_forest', 'entangling_roots', 'root_slam'],
    },
    attack: { id: 'rooted_smash', damageType: 'PHYSICAL', damageMultiplier: 1.1, delivery: 'MELEE', clip: 'attack', event: 'DAMAGE', hitTolerance: 0.5 },
    skills: ['call_of_the_forest', 'entangling_roots', 'root_slam'], animation: mock,
    phases: [
      { id: 'enraged_forest', label: 'ป่าคลั่ง', hpBelow: 0.5, statuses: ['enraged_forest'], cooldownOverride: { call_of_the_forest: 10 } },
    ],
  },
  corrupted_wolf: {
    id: 'corrupted_wolf', name: 'หมาป่าวิปลาส', rank: 'COMMON', role: 'FAST_BLEED_MELEE', tags: ['wolf', 'corrupted'],
    displayClass: 'fighter', visual: 'mock_corrupted_wolf',
    stats: base({ maxHp: 165, attack: 38, defense: 10, moveSpeed: 4.4, attackRange: 1.2, attackCooldown: 1.1, attackWindup: 0.25, targetThinkInterval: 0.25 }),
    ai: { targeting: { strategy: 'NEAREST_REACHABLE_FRONT', targetLockDuration: 1.0 }, movement: 'MELEE_CHASE' },
    attack: {
      id: 'corrupted_bite', damageType: 'PHYSICAL', damageMultiplier: 1, delivery: 'MELEE', clip: 'attack', event: 'DAMAGE', hitTolerance: 0.4,
      onHitEveryN: { n: 3, status: 'bleed' },
    },
    skills: [], animation: mock,
  },
  mist_wraith: {
    id: 'mist_wraith', name: 'วิญญาณหมอก', rank: 'SPECIAL', role: 'ANTI_BACKLINE / EVASIVE', tags: ['mist'],
    displayClass: 'assassin', visual: 'mock_mist_wraith',
    stats: base({ maxHp: 125, attack: 45, defense: 5, moveSpeed: 3.0, attackRange: 1.3, attackCooldown: 1.4 }),
    ai: { targeting: { strategy: 'LOWEST_HP_PCT', preferBackRow: true, similarHpTolerance: 0.05, targetLockDuration: 1.5 }, movement: 'MELEE_CHASE', skillPriority: ['mist_form'] },
    attack: { id: 'mist_claw', damageType: 'PHYSICAL', damageMultiplier: 1, delivery: 'MELEE', clip: 'attack', event: 'DAMAGE', hitTolerance: 0.4 },
    skills: ['mist_form'], animation: mock,
  },
  corrupted_treant: {
    id: 'corrupted_treant', name: 'ทรีแอนต์วิปลาส', rank: 'COMMON', role: 'BODY_BLOCKER / TANK', tags: ['treant', 'corrupted'],
    displayClass: 'tank', visual: 'mock_corrupted_treant',
    stats: base({ maxHp: 420, attack: 42, defense: 38, moveSpeed: 0.9, attackRange: 1.5, attackCooldown: 2.1, attackWindup: 0.45, bodyBlock: true, collisionRadius: 0.6, minHitReactionInterval: 1.5 }),
    ai: { targeting: { strategy: 'NEAREST_REACHABLE_FRONT', targetLockDuration: 1.5 }, movement: 'MELEE_CHASE' },
    attack: { id: 'heavy_branch', damageType: 'PHYSICAL', damageMultiplier: 1.3, delivery: 'MELEE', clip: 'attack', event: 'DAMAGE', hitTolerance: 0.4 },
    skills: [], animation: mock,
  },
  dark_shaman: {
    id: 'dark_shaman', name: 'หมอผีมืด', rank: 'ELITE', role: 'HEALER / LINK SUPPORT', tags: ['caster', 'dark'],
    displayClass: 'healer', visual: 'mock_dark_shaman',
    stats: base({ maxHp: 190, attack: 42, defense: 14, moveSpeed: 1.7, attackRange: 6, preferredRange: 5.5, attackCooldown: 1.8, minComfortableRange: 3, rangeTolerance: 0.5 }),
    ai: { targeting: { strategy: 'NEAREST_REACHABLE_FRONT', targetLockDuration: 1.2 }, movement: 'RANGED_HOLD', maxRetreatSteps: 1, skillPriority: ['dark_heal', 'soul_link'] },
    attack: { id: 'dark_bolt', damageType: 'MAGIC', damageMultiplier: 1, delivery: 'PROJECTILE', projectileId: 'dark_bolt', clip: 'attack', event: 'PROJECTILE_SPAWN', hitTolerance: 0 },
    skills: ['dark_heal', 'soul_link'], animation: mock,
  },
  /** Stage 10 variant: the Guardian's shaman also knows SACRIFICE */
  dark_shaman_ritual: {
    id: 'dark_shaman_ritual', name: 'หมอผีมืด (พิธีบูชายัญ)', rank: 'ELITE', role: 'SACRIFICE SUPPORT', tags: ['caster', 'dark'],
    displayClass: 'healer', visual: 'mock_dark_shaman',
    stats: base({ maxHp: 190, attack: 42, defense: 14, moveSpeed: 1.7, attackRange: 6, preferredRange: 5.5, attackCooldown: 1.8, minComfortableRange: 3, rangeTolerance: 0.5 }),
    ai: { targeting: { strategy: 'NEAREST_REACHABLE_FRONT', targetLockDuration: 1.2 }, movement: 'RANGED_HOLD', maxRetreatSteps: 1, skillPriority: ['sacrifice', 'dark_heal', 'soul_link'] },
    attack: { id: 'dark_bolt', damageType: 'MAGIC', damageMultiplier: 1, delivery: 'PROJECTILE', projectileId: 'dark_bolt', clip: 'attack', event: 'PROJECTILE_SPAWN', hitTolerance: 0 },
    skills: ['sacrifice', 'dark_heal', 'soul_link'], animation: mock,
  },
  mist_witch: {
    id: 'mist_witch', name: 'แม่มดหมอก', rank: 'SPECIAL', role: 'CONTROL / DEBUFF', tags: ['caster', 'mist'],
    displayClass: 'mage', visual: 'mock_mist_witch',
    stats: base({ maxHp: 155, attack: 48, defense: 9, moveSpeed: 1.8, attackRange: 6, preferredRange: 5.5, attackCooldown: 1.9, minComfortableRange: 3, rangeTolerance: 0.5 }),
    ai: { targeting: { strategy: 'NEAREST_REACHABLE_FRONT', targetLockDuration: 1.2 }, movement: 'RANGED_HOLD', maxRetreatSteps: 1, skillPriority: ['nightmare', 'dark_fog'] },
    attack: { id: 'dark_bolt', damageType: 'MAGIC', damageMultiplier: 1, delivery: 'PROJECTILE', projectileId: 'dark_bolt', clip: 'attack', event: 'PROJECTILE_SPAWN', hitTolerance: 0 },
    skills: ['nightmare', 'dark_fog'], animation: mock,
  },
  fallen_forest_guardian: {
    id: 'fallen_forest_guardian', name: 'ผู้พิทักษ์พงไพรที่ล่มสลาย', rank: 'FINAL_BOSS', role: 'CONTROL / SUMMONER / EXECUTION CHECK', tags: ['boss', 'forest'],
    displayClass: 'tank', visual: 'mock_fallen_guardian', immune: ['KNOCKBACK', 'TAUNT', 'ROOT'],
    stats: base({ maxHp: 4200, attack: 62, defense: 42, moveSpeed: 1.4, attackRange: 2, attackCooldown: 1.65, attackWindup: 0.45, hitReactionDuration: 0.1, minHitReactionInterval: 4, collisionRadius: 0.8 }),
    ai: {
      targeting: { strategy: 'NEAREST_REACHABLE_FRONT', targetLockDuration: 3 }, movement: 'MELEE_CHASE',
      skillPriority: ['forest_oblivion', 'death_root', 'corrupted_slam'],
    },
    attack: { id: 'corrupted_claw', damageType: 'PHYSICAL', damageMultiplier: 1.2, delivery: 'MELEE', clip: 'attack', event: 'DAMAGE', hitTolerance: 0.5 },
    skills: ['death_root', 'corrupted_slam'], animation: mock,
    phases: [
      {
        id: 'dark_mist_dominion', label: 'ผนึกหมอกมืด', hpBelow: 0.7, interruptSelf: true,
        summon: [{ id: 'mist_wraith', count: 2 }],
        seal: { pulseEvery: 3, pulseAtkPct: 0.5, pulseName: 'DARK PULSE' },
      },
      { id: 'sacrifice', label: 'พิธีบูชายัญ', hpBelow: 0.4, summon: [{ id: 'dark_shaman_ritual', count: 1 }] },
      {
        id: 'enrage', label: 'คลั่งสุดขีด', hpBelow: 0.15, interruptSelf: true,
        statuses: ['guardian_enrage'], cooldownScale: 0.7, cooldownOverride: { forest_oblivion: 12 }, enableSkills: [{ id: 'forest_oblivion', firstDelay: 2 }],
      },
    ],
  },
};
