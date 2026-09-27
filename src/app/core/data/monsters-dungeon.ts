import { AnimClip, AnimationConfig, MonsterDefinition, MonsterSkillDefinition, MonsterStats } from '../models/monster';

/**
 * Special-dungeon rosters (claude/special-dungeon-monsters.md) — monsters that only live in the farm dungeons,
 * never in the tower. Pure data like Stage 4–10; art = the user's sheets cut by tools/sprites/sheet_cut.py (Training +
 * Ascension, FX by tools/sprites/fx_cut.py) or code-drawn pixel sheets (tools/sprites/dungeon/anim.py, the rest).
 *   Training (SURVIVAL)   straw_recruit · crossbow_dummy · drill_sergeant (ELITE: Rally Whistle)
 *   Ascension (BOSS DUEL) brass_shishi · moonblade_ronin · astral_seraph — one boss per weekday (economy.ts)
 *   Hunt (TREASURE)       gem_beetle · mimic_chest (dormant ambusher) · coin_kobold (carrier, Smoke Pouch)
 *   Skill Trial (CHALLENGE) rune_wisp · grimoire_familiar · arcane_examiner (ELITE: Arcane Seal = silence)
 * Sheet layout (every sheet): row 1 IDLE 4 · 2 MOVE 6 · 3 HURT 3 · 4 DEATH · 5 ATTACK 6 (strike / spawn = frame 4) · 6+ skills.
 */
const F = 85;
const clip = (row: number, frames: number, events: AnimClip['events'] = [], frameMs = F): AnimClip => ({ row, frames, frameMs, events });
/** cast clip: CAST_START on `start`, SKILL_ACTIVATE on `act` (frames between are stretched over the cast time) */
const cast = (row: number, frames: number, act: number, start = 2, frameMs = 90): AnimClip => ({
  row, frames, frameMs, castDriven: true,
  events: [{ frame: start, event: 'CAST_START', name: 'CAST_START' }, { frame: act, event: 'SKILL_ACTIVATE', name: 'SKILL_ACTIVATE' }],
});
const anim = (sheet: string, death: number, attackEvent: 'DAMAGE' | 'PROJECTILE_SPAWN', extra: Record<string, AnimClip> = {}, cell: { w?: number; h?: number } = {}): AnimationConfig => ({
  sheet, ...(cell.w ? { cellW: cell.w } : {}), ...(cell.h && cell.h !== 100 ? { cellH: cell.h } : {}),
  clips: {
    idle: clip(1, 4, [], 150),
    move: clip(2, 6),
    hurt: clip(3, 3),
    death: clip(4, death, [{ frame: death, event: 'DEATH_COMPLETE', name: 'DEATH_COMPLETE' }]),
    attack: clip(5, 6, [{ frame: 4, event: attackEvent, name: attackEvent }]),
    ...extra,
  },
});

const base = (o: Partial<MonsterStats> & Pick<MonsterStats, 'maxHp' | 'attack' | 'defense' | 'moveSpeed' | 'attackRange' | 'attackCooldown'>): MonsterStats => ({
  preferredRange: Math.max(0.8, o.attackRange - 0.2),
  attackWindup: 0.34,
  attackRecovery: 0.25,
  targetThinkInterval: 0.3,
  hitReactionDuration: 0.2,
  minHitReactionInterval: 0.8,
  collisionRadius: 0.4,
  ...o,
});
const melee = (id: string, mul = 1) => ({ id, damageType: 'PHYSICAL' as const, damageMultiplier: mul, delivery: 'MELEE' as const, clip: 'attack', event: 'DAMAGE' as const, hitTolerance: 0.35 });
const shot = (id: string, projectileId: string, damageType: 'PHYSICAL' | 'MAGIC' = 'PHYSICAL') =>
  ({ id, damageType, damageMultiplier: 1, delivery: 'PROJECTILE' as const, projectileId, clip: 'attack', event: 'PROJECTILE_SPAWN' as const, hitTolerance: 0 });

export const DUNGEON_PROJECTILES = {
  dummy_bolt: { id: 'dummy_bolt', speed: 11, damageMultiplier: 1, damageType: 'PHYSICAL' as const, collisionRadius: 0.2, maxLifetime: 2.5, hits: 'TARGET' as const, fx: 'dummy-bolt' },
  star_bolt: { id: 'star_bolt', speed: 9, damageMultiplier: 1, damageType: 'MAGIC' as const, collisionRadius: 0.25, maxLifetime: 2.5, hits: 'TARGET' as const, fx: 'star-bolt' },
  rune_orb: { id: 'rune_orb', speed: 9, damageMultiplier: 1, damageType: 'MAGIC' as const, collisionRadius: 0.25, maxLifetime: 2.5, hits: 'TARGET' as const, fx: 'rune-orb' },
  chalk_bolt: { id: 'chalk_bolt', speed: 10, damageMultiplier: 1, damageType: 'MAGIC' as const, collisionRadius: 0.25, maxLifetime: 2.5, hits: 'TARGET' as const, fx: 'chalk-bolt' },
};

export const DUNGEON_SKILLS: Record<string, MonsterSkillDefinition> = {
  // ------------------------------------------------ Training
  triple_volley: {
    id: 'triple_volley', name: 'ยิงสามดอก', label: 'TRIPLE VOLLEY', type: 'ATTACK',
    castTime: 1.2, cooldown: 10, interruptible: true, interruptPriority: 'LOW', initialDelayRandom: 1.5, range: 7,
    clip: 'volley', hitFx: 'triple-volley',
    target: { type: 'HERO_CLUSTER', area: 'ADJACENT_8', min: 1 },
    effects: [{ type: 'DAMAGE', mul: 0.7, area: 'ADJACENT_8', center: 'TARGET' }],
    conditions: [], recovery: 0.3, interruptRecovery: 0.5,
  },
  rally_whistle: {
    id: 'rally_whistle', name: 'นกหวีดรวมพล', label: 'RALLY WHISTLE', type: 'SUMMON',
    castTime: 2, cooldown: 14, interruptible: true, interruptPriority: 'HIGH', firstCastDelay: 4,
    clip: 'rally', fx: { id: 'rally-whistle', activationFrame: 3, frameMs: 90 },
    target: { type: 'ALL_ALLIES' },
    effects: [
      { type: 'APPLY_BUFF', buffId: 'rally_haste' },
      { type: 'SUMMON', monsters: [{ id: 'straw_recruit', count: 2 }], maxActive: 4 },
    ],
    mockFx: { color: '#ff6a55', area: 'RADIUS_3' },
    conditions: [], recovery: 0.4, interruptRecovery: 0.6,
  },

  // ------------------------------------------------ Ascension bosses
  lions_roar: {
    id: 'lions_roar', name: 'คำรามสิงห์', label: "LION'S ROAR", type: 'ATTACK',
    castTime: 1.5, cooldown: 14, interruptible: false, firstCastDelay: 6, range: 2,
    clip: 'roar', fx: { id: 'lions-roar', activationFrame: 2, frameMs: 90 },
    target: { type: 'CURRENT_TARGET' },
    effects: [
      { type: 'DAMAGE', mul: 1.0, area: 'FRONT_ARC', center: 'SELF' },
      { type: 'APPLY_STATUS', status: 'stun', to: 'HIT', duration: 0.8 },
    ],
    mockFx: { color: '#5fe0c4', area: 'FRONT_ARC' },
    conditions: [{ type: 'ENEMY_WITHIN', range: 2 }], recovery: 0.4, interruptRecovery: 0.4,
  },
  guardian_pounce: {
    id: 'guardian_pounce', name: 'กระโจนพิทักษ์', label: 'GUARDIAN POUNCE', type: 'MOVEMENT',
    castTime: 0.7, cooldown: 14, interruptible: false, range: 8, firstCastDelay: 10,
    clip: 'pounce',
    target: { type: 'HERO_PRIORITY', classes: ['healer', 'mage', 'archer'], backRowOnly: true },
    effects: [{ type: 'LEAP_BEHIND' }, { type: 'DAMAGE', mul: 1.1, area: 'SINGLE', center: 'TARGET' }],
    conditions: [], recovery: 0.3, interruptRecovery: 0.3,
  },
  crescent_iaido: {
    id: 'crescent_iaido', name: 'ชักดาบจันทร์เสี้ยว', label: 'CRESCENT IAIDO', type: 'ATTACK',
    castTime: 1.2, cooldown: 11, interruptible: false, firstCastDelay: 5, range: 3,
    clip: 'iaido', hitFx: 'crescent-iaido',
    target: { type: 'CURRENT_TARGET' },
    effects: [{ type: 'DAMAGE', mul: 1.6, area: 'LINE_3', center: 'TARGET' }],
    mockFx: { color: '#9fc0ff', area: 'LINE_3' },
    conditions: [], recovery: 0.4, interruptRecovery: 0.4,
  },
  mirror_stance: {
    id: 'mirror_stance', name: 'ท่ากระจกจันทร์', label: 'MIRROR STANCE', type: 'BUFF',
    castTime: 0.4, cooldown: 16, interruptible: false, firstCastDelay: 9,
    clip: 'mirror', fx: { id: 'mirror-stance', activationFrame: 1, frameMs: 110 },
    target: { type: 'SELF' },
    effects: [{ type: 'APPLY_STATUS', status: 'mirror_stance', to: 'SELF' }],
    conditions: [{ type: 'SELF_LACKS_STATUS', status: 'mirror_stance' }], recovery: 0.2, interruptRecovery: 0.2,
  },
  starfall: {
    id: 'starfall', name: 'ดาวตก', label: 'STARFALL', type: 'ATTACK',
    castTime: 1.6, cooldown: 9, interruptible: false, firstCastDelay: 4,
    clip: 'starfall', hitFx: 'starfall',
    target: { type: 'HERO_CLUSTER', area: 'ADJACENT_8', min: 1 },
    effects: [{ type: 'DAMAGE', mul: 1.35, area: 'ADJACENT_8', center: 'TARGET', damageType: 'MAGIC' }],
    mockFx: { color: '#ffd98a', area: 'ADJACENT_8' },
    conditions: [], recovery: 0.3, interruptRecovery: 0.3,
  },
  judgement_beam: {
    id: 'judgement_beam', name: 'ลำแสงพิพากษา', label: 'JUDGEMENT BEAM', type: 'ATTACK',
    castTime: 5, cooldown: 18, interruptible: false, interruptPriority: 'CRITICAL', breakRequired: 100, brokenStatus: 'broken', firstCastDelay: 10,
    clip: 'judgement', hitFx: 'judgement-beam',
    target: { type: 'ALL_HEROES' },
    effects: [
      { type: 'DAMAGE', mul: 2.0, area: 'ALL_ENEMIES', center: 'SELF', damageType: 'MAGIC' },
      { type: 'APPLY_STATUS', status: 'healing_reduction', to: 'HIT', duration: 6 },
    ],
    mockFx: { color: '#b9a4ff', area: 'ALL_ENEMIES' },
    conditions: [], recovery: 0.6, interruptRecovery: 0,
  },

  // ------------------------------------------------ Hunt
  crystal_shell: {
    id: 'crystal_shell', name: 'เปลือกผลึก', label: 'CRYSTAL SHELL', type: 'BUFF',
    castTime: 1, cooldown: 12, interruptible: false, firstCastDelay: 2,
    clip: 'shell', fx: { id: 'crystal-shell', activationFrame: 3, frameMs: 90 },
    target: { type: 'SELF' },
    effects: [{ type: 'APPLY_STATUS', status: 'crystal_shell', to: 'SELF' }],
    conditions: [{ type: 'SELF_BELOW', pct: 0.6 }, { type: 'SELF_LACKS_STATUS', status: 'crystal_shell' }], recovery: 0.2, interruptRecovery: 0.2,
  },
  devour: {
    id: 'devour', name: 'ขย้ำกลืน', label: 'DEVOUR', type: 'ATTACK',
    castTime: 1.5, cooldown: 11, interruptible: true, interruptPriority: 'HIGH', firstCastDelay: 1.5, range: 1.5,
    clip: 'devour', hitFx: 'devour',
    target: { type: 'CURRENT_TARGET' },
    effects: [
      { type: 'DAMAGE', mul: 2, area: 'SINGLE', center: 'TARGET' },
      { type: 'APPLY_STATUS', status: 'stun', to: 'HIT', duration: 2 },
    ],
    conditions: [{ type: 'ENEMY_WITHIN', range: 1.5 }], recovery: 0.4, interruptRecovery: 0.6,
  },
  smoke_pouch: {
    id: 'smoke_pouch', name: 'ระเบิดควันหนี', label: 'SMOKE POUCH', type: 'MOVEMENT',
    castTime: 0.4, cooldown: 30, interruptible: false, once: true, untargetableWhileCasting: true, firstCastDelay: 0,
    clip: 'smoke', hitFx: 'smoke-pouch',
    target: { type: 'SELF' },
    effects: [{ type: 'BLINK_AWAY', cells: 1 }],
    conditions: [{ type: 'SELF_BELOW', pct: 0.35 }], recovery: 0.1, interruptRecovery: 0.1,
  },

  // ------------------------------------------------ Skill Trial
  rune_bolt: {
    id: 'rune_bolt', name: 'กระสุนรูน', label: 'RUNE BOLT', type: 'ATTACK',
    castTime: 1.5, cooldown: 7, interruptible: true, interruptPriority: 'MEDIUM', initialDelayRandom: 1.5, range: 7,
    clip: 'bolt', hitFx: 'rune-bolt',
    target: { type: 'CURRENT_TARGET' },
    effects: [{ type: 'DAMAGE', mul: 1.8, area: 'SINGLE', center: 'TARGET', damageType: 'MAGIC' }],
    conditions: [], recovery: 0.3, interruptRecovery: 0.5,
  },
  page_barrier: {
    id: 'page_barrier', name: 'ม่านหน้ากระดาษ', label: 'PAGE BARRIER', type: 'SUPPORT',
    castTime: 2.5, cooldown: 12, interruptible: true, interruptPriority: 'HIGH', firstCastDelay: 3,
    clip: 'barrier', fx: { id: 'page-barrier', activationFrame: 3, frameMs: 100 },
    target: { type: 'ALL_ALLIES' },
    effects: [{ type: 'SHIELD_PCT', pct: 0.25, to: 'ALL_ALLIES', duration: 6 }],
    mockFx: { color: '#ffd84a', area: 'RADIUS_3' },
    conditions: [{ type: 'ANY_ALLY_BELOW', pct: 0.9 }], recovery: 0.4, interruptRecovery: 0.6,
  },
  /** Trial IV lesson = Break coordination: the seal cannot be interrupted, only broken (100 = two breakers) */
  arcane_seal: {
    id: 'arcane_seal', name: 'ผนึกเวท', label: 'ARCANE SEAL', type: 'ATTACK',
    castTime: 4.5, cooldown: 15, interruptible: false, interruptPriority: 'CRITICAL', breakRequired: 100, brokenStatus: 'broken', firstCastDelay: 5,
    clip: 'seal', hitFx: 'arcane-seal',
    target: { type: 'HIGHEST_ATK_HERO' },
    effects: [
      { type: 'DAMAGE', mul: 1.2, area: 'SINGLE', center: 'TARGET', damageType: 'MAGIC' },
      { type: 'APPLY_STATUS', status: 'silence', to: 'TARGET', duration: 4 },
    ],
    mockFx: { color: '#ffd84a', area: 'SINGLE' },
    conditions: [], recovery: 0.4, interruptRecovery: 0,
  },
  chalk_circle: {
    id: 'chalk_circle', name: 'วงชอล์ก', label: 'CHALK CIRCLE', type: 'ATTACK',
    castTime: 1.2, cooldown: 10, interruptible: false, firstCastDelay: 7,
    clip: 'chalk',
    target: { type: 'HERO_CLUSTER', area: 'ADJACENT_8', min: 2 },
    effects: [{ type: 'DAMAGE', mul: 1.3, area: 'ADJACENT_8', center: 'TARGET', damageType: 'MAGIC' }],
    mockFx: { color: '#e6e6ff', area: 'ADJACENT_8' },
    conditions: [], recovery: 0.3, interruptRecovery: 0.3,
  },
};

const noAttack = { id: 'none', damageType: 'PHYSICAL' as const, damageMultiplier: 0, delivery: 'MELEE' as const, clip: 'attack', event: 'DAMAGE' as const, hitTolerance: 0 };

export const DUNGEON_MONSTERS: Record<string, MonsterDefinition> = {
  // ------------------------------------------------ Training — Iron Drill Yard
  straw_recruit: {
    id: 'straw_recruit', name: 'หุ่นฟางพลทหาร', rank: 'COMMON', role: 'SWARM MELEE', tags: ['construct', 'training'],
    displayClass: 'fighter',
    stats: base({ maxHp: 200, attack: 45, defense: 8, moveSpeed: 2.6, attackRange: 1.1, attackCooldown: 1.3 }),
    ai: { targeting: { strategy: 'NEAREST_REACHABLE_FRONT', targetLockDuration: 1 }, movement: 'MELEE_CHASE' },
    attack: melee('wooden_sword'), skills: [],
    animation: anim('enemy-straw-recruit.png', 6, 'DAMAGE'),
  },
  crossbow_dummy: {
    id: 'crossbow_dummy', name: 'หุ่นหน้าไม้', rank: 'COMMON', role: 'RANGED DPS', tags: ['construct', 'training'],
    displayClass: 'archer',
    stats: base({ maxHp: 170, attack: 50, defense: 6, moveSpeed: 0.9, attackRange: 6.5, preferredRange: 5.5, minComfortableRange: 0, attackCooldown: 2 }),
    ai: { targeting: { strategy: 'LOWEST_HP_PCT', targetLockDuration: 1, similarHpTolerance: 0.05 }, movement: 'RANGED_HOLD', maxRetreatSteps: 0, skillPriority: ['triple_volley'] },
    attack: shot('crossbow_bolt', 'dummy_bolt'), skills: ['triple_volley'],
    animation: anim('enemy-crossbow-dummy.png', 6, 'PROJECTILE_SPAWN', { volley: cast(6, 6, 4) }),
  },
  drill_sergeant: {
    id: 'drill_sergeant', name: 'จ่าหุ่นเหล็ก', rank: 'ELITE', role: 'SUMMONER / BUFF', tags: ['construct', 'training', 'drill'],
    displayClass: 'tank', immune: ['KNOCKBACK'],
    stats: base({ maxHp: 700, attack: 60, defense: 30, moveSpeed: 1.8, attackRange: 1.3, attackCooldown: 1.7, minHitReactionInterval: 2, collisionRadius: 0.5 }),
    ai: { targeting: { strategy: 'NEAREST_REACHABLE_FRONT', targetLockDuration: 1.5 }, movement: 'MELEE_CHASE', skillPriority: ['rally_whistle'] },
    attack: melee('megaphone_bash', 1.1), skills: ['rally_whistle'],
    animation: anim('enemy-drill-sergeant.png', 6, 'DAMAGE', { rally: cast(6, 8, 5) }, { w: 142, h: 110 }),
  },

  // ------------------------------------------------ Ascension — Sky Shrine guardians (base = tier II, tiers scale via monsterTuning)
  brass_shishi: {
    id: 'brass_shishi', name: 'สิงห์ทองเหลืองพิทักษ์', rank: 'BOSS', role: 'BOSS DUEL / POSITIONING', tags: ['beast', 'ascension'],
    displayClass: 'tank', immune: ['KNOCKBACK', 'STUN'],
    stats: base({ maxHp: 20000, attack: 85, defense: 30, moveSpeed: 1.6, attackRange: 1.5, attackCooldown: 1.9, hitReactionDuration: 0.1, minHitReactionInterval: 3, collisionRadius: 0.8, attackWindup: 0.4 }),
    ai: { targeting: { strategy: 'NEAREST_REACHABLE_FRONT', targetLockDuration: 2 }, movement: 'MELEE_CHASE', skillPriority: ['lions_roar', 'guardian_pounce'] },
    attack: melee('paw_swipe', 1.1), skills: ['lions_roar', 'guardian_pounce'],
    animation: anim('enemy-brass-shishi.png', 7, 'DAMAGE', { roar: cast(6, 6, 3), pounce: cast(7, 6, 4, 1) }, { w: 238, h: 155 }),
    phases: [{ id: 'jade_awakening', label: 'หยกตื่น', hpBelow: 0.5, transition: 1, statuses: ['jade_awakening'], cooldownOverride: { guardian_pounce: 10 } }],
  },
  moonblade_ronin: {
    id: 'moonblade_ronin', name: 'วิญญาณดาบจันทรา', rank: 'BOSS', role: 'BOSS DUEL / HOLD FIRE', tags: ['spirit', 'ascension'],
    displayClass: 'assassin', immune: ['KNOCKBACK'],
    stats: base({ maxHp: 20000, attack: 100, defense: 24, moveSpeed: 2.4, attackRange: 1.5, attackCooldown: 1.4, hitReactionDuration: 0.1, minHitReactionInterval: 3, collisionRadius: 0.7, attackWindup: 0.3 }),
    ai: { targeting: { strategy: 'NEAREST_REACHABLE_FRONT', targetLockDuration: 1.5 }, movement: 'MELEE_CHASE', skillPriority: ['mirror_stance', 'crescent_iaido'] },
    attack: melee('moon_cut', 1.1), skills: ['mirror_stance', 'crescent_iaido'],
    animation: anim('enemy-moonblade-ronin.png', 7, 'DAMAGE', { iaido: cast(6, 6, 4), mirror: cast(7, 6, 2, 1, 110) }, { w: 340, h: 189 }),
    phases: [{ id: 'twin_moon', label: 'จันทร์คู่', hpBelow: 0.4, transition: 1, statuses: ['twin_moon'], cooldownOverride: { crescent_iaido: 6 } }],
  },
  astral_seraph: {
    id: 'astral_seraph', name: 'เทวรูปดวงดาว', rank: 'BOSS', role: 'BOSS DUEL / BREAK CHECK', tags: ['celestial', 'ascension'],
    displayClass: 'mage', immune: ['KNOCKBACK', 'ROOT'],
    stats: base({ maxHp: 20000, attack: 95, defense: 34, moveSpeed: 1.2, attackRange: 5, preferredRange: 4.5, attackCooldown: 1.7, minComfortableRange: 0, hitReactionDuration: 0.1, minHitReactionInterval: 3, collisionRadius: 0.8 }),
    ai: { targeting: { strategy: 'NEAREST_REACHABLE_FRONT', targetLockDuration: 2 }, movement: 'RANGED_HOLD', maxRetreatSteps: 0, skillPriority: ['judgement_beam', 'starfall'] },
    attack: shot('star_shot', 'star_bolt', 'MAGIC'), skills: ['judgement_beam', 'starfall'],
    animation: anim('enemy-astral-seraph.png', 7, 'PROJECTILE_SPAWN', { starfall: cast(6, 6, 4), judgement: cast(7, 10, 8) }, { w: 304, h: 222 }),
    phases: [{ id: 'seraph_ascend', label: 'เทวรูปตื่น', hpBelow: 0.5, transition: 1, statuses: ['seraph_ascend'], cooldownOverride: { judgement_beam: 15, starfall: 8 } }],
  },

  // ------------------------------------------------ Hunt — Glittering Vault
  gem_beetle: {
    id: 'gem_beetle', name: 'ด้วงอัญมณี', rank: 'COMMON', role: 'GUARD / WALL', tags: ['beast', 'hunt'],
    displayClass: 'tank',
    stats: base({ maxHp: 420, attack: 45, defense: 40, moveSpeed: 1.4, attackRange: 1.2, attackCooldown: 1.8 }),
    ai: { targeting: { strategy: 'NEAREST_REACHABLE_FRONT', targetLockDuration: 1.2 }, movement: 'MELEE_CHASE', skillPriority: ['crystal_shell'] },
    attack: melee('horn_charge'), skills: ['crystal_shell'],
    animation: anim('enemy-gem-beetle.png', 6, 'DAMAGE', { shell: cast(6, 6, 2, 1) }),
  },
  mimic_chest: {
    id: 'mimic_chest', name: 'หีบมิมิค', rank: 'SPECIAL', role: 'AMBUSHER', tags: ['construct', 'hunt'],
    displayClass: 'fighter',
    stats: base({ maxHp: 600, attack: 62, defense: 22, moveSpeed: 1.8, attackRange: 1.3, attackCooldown: 1.6, collisionRadius: 0.45 }),
    ai: { targeting: { strategy: 'NEAREST_REACHABLE_FRONT', targetLockDuration: 1.5 }, movement: 'MELEE_CHASE', skillPriority: ['devour'], dormant: { wakeRange: 2 } },
    attack: melee('chomp', 1.1), skills: ['devour'],
    animation: anim('enemy-mimic-chest.png', 6, 'DAMAGE', { devour: cast(6, 8, 5) }),
  },
  coin_kobold: {
    id: 'coin_kobold', name: 'โคโบลด์ขนทอง', rank: 'SPECIAL', role: 'TREASURE / FLEES', tags: ['kobold', 'treasure'],
    displayClass: 'assassin', immune: ['KNOCKBACK'],
    stats: base({ maxHp: 340, attack: 1, defense: 14, moveSpeed: 0.5, attackRange: 1, attackCooldown: 9, collisionRadius: 0.4, minHitReactionInterval: 1.5 }),
    ai: { targeting: { strategy: 'NEAREST_REACHABLE_FRONT', targetLockDuration: 1 }, movement: 'FLEE', flee: { after: 20, onHit: true } },
    attack: noAttack, skills: ['smoke_pouch'],
    animation: anim('enemy-coin-kobold.png', 6, 'DAMAGE', { smoke: cast(6, 4, 3, 1) }, { w: 150, h: 105 }),
  },

  // ------------------------------------------------ Skill Trial — Arcane Exam Hall
  rune_wisp: {
    id: 'rune_wisp', name: 'ภูตรูน', rank: 'COMMON', role: 'CASTER', tags: ['spirit', 'trial', 'caster'],
    displayClass: 'mage',
    stats: base({ maxHp: 190, attack: 55, defense: 5, moveSpeed: 2, attackRange: 6, preferredRange: 5, minComfortableRange: 2, attackCooldown: 1.8 }),
    ai: { targeting: { strategy: 'LOWEST_HP_PCT', targetLockDuration: 1, similarHpTolerance: 0.05 }, movement: 'RANGED_HOLD', maxRetreatSteps: 1, skillPriority: ['rune_bolt'] },
    attack: { ...shot('rune_spark', 'rune_orb', 'MAGIC'), damageMultiplier: 0.9 }, skills: ['rune_bolt'],
    animation: anim('enemy-rune-wisp.png', 6, 'PROJECTILE_SPAWN', { bolt: cast(6, 8, 5) }),
  },
  grimoire_familiar: {
    id: 'grimoire_familiar', name: 'ตำราเวทมีชีวิต', rank: 'SPECIAL', role: 'SHIELD SUPPORT', tags: ['construct', 'trial', 'caster'],
    displayClass: 'healer',
    stats: base({ maxHp: 380, attack: 40, defense: 12, moveSpeed: 1.8, attackRange: 5, preferredRange: 4.5, minComfortableRange: 2, attackCooldown: 1.8 }),
    ai: { targeting: { strategy: 'NEAREST_REACHABLE_FRONT', targetLockDuration: 1.2 }, movement: 'RANGED_HOLD', maxRetreatSteps: 1, skillPriority: ['page_barrier'] },
    attack: { ...shot('paper_cut', 'chalk_bolt', 'MAGIC'), damageMultiplier: 0.8 }, skills: ['page_barrier'],
    animation: anim('enemy-grimoire-familiar.png', 6, 'PROJECTILE_SPAWN', { barrier: cast(6, 8, 5) }),
  },
  arcane_examiner: {
    id: 'arcane_examiner', name: 'ผู้คุมสอบจอมเวท', rank: 'ELITE', role: 'CONTROL / BREAK CHECK', tags: ['trial', 'caster'],
    displayClass: 'mage', immune: ['KNOCKBACK', 'TAUNT'],
    stats: base({ maxHp: 1400, attack: 75, defense: 28, moveSpeed: 1.4, attackRange: 4, preferredRange: 3, minComfortableRange: 0, attackCooldown: 1.9, minHitReactionInterval: 3, collisionRadius: 0.55 }),
    ai: { targeting: { strategy: 'NEAREST_REACHABLE_FRONT', targetLockDuration: 2 }, movement: 'RANGED_HOLD', maxRetreatSteps: 0, skillPriority: ['arcane_seal', 'chalk_circle'] },
    attack: shot('chalk_shot', 'chalk_bolt', 'MAGIC'), skills: ['arcane_seal', 'chalk_circle'],
    animation: anim('enemy-arcane-examiner.png', 7, 'PROJECTILE_SPAWN', { seal: cast(6, 8, 5), chalk: cast(7, 6, 4) }, { w: 182, h: 128 }),
    phases: [{ id: 'pop_quiz', label: 'สอบซ่อม', hpBelow: 0.5, transition: 0.75, statuses: ['pop_quiz'] }],
  },
};

// ------------------------------------------------------------------ variants

/**
 * The farm dungeons keep the pacing of their old encounters: every old monster in a dungeon's waves is replaced by
 * a VARIANT of that dungeon's own monster for the same role (`DUNGEON_ROLE_MAP`). A variant keeps the replaced
 * monster's HP / DEF and damage per second (ATK rescaled for attack speed and multiplier) but looks, moves and
 * fights like the dungeon monster. Id = `<dungeon monster>@<replaced monster>`, `baseId` = the dungeon monster.
 * `skills: []` = the variant fights without the design's skill (e.g. only real casters carry RUNE BOLT).
 */
export interface RoleSwap { to: string; skills?: string[] }
const MELEE_T = ['goblin_fighter', 'forest_wolf', 'forest_slime', 'corrupted_wolf', 'mist_wraith', 'shadow_panther'];
const RANGED_T = ['goblin_archer', 'forest_spirit', 'magic_mushroom'];
const HEAVY_T = ['corrupted_treant', 'goblin_guard'];
const swapAll = (ids: string[], sw: RoleSwap) => Object.fromEntries(ids.map(id => [id, sw]));

export const DUNGEON_ROLE_MAP: Record<'training' | 'hunt' | 'trial', Record<string, RoleSwap>> = {
  training: {
    ...swapAll(MELEE_T, { to: 'straw_recruit' }),
    ...swapAll(RANGED_T, { to: 'crossbow_dummy' }),
    ...swapAll(HEAVY_T, { to: 'drill_sergeant', skills: [] }),
    alpha_wolf: { to: 'drill_sergeant' },
  },
  hunt: {
    ...swapAll(MELEE_T, { to: 'gem_beetle' }),
    ...swapAll(HEAVY_T, { to: 'gem_beetle' }),
    ...swapAll(RANGED_T, { to: 'mimic_chest' }),
    ...swapAll(['goblin_shaman', 'dark_shaman', 'mist_witch', 'alpha_wolf'], { to: 'mimic_chest' }),
  },
  trial: {
    // only the wisp that takes the old caster's place (Alpha Wolf's HOWL) carries RUNE BOLT — the trial's lesson
    ...swapAll([...MELEE_T, ...HEAVY_T, ...RANGED_T], { to: 'rune_wisp', skills: [] }),
    alpha_wolf: { to: 'rune_wisp' },
    goblin_shaman: { to: 'grimoire_familiar' },
    trial_warden: { to: 'arcane_examiner' },
  },
};

export const variantId = (to: string, from: string) => `${to}@${from}`;

/** a dungeon monster re-statted to the power of `source` (HP, DEF, DPS) */
export function roleVariant(base: MonsterDefinition, source: MonsterDefinition, skills?: string[]): MonsterDefinition {
  const s = source.stats, b = base.stats;
  const srcDps = (s.attack * (source.attack.damageMultiplier || 1)) / s.attackCooldown;
  const atk = Math.max(1, Math.round((srcDps * b.attackCooldown) / (base.attack.damageMultiplier || 1)));
  const sk = skills ?? base.skills;
  // a shooter standing in for a melee monster fights up close (keeps the old wave's reach — a wall of range-6
  // shooters would hit the backline the old melee wave never touched)
  const closeIn = base.attack.delivery === 'PROJECTILE' && s.attackRange <= 2;
  const reach = closeIn
    ? { attackRange: s.attackRange, preferredRange: s.preferredRange, minComfortableRange: 0, moveSpeed: Math.max(b.moveSpeed, s.moveSpeed) }
    : {};
  return {
    ...base,
    id: variantId(base.id, source.id),
    baseId: base.id,
    stats: { ...b, ...reach, maxHp: s.maxHp, defense: s.defense, attack: base.attack.damageMultiplier === 0 ? b.attack : atk },
    skills: sk,
    ai: {
      ...base.ai,
      ...(closeIn ? { movement: source.ai.movement, targeting: source.ai.targeting, maxRetreatSteps: 0 } : {}),
      skillPriority: base.ai.skillPriority?.filter(id => sk.includes(id)),
    },
  };
}

/** Ascension guardians: one design per weekday, each tier a stat step of it (base = tier II) */
export const ASCENSION_BOSSES = ['brass_shishi', 'moonblade_ronin', 'astral_seraph'] as const;
export const ASCENSION_TIER_SCALE = [
  { hp: 0.75, atk: 0.78 },
  { hp: 1, atk: 1 },
  { hp: 1.2, atk: 1.19 },
];
export function tierVariant(base: MonsterDefinition, tier: number): MonsterDefinition {
  const k = ASCENSION_TIER_SCALE[tier - 1];
  return {
    ...base, id: `${base.id}@${tier}`, baseId: base.id,
    stats: { ...base.stats, maxHp: Math.round(base.stats.maxHp * k.hp), attack: Math.round(base.stats.attack * k.atk) },
  };
}

/** every generated variant, built from the full registry (called once by monsters.ts) */
export function dungeonVariants(all: Record<string, MonsterDefinition>): Record<string, MonsterDefinition> {
  const out: Record<string, MonsterDefinition> = {};
  for (const map of Object.values(DUNGEON_ROLE_MAP)) {
    for (const [from, sw] of Object.entries(map)) {
      const base = all[sw.to], src = all[from];
      if (!base || !src) continue;
      const v = roleVariant(base, src, sw.skills);
      out[v.id] = v;
    }
  }
  for (const id of ASCENSION_BOSSES) for (const t of [1, 2, 3]) {
    const v = tierVariant(all[id], t);
    out[v.id] = v;
  }
  return out;
}

/** the design a (possibly generated) monster id belongs to */
export const baseMonsterId = (id: string): string => id.split('@')[0];
