import { AnimationConfig, MonsterDefinition, MonsterSkillDefinition, MonsterStats } from '../models/monster';
import { FOREST_ARC_ANIMATIONS } from './forest-arc-art.generated';

/**
 * Forest Arc roster — tower Stages 1–10 (claude/eldervane-monster-spec-s1-10.md, 2026-11-05).
 *
 * The spec leaves every number TBD. User decision 2026-11-05: stats are BORROWED from the closest legacy monster
 * (legacy-tower-monsters.ts) and skills use provisional values inside the spec's suggested ranges. Every value here is
 * PROVISIONAL until a balance pass; the source of each borrow is noted per monster.
 *
 * Art (user monster1–4.zip, 2026-11-05 → tools/sprites/forest_arc/art.py → forest-arc-art.generated.ts): every monster
 * has its sheet except Forest Oblivion (round mock `mock_fa_forest_oblivion` until its animations / VFX arrive).
 * Forest Slime keeps its existing sheet (spec LOCKED) — it lives in monsters.ts, drawn smaller (`AnimationConfig.scale`).
 *
 * Scope (spec §2.5): dedicated skills only for Alpha Wolf, Mist Wraith, Dark Shaman, Mist Witch, Elder Treant and
 * Forest Oblivion; everyone else = normal attack (+ idle / move / hurt / death).
 */

const mock = { clips: {} };
/** the generated sheet when one exists, else the round mock */
const art = (id: string): AnimationConfig => FOREST_ARC_ANIMATIONS[id] ?? mock;

/** generic timings of a mock monster (same defaults as the legacy Stage 4–10 roster) */
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

const FRONT = { strategy: 'NEAREST_REACHABLE_FRONT', targetLockDuration: 1.2 } as const;
const melee = (id: string, mul = 1, hitTolerance = 0.3) =>
  ({ id, damageType: 'PHYSICAL', damageMultiplier: mul, delivery: 'MELEE', clip: 'attack', event: 'DAMAGE', hitTolerance } as const);
const bolt = (id: string, projectileId: string, mul = 1, damageType: 'MAGIC' | 'PHYSICAL' = 'MAGIC') =>
  ({ id, damageType, damageMultiplier: mul, delivery: 'PROJECTILE', projectileId, clip: 'attack', event: 'PROJECTILE_SPAWN', hitTolerance: 0 } as const);

// ------------------------------------------------------------------ skills (PROVISIONAL values)

export const FOREST_ARC_SKILLS: Record<string, MonsterSkillDefinition> = {
  // ---- Alpha Wolf (Stage 3 Interrupt lesson, spec §5 LOCKED objective)
  /** readable 2 s pack-command cast; completed = wolves ATK +25 % / attack speed +20 % (spec proposed) */
  alpha_howl: {
    id: 'alpha_howl', name: 'เสียงหอนจ่าฝูง', label: 'ALPHA HOWL', type: 'BUFF',
    clip: 'howl', fx: { id: 'fa-howl', activationFrame: 1, frameMs: 70 },
    castTime: 2, cooldown: 12, interruptedCooldown: 12, interruptible: true, interruptPriority: 'HIGH',
    firstCastDelay: 2.25,
    target: { type: 'ALLIES_WITH_TAG', tag: 'wolf', includeSelf: true },
    effects: [{ type: 'APPLY_BUFF', buffId: 'alpha_pack_command' }],
    mockFx: { color: '#ffd76a', area: 'ALL_ALLIES' },
    // a normal Forest Wolf must still be alive — kill the pack and the Howl stops
    conditions: [
      { type: 'ALLY_DEFINITION_ALIVE', monsterId: 'forest_wolf', min: 1 },
      { type: 'TARGETS_NEED_BUFF', buffId: 'alpha_pack_command', refreshBelow: 2 },
    ],
    recovery: 0.35, interruptRecovery: 0.6,
  },
  /** telegraphed strong claw (interrupt eligibility TBD → not interruptible, the Howl stays the lesson) */
  charge_claw: {
    id: 'charge_claw', name: 'ตะปบพุ่ง', label: 'CHARGE-CLAW', type: 'ATTACK',
    clip: 'claw', hitFx: 'fa-claw',
    castTime: 0.8, cooldown: 9, interruptible: false, range: 2, firstCastDelay: 5,
    target: { type: 'CURRENT_TARGET' },
    effects: [{ type: 'DAMAGE', mul: 1.8, area: 'SINGLE', center: 'TARGET' }],
    mockFx: { color: '#ffb36a', area: 'SINGLE' },
    conditions: [{ type: 'ENEMY_WITHIN', range: 2 }], recovery: 0.3, interruptRecovery: 0.4,
  },

  // ---- Mist Wraith (spec §5): Phase / Mist Shift → Spectral Slash. Defense rule chosen: UNTARGETABLE (one rule only)
  mist_shift: {
    id: 'mist_shift', name: 'ร่างหมอกเคลื่อน', label: 'MIST SHIFT', type: 'MOVEMENT',
    fx: { id: 'fa-phase', activationFrame: 8, frameMs: 100 },
    castTime: 0.8, cooldown: 10, interruptible: false, untargetableWhileCasting: true, firstCastDelay: 3,
    target: { type: 'HERO_PRIORITY', classes: ['healer', 'mage', 'archer'], backRowOnly: true },
    effects: [{ type: 'LEAP_BEHIND' }],
    // the slash follows right after re-forming
    followUp: { skill: 'spectral_slash', delay: 0.3 },
    conditions: [{ type: 'SELF_LACKS_STATUS', status: 'untargetable' }], recovery: 0.2, interruptRecovery: 0.3,
  },
  spectral_slash: {
    id: 'spectral_slash', name: 'ฟันวิญญาณ', label: 'SPECTRAL SLASH', type: 'ATTACK',
    clip: 'slash', hitFx: 'fa-x-slash',
    castTime: 0.6, cooldown: 7, interruptible: false, range: 2,
    target: { type: 'CURRENT_TARGET' },
    effects: [{ type: 'DAMAGE', mul: 1.8, area: 'SINGLE', center: 'TARGET' }],
    mockFx: { color: '#9cc4ff', area: 'SINGLE' },
    conditions: [{ type: 'ENEMY_WITHIN', range: 2 }], recovery: 0.3, interruptRecovery: 0.3,
  },

  // ---- Dark Shaman (spec §5): two interruptible casts — effects only on completion
  weakening_hex: {
    id: 'weakening_hex', name: 'คำสาปอ่อนแรง', label: 'WEAKENING HEX', type: 'ATTACK',
    clip: 'hex', hitFx: 'fa-curse',
    castTime: 1.8, cooldown: 11, interruptible: true, interruptPriority: 'HIGH', firstCastDelay: 3,
    // the shaman shoots the nearest frontline hero — that is who it curses
    target: { type: 'CURRENT_TARGET' },
    effects: [{ type: 'APPLY_STATUS', status: 'weakened', to: 'TARGET' }],
    mockFx: { color: '#8a5ad6', area: 'SINGLE' },
    conditions: [{ type: 'HEROES_NEED_STATUS', status: 'weakened', refreshBelow: 1 }], recovery: 0.3, interruptRecovery: 0.6,
  },
  dark_chant: {
    id: 'dark_chant', name: 'บทสวดมืด', label: 'DARK CHANT', type: 'BUFF',
    clip: 'chant', hitFx: 'fa-dark-chant',
    castTime: 2, cooldown: 14, interruptible: true, interruptPriority: 'HIGH', firstCastDelay: 5,
    // whole wave (local vs wave = TBD)
    target: { type: 'ALL_ALLIES' },
    effects: [{ type: 'APPLY_BUFF', buffId: 'dark_chant_buff' }],
    mockFx: { color: '#c78cff', area: 'ALL_ALLIES' },
    // only with eligible allies (another Forest Arc monster alive)
    conditions: [{ type: 'ALLY_TAG_ALIVE', tag: 'forest_arc', min: 1 }, { type: 'TARGETS_NEED_BUFF', buffId: 'dark_chant_buff', refreshBelow: 1 }],
    recovery: 0.3, interruptRecovery: 0.6,
  },

  // ---- Mist Witch (spec §5)
  /** zone: Slow + attack speed ↓ on the heroes inside a 2 × 2 at cast time (persistent zone = later) */
  black_fog: {
    id: 'black_fog', name: 'หมอกดำ', label: 'BLACK FOG', type: 'ATTACK',
    clip: 'fog', hitFx: 'fa-black-fog',
    castTime: 1.5, cooldown: 12, interruptible: true, interruptPriority: 'MEDIUM', firstCastDelay: 3,
    target: { type: 'HERO_CLUSTER', area: 'SQUARE_2', min: 1 },
    effects: [{ type: 'APPLY_STATUS', status: 'black_fog', to: 'AREA', area: 'SQUARE_2', center: 'TARGET' }],
    mockFx: { color: '#4b3a6b', area: 'SQUARE_2' },
    conditions: [], recovery: 0.3, interruptRecovery: 0.6,
  },
  veil_curse: {
    id: 'veil_curse', name: 'คำสาปม่านหมอก', label: 'VEIL CURSE', type: 'ATTACK',
    clip: 'veil', hitFx: 'fa-veil-curse',
    castTime: 2.2, cooldown: 13, interruptible: true, interruptPriority: 'HIGH', firstCastDelay: 6,
    target: { type: 'HIGHEST_ATK_HERO' },
    effects: [{ type: 'APPLY_STATUS', status: 'veil_curse', to: 'TARGET' }],
    mockFx: { color: '#a06bff', area: 'SINGLE' },
    conditions: [{ type: 'HEROES_NEED_STATUS', status: 'veil_curse', refreshBelow: 1 }], recovery: 0.3, interruptRecovery: 0.6,
  },

  // ---- Elder Treant — Stage 7 boss (spec §6)
  heavy_root_slam: {
    id: 'heavy_root_slam', name: 'รากกระแทกหนัก', label: 'HEAVY ROOT SLAM', type: 'ATTACK',
    clip: 'slam', fx: { id: 'fa-root-slam', activationFrame: 1, frameMs: 70 }, hitFx: 'fa-root-slam-hit',
    castTime: 1.5, cooldown: 8, interruptible: false, range: 2,
    target: { type: 'CURRENT_TARGET' },
    effects: [{ type: 'DAMAGE', mul: 1.7, area: 'FRONT_ARC', center: 'SELF' }],
    mockFx: { color: '#a0703a', area: 'FRONT_ARC' },
    conditions: [{ type: 'ENEMY_WITHIN', range: 2 }], recovery: 0.4, interruptRecovery: 0.6,
  },
  entangling_roots: {
    id: 'entangling_roots', name: 'รากพันธนาการ', label: 'ENTANGLING ROOTS', type: 'ATTACK',
    clip: 'roots', hitFx: 'fa-roots',
    castTime: 2, cooldown: 10, interruptible: true, interruptPriority: 'MEDIUM',
    target: { type: 'HERO_PRIORITY', classes: ['healer', 'mage', 'archer'], backRowOnly: true },
    effects: [
      { type: 'DAMAGE', mul: 1, area: 'SINGLE', center: 'TARGET', damageType: 'MAGIC' },
      { type: 'APPLY_STATUS', status: 'root', to: 'TARGET', duration: 3 },
    ],
    mockFx: { color: '#6b8f3a', area: 'SINGLE' },
    conditions: [], recovery: 0.3, interruptRecovery: 0.6,
  },
  /** summon pool (spec candidates): Forest Wolf + Mushroom Creature, at most 2 alive */
  call_of_the_forest: {
    id: 'call_of_the_forest', name: 'เสียงเรียกแห่งพงไพร', label: 'CALL OF THE FOREST', type: 'SUMMON',
    clip: 'call', fx: { id: 'fa-call-charge', activationFrame: 33, frameMs: 94 }, hitFx: 'fa-call-summon',
    castTime: 3, cooldown: 12, interruptible: true, interruptPriority: 'CRITICAL', firstCastDelay: 5,
    target: { type: 'SELF' },
    effects: [{ type: 'SUMMON', monsters: [{ id: 'forest_wolf', count: 1 }, { id: 'mushroom_creature', count: 1 }], maxActive: 2 }],
    mockFx: { color: '#5ec8e0', area: 'RADIUS_2' },
    conditions: [{ type: 'SUMMON_SLOTS_FREE' }], recovery: 0.4, interruptRecovery: 0.6,
  },
  bark_guard: {
    id: 'bark_guard', name: 'เกราะเปลือกไม้', label: 'BARK GUARD', type: 'BUFF',
    clip: 'bark', hitFx: 'fa-bark-guard',
    castTime: 1, cooldown: 15, interruptible: false,
    target: { type: 'SELF' },
    effects: [{ type: 'APPLY_STATUS', status: 'bark_guard', to: 'SELF' }],
    mockFx: { color: '#c89a5a', area: 'SINGLE' },
    conditions: [{ type: 'SELF_BELOW', pct: 0.85 }, { type: 'SELF_LACKS_STATUS', status: 'bark_guard' }], recovery: 0.3, interruptRecovery: 0,
  },

  // ---- Forest Oblivion — Stage 10 stationary boss (spec §7 PROPOSED set). Every attack originates at its anchor.
  oblivion_slam: {
    id: 'oblivion_slam', name: 'ทุบรากสูญสิ้น', label: 'HEAVY ROOT SLAM', type: 'ATTACK',
    castTime: 1.6, cooldown: 8, interruptible: false, range: 2,
    target: { type: 'CURRENT_TARGET' },
    effects: [{ type: 'DAMAGE', mul: 1.9, area: 'FRONT_ARC', center: 'SELF' }],
    mockFx: { color: '#8b1a1a', area: 'FRONT_ARC' },
    conditions: [{ type: 'ENEMY_WITHIN', range: 2 }], recovery: 0.4, interruptRecovery: 0.6,
  },
  branch_sweep: {
    id: 'branch_sweep', name: 'กวาดกิ่งพิฆาต', label: 'WIDE BRANCH SWEEP', type: 'ATTACK',
    castTime: 1.4, cooldown: 10, interruptible: false, firstCastDelay: 4,
    target: { type: 'SELF' },
    effects: [{ type: 'DAMAGE', mul: 1.2, area: 'RADIUS_2', center: 'SELF' }],
    mockFx: { color: '#6b2a3a', area: 'RADIUS_2' },
    conditions: [{ type: 'ENEMY_WITHIN', range: 2 }], recovery: 0.4, interruptRecovery: 0.6,
  },
  root_eruption: {
    id: 'root_eruption', name: 'รากวิปลาสปะทุ', label: 'CORRUPTED ROOT ERUPTION', type: 'ATTACK',
    castTime: 2, cooldown: 11, interruptible: true, interruptPriority: 'MEDIUM', firstCastDelay: 6,
    target: { type: 'HERO_PRIORITY', classes: ['healer', 'mage', 'archer'], backRowOnly: true },
    effects: [
      { type: 'DAMAGE', mul: 1.2, area: 'SINGLE', center: 'TARGET', damageType: 'MAGIC' },
      { type: 'APPLY_STATUS', status: 'root', to: 'TARGET', duration: 2 },
    ],
    mockFx: { color: '#5a1a3a', area: 'SINGLE' },
    conditions: [], recovery: 0.3, interruptRecovery: 0.6,
  },
  dark_mist_pressure: {
    id: 'dark_mist_pressure', name: 'หมอกมืดบีบ', label: 'DARK MIST PRESSURE', type: 'ATTACK',
    castTime: 1.5, cooldown: 16, interruptible: false, firstCastDelay: 10,
    target: { type: 'HERO_CLUSTER', area: 'SQUARE_2', min: 2 },
    effects: [{ type: 'APPLY_STATUS', status: 'oblivion_mist', to: 'AREA', area: 'SQUARE_2', center: 'TARGET' }],
    mockFx: { color: '#4b3a6b', area: 'SQUARE_2' },
    conditions: [], recovery: 0.3, interruptRecovery: 0,
  },
  /**
   * Protected core → Break → exposed core → recovery (spec §7 suggested minimum loop).
   * A 5 s charge that can't be interrupted, only BROKEN (150 = needs more than one breaker). Broken = `exposed_core`
   * (5 s, +50 % damage taken, no actions) then the core closes again. Not broken = party-wide burst + healing ↓.
   */
  core_surge: {
    id: 'core_surge', name: 'แกนกลางปะทุ', label: 'CORE SURGE', type: 'ATTACK',
    castTime: 5, cooldown: 16, interruptible: false, interruptPriority: 'CRITICAL', breakRequired: 150, brokenStatus: 'exposed_core',
    firstCastDelay: 8,
    target: { type: 'ALL_HEROES' },
    effects: [
      { type: 'DAMAGE', mul: 1.7, area: 'ALL_ENEMIES', center: 'SELF' },
      { type: 'APPLY_STATUS', status: 'healing_reduction', to: 'HIT', duration: 6 },
    ],
    mockFx: { color: '#7fe8ff', area: 'ALL_ENEMIES' },
    conditions: [], recovery: 0.5, interruptRecovery: 0,
  },
};

// ------------------------------------------------------------------ monsters

const TAGS = (...t: string[]) => ['forest_arc', ...t];

export const FOREST_ARC_MONSTERS: Record<string, MonsterDefinition> = {
  // stats ← legacy goblin_fighter
  forest_goblin: {
    id: 'forest_goblin', name: 'ก็อบลินป่า', rank: 'COMMON', role: 'FRONTLINE_MELEE', tags: TAGS('goblin'),
    displayClass: 'fighter', visual: 'mock_fa_forest_goblin',
    stats: base({ maxHp: 140, attack: 22, defense: 10, moveSpeed: 2.4, attackRange: 1.3, preferredRange: 1.1, attackCooldown: 1.5, attackWindup: 0.255, targetThinkInterval: 0.35 }),
    ai: { targeting: FRONT, movement: 'MELEE_CHASE' },
    attack: melee('goblin_strike', 1, 0.25), skills: [], animation: art('forest_goblin'),
  },
  // stats ← legacy goblin_archer
  goblin_archer: {
    id: 'goblin_archer', name: 'ก็อบลินพลธนู', rank: 'COMMON', role: 'RANGED_DPS', tags: TAGS('goblin'),
    displayClass: 'archer', visual: 'mock_fa_goblin_archer',
    stats: base({
      maxHp: 90, attack: 20, defense: 4, moveSpeed: 2.2, attackRange: 7, preferredRange: 6, minComfortableRange: 3, rangeTolerance: 0.5,
      attackCooldown: 1.8, attackWindup: 0.34, targetThinkInterval: 0.35, collisionRadius: 0.35,
    }),
    ai: { targeting: { strategy: 'LOWEST_HP_PCT', targetLockDuration: 1.0, similarHpTolerance: 0.05 }, movement: 'RANGED_HOLD', maxRetreatSteps: 1 },
    attack: bolt('goblin_arrow_shot', 'goblin_arrow', 1, 'PHYSICAL'), skills: [], animation: art('goblin_archer'),
  },
  // stats ← legacy forest_wolf
  forest_wolf: {
    id: 'forest_wolf', name: 'หมาป่าป่าลึก', rank: 'COMMON', role: 'FAST_MELEE_DPS', tags: TAGS('wolf'),
    displayClass: 'fighter', visual: 'mock_fa_forest_wolf',
    stats: base({ maxHp: 110, attack: 24, defense: 6, moveSpeed: 4.2, attackRange: 1.2, preferredRange: 1.0, attackCooldown: 1.15, attackWindup: 0.255, attackRecovery: 0.15, targetThinkInterval: 0.25 }),
    ai: { targeting: { strategy: 'NEAREST_REACHABLE_FRONT', targetLockDuration: 1.0 }, movement: 'MELEE_CHASE' },
    attack: melee('forest_wolf_bite', 1, 0.4), skills: [], animation: art('forest_wolf'),
  },
  // stats ← legacy alpha_wolf
  alpha_wolf: {
    id: 'alpha_wolf', name: 'จ่าฝูงหมาป่า', rank: 'ELITE', role: 'ELITE_MELEE / INTERRUPT TUTOR', tags: TAGS('wolf'),
    displayClass: 'fighter', visual: 'mock_fa_alpha_wolf',
    stats: base({
      maxHp: 450, attack: 32, defense: 15, moveSpeed: 3.5, attackRange: 1.4, preferredRange: 1.2, attackCooldown: 1.35,
      attackWindup: 0.255, attackRecovery: 0.2, targetThinkInterval: 0.25, hitReactionDuration: 0.1, minHitReactionInterval: 2.0, collisionRadius: 0.5,
    }),
    ai: { targeting: { strategy: 'NEAREST_REACHABLE_FRONT', targetLockDuration: 1.0 }, movement: 'MELEE_CHASE', skillPriority: ['alpha_howl', 'charge_claw'] },
    attack: melee('alpha_savage_bite', 1.25, 0.4), skills: ['alpha_howl', 'charge_claw'], animation: art('alpha_wolf'),
  },
  // stats ← legacy magic_mushroom (HP / ATK / DEF), fought up close (spec: body bash, no poison / spores)
  mushroom_creature: {
    id: 'mushroom_creature', name: 'เห็ดยักษ์', rank: 'COMMON', role: 'STURDY_MELEE', tags: TAGS('mushroom'),
    displayClass: 'tank', visual: 'mock_fa_mushroom_creature',
    stats: base({ maxHp: 220, attack: 48, defense: 12, moveSpeed: 1.4, attackRange: 1.2, attackCooldown: 1.8, attackWindup: 0.35 }),
    ai: { targeting: FRONT, movement: 'MELEE_CHASE' },
    attack: melee('mushroom_bash', 0.9), skills: [], animation: art('mushroom_creature'),
  },
  // stats ← legacy goblin_guard (defensive silhouette, slime pace)
  thorn_slime: {
    id: 'thorn_slime', name: 'สไลม์หนาม', rank: 'COMMON', role: 'DEFENSIVE_MELEE', tags: TAGS('slime'),
    displayClass: 'tank', visual: 'mock_fa_thorn_slime',
    stats: base({ maxHp: 520, attack: 70, defense: 40, moveSpeed: 1.6, attackRange: 1.2, attackCooldown: 1.6 }),
    ai: { targeting: FRONT, movement: 'MELEE_CHASE' },
    attack: melee('thorn_body_slam', 1.1), skills: [], animation: art('thorn_slime'),
  },
  // stats ← legacy forest_spirit (fragile harasser), as a fast biter
  mist_bat: {
    id: 'mist_bat', name: 'ค้างคาวหมอก', rank: 'COMMON', role: 'FLYING_HARASSER', tags: TAGS('bat', 'mist'),
    displayClass: 'assassin', visual: 'mock_fa_mist_bat',
    stats: base({ maxHp: 170, attack: 60, defense: 6, moveSpeed: 3.6, attackRange: 1.2, attackCooldown: 1.6, attackWindup: 0.25, targetThinkInterval: 0.25 }),
    ai: { targeting: { strategy: 'NEAREST_REACHABLE_FRONT', targetLockDuration: 1.0 }, movement: 'MELEE_CHASE' },
    attack: melee('mist_bat_bite', 1, 0.4), skills: [], animation: art('mist_bat'),
  },
  // stats ← legacy corrupted_treant × 0.7 HP / × 0.85 ATK / DEF 40 (a younger tree, not a body blocker)
  young_treant: {
    id: 'young_treant', name: 'ทรีแอนต์หนุ่ม', rank: 'COMMON', role: 'FRONTLINE_TANK', tags: TAGS('treant'),
    displayClass: 'tank', visual: 'mock_fa_young_treant',
    stats: base({ maxHp: 525, attack: 54, defense: 40, moveSpeed: 1.0, attackRange: 1.5, attackCooldown: 2.1, attackWindup: 0.45, collisionRadius: 0.55, minHitReactionInterval: 1.5 }),
    ai: { targeting: { strategy: 'NEAREST_REACHABLE_FRONT', targetLockDuration: 1.5 }, movement: 'MELEE_CHASE' },
    attack: melee('branch_strike', 1.3, 0.4), skills: [], animation: art('young_treant'),
  },
  // stats ← legacy mist_wraith
  mist_wraith: {
    id: 'mist_wraith', name: 'วิญญาณหมอก', rank: 'SPECIAL', role: 'EVASIVE / BACKLINE PRESSURE', tags: TAGS('mist'),
    displayClass: 'assassin', visual: 'mock_fa_mist_wraith',
    stats: base({ maxHp: 190, attack: 74, defense: 5, moveSpeed: 3.0, attackRange: 1.3, attackCooldown: 1.4 }),
    ai: { targeting: { strategy: 'NEAREST_REACHABLE_FRONT', targetLockDuration: 1.5 }, movement: 'MELEE_CHASE', skillPriority: ['mist_shift', 'spectral_slash'] },
    attack: melee('mist_claw', 1, 0.4), skills: ['mist_shift', 'spectral_slash'], animation: art('mist_wraith'),
  },
  // stats ← legacy corrupted_wolf (bleed dropped: not a current mechanic)
  corrupted_wolf: {
    id: 'corrupted_wolf', name: 'หมาป่าวิปลาส', rank: 'COMMON', role: 'AGGRESSIVE_MELEE', tags: TAGS('wolf', 'corrupted'),
    displayClass: 'fighter', visual: 'mock_fa_corrupted_wolf',
    stats: base({ maxHp: 260, attack: 62, defense: 10, moveSpeed: 4.4, attackRange: 1.2, attackCooldown: 1.1, attackWindup: 0.25, targetThinkInterval: 0.25 }),
    ai: { targeting: { strategy: 'NEAREST_REACHABLE_FRONT', targetLockDuration: 1.0 }, movement: 'MELEE_CHASE' },
    attack: melee('corrupted_bite', 1, 0.4), skills: [], animation: art('corrupted_wolf'),
  },
  // stats ← legacy corrupted_treant
  corrupted_treant: {
    id: 'corrupted_treant', name: 'ทรีแอนต์วิปลาส', rank: 'COMMON', role: 'DURABLE_FRONTLINE', tags: TAGS('treant', 'corrupted'),
    displayClass: 'tank', visual: 'mock_fa_corrupted_treant',
    stats: base({ maxHp: 750, attack: 64, defense: 48, moveSpeed: 0.9, attackRange: 1.5, attackCooldown: 2.1, attackWindup: 0.45, bodyBlock: true, collisionRadius: 0.6, minHitReactionInterval: 1.5 }),
    ai: { targeting: { strategy: 'NEAREST_REACHABLE_FRONT', targetLockDuration: 1.5 }, movement: 'MELEE_CHASE' },
    attack: melee('heavy_branch', 1.3, 0.4), skills: [], animation: art('corrupted_treant'),
  },
  // stats ← legacy dark_shaman (Dark Heal / Soul Link dropped)
  dark_shaman: {
    id: 'dark_shaman', name: 'หมอผีมืด', rank: 'ELITE', role: 'SUPPORT / DEBUFFER', tags: TAGS('caster', 'dark'),
    displayClass: 'healer', visual: 'mock_fa_dark_shaman',
    stats: base({ maxHp: 290, attack: 62, defense: 14, moveSpeed: 1.7, attackRange: 6, preferredRange: 3.5, attackCooldown: 1.8, minComfortableRange: 3, rangeTolerance: 0.5 }),
    ai: { targeting: FRONT, movement: 'RANGED_HOLD', maxRetreatSteps: 1, skillPriority: ['dark_chant', 'weakening_hex'] },
    attack: bolt('dark_bolt', 'dark_bolt'), skills: ['weakening_hex', 'dark_chant'], animation: art('dark_shaman'),
  },
  // stats ← legacy mist_witch (Nightmare / Dark Fog replaced)
  mist_witch: {
    id: 'mist_witch', name: 'แม่มดหมอก', rank: 'SPECIAL', role: 'CASTER / ZONE CONTROL', tags: TAGS('caster', 'mist'),
    displayClass: 'mage', visual: 'mock_fa_mist_witch',
    stats: base({ maxHp: 240, attack: 76, defense: 9, moveSpeed: 1.8, attackRange: 6, preferredRange: 3.5, attackCooldown: 1.9, minComfortableRange: 3, rangeTolerance: 0.5 }),
    ai: { targeting: FRONT, movement: 'RANGED_HOLD', maxRetreatSteps: 1, skillPriority: ['veil_curse', 'black_fog'] },
    attack: bolt('mist_bolt', 'dark_bolt'), skills: ['black_fog', 'veil_curse'], animation: art('mist_witch'),
  },
  // stats ← legacy elder_treant (Stage 7 boss)
  elder_treant: {
    id: 'elder_treant', name: 'ทรีแอนต์ผู้เฒ่า', rank: 'BOSS', role: 'TANK / SUMMONER', tags: TAGS('treant', 'forest'),
    displayClass: 'tank', visual: 'mock_fa_elder_treant', immune: ['KNOCKBACK', 'STUN'],
    stats: base({ maxHp: 7000, attack: 145, defense: 45, moveSpeed: 1.2, attackRange: 2, attackCooldown: 1.8, attackWindup: 0.45, hitReactionDuration: 0.1, minHitReactionInterval: 3, collisionRadius: 0.7 }),
    ai: {
      targeting: { strategy: 'NEAREST_REACHABLE_FRONT', targetLockDuration: 2.5 }, movement: 'MELEE_CHASE',
      skillPriority: ['call_of_the_forest', 'bark_guard', 'entangling_roots', 'heavy_root_slam'],
    },
    attack: melee('rooted_smash', 1.1, 0.5),
    skills: ['call_of_the_forest', 'bark_guard', 'entangling_roots', 'heavy_root_slam'], animation: art('elder_treant'),
    phases: [
      // Enraged Forest (spec suggested ~50 %): faster attacks + every skill cooldown × 0.8, one-time setup window
      { id: 'enraged_forest', label: 'ENRAGED FOREST', hpBelow: 0.5, transition: 1, statuses: ['enraged_forest'], cooldownScale: 0.8 },
    ],
  },
  /**
   * Stage 10 boss — stats ← legacy fallen_forest_guardian. LOCKED: never moves. `holdArena` leash 0 (no chase, no
   * stepping off its spawn cell), immune to KNOCKBACK / TAUNT / ROOT / STUN, no movement skills, no root motion.
   */
  forest_oblivion: {
    id: 'forest_oblivion', name: 'พงไพรสูญสิ้น', rank: 'FINAL_BOSS', role: 'STATIONARY BOSS / CORE / BREAK', tags: TAGS('boss', 'corrupted'),
    displayClass: 'tank', visual: 'mock_fa_forest_oblivion', immune: ['KNOCKBACK', 'TAUNT', 'ROOT', 'STUN'],
    stats: base({ maxHp: 12000, attack: 125, defense: 60, moveSpeed: 1, attackRange: 2, attackCooldown: 1.65, attackWindup: 0.45, hitReactionDuration: 0.1, minHitReactionInterval: 4, collisionRadius: 0.8 }),
    ai: {
      targeting: { strategy: 'NEAREST_REACHABLE_FRONT', targetLockDuration: 3 }, movement: 'MELEE_CHASE', holdArena: { leash: 0, returnAfter: 0 },
      skillPriority: ['core_surge', 'root_eruption', 'dark_mist_pressure', 'branch_sweep', 'oblivion_slam'],
    },
    attack: melee('oblivion_claw', 1.2, 0.5),
    skills: ['core_surge', 'root_eruption', 'dark_mist_pressure', 'branch_sweep', 'oblivion_slam'], animation: art('forest_oblivion'),
  },
};
