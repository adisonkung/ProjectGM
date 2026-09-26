import { CombatModifiers, ResistableStatus } from '../../core/models/progression';
import { MANA_PER_ATTACK, MANA_PER_HIT, RECEIVE_GAUGE_ICD, START_CD } from '../../core/data/classes';
import { kitInterrupts, kitOf } from '../../core/data/hero-skills';
import { rankedKit } from '../../core/rules/skill-ranks';
import { ENEMY_SKILL_START_CD, ENEMY_SKILLS, EnemySkillDef } from '../../core/data/enemy-skills';
import { animTiming, SkillKind } from '../../core/data/sprites';
import { HeroClass } from '../../core/models/hero';
import { EnemyTemplate, StageDef } from '../../core/models/stage';
import { Cell, Side, UnitSpec } from '../../core/models/unit';
import { BUFFS, castTimeline, MONSTER_SKILLS, MONSTERS, PROJECTILES } from '../../core/data/monsters';
import { AttackDefinition, isBossRank, MonsterDefinition, MonsterSkillDefinition, SemanticEvent } from '../../core/models/monster';
import { enemyStats } from '../../core/rules/stats';
import { resolveArea } from './area';
import { ActiveBuff, applyBuff, dodgeChance, hasFlag, hasStatus, modifier, tauntSource, tickStatuses } from './buffs';
import { breakRequiredOf, canStopCast, priorityOf, rankOf, SkillHost, SkillSystem, StatusApplyOptions } from './skill-system';
import type { DamageKind, InterruptPriority, SkillSlot, SkillUseMode } from '../../core/models/combat';
import { BattleMetrics } from './metrics';
import { isRanged, Positioning, SAFE_DANGER } from './positioning';
import { FormationRuntime } from './stage/formation';
import {
  getActiveBattlefieldHeroes, getAliveHeroes, getAllPartyHeroes, getDeadHiddenHeroes, getDeadVisibleHeroes, PLAYER_TEAM,
} from './stage/party';
import { resolveRules, StageBattleRules } from './stage/rules';
import { StageFlow, StageHost } from './stage/stage-flow';
import { BattlePhase, CombatActivity, LifeState, ReviveHeroCommand, ReviveResult, StageEvent, StageResult } from './stage/types';
import { CRIT_CHANCE, DamageResolver, effectiveAttack } from './damage-resolver';
import { BOARD_COLS, distance, Grid, LANES, Line, lineOf, SIDE_DEPTH, STACK_CAP, toBoard } from './grid';
import { CombatContext, isBigMonster, MonsterCombatState, MonsterController } from './monster-controller';
import { greedyStep, nextStep } from './pathfinding';
import { createRng } from './rng';

/** Mist Hunter window after an enemy stops being untargetable (s) */
const MIST_HUNTER_WINDOW = 3;

export type BattleResult = 'win' | 'lose' | 'timeout';

export type BattleEvent =
  | { type: 'attack'; src: number; dst: number }
  | { type: 'cast'; src: number; skill: string; kind: SkillKind; dst?: number }
  | { type: 'move'; src: number }
  /** จังหวะที่สกิลโดนจริง (ตรงเฟรม hit ของท่า) — ใช้เล่นเอฟเฟกต์ที่เป้าหมาย */
  | { type: 'impact'; src: number; dst?: number; kind: SkillKind }
  /** ย้ายตัวแบบวาร์ป (ไม่ต้องเลื่อนตัวบนจอ) */
  | { type: 'blink'; src: number }
  /** hurt = play the hit reaction (monsters: rate-limited, never while attacking/casting) */
  | { type: 'damage'; dst: number; amount: number; crit: boolean; blocked: number; poison?: boolean; hurt?: boolean }
  | { type: 'heal'; dst: number; amount: number; src?: number }
  /** ลูกธนู/ลูกแสงที่บินไปหาเป้า (sky = ตกจากฟ้า) ดาเมจเข้าเมื่อถึง */
  | { type: 'projectile'; src: number; dst: number; kind: 'attack' | SkillKind; flight: number; sky?: boolean; pid?: number }
  /** a real (colliding) projectile hit a unit / ran out of lifetime */
  | { type: 'projectileHit'; pid: number; dst: number }
  | { type: 'projectileExpire'; pid: number }
  /** semantic animation event reached (DAMAGE, PROJECTILE_SPAWN, SKILL_ACTIVATE …) */
  | { type: 'animEvent'; src: number; event: SemanticEvent; name: string }
  /** melee hit event fired but the target had moved out of reach */
  | { type: 'miss'; src: number; dst: number }
  /** ฟื้นคืนชีพ */
  | { type: 'revive'; src: number; dst: number; amount: number }
  /** ได้โล่ (src = ผู้ให้) */
  | { type: 'shield'; src: number; dst: number; amount: number }
  | { type: 'death'; dst: number }
  | { type: 'spawn'; dst: number }
  /** ศัตรูเริ่มร่ายสกิล (มีแถบร่าย) */
  | {
      type: 'castStart'; src: number; skill: string; label: string; castTime: number; interruptible: boolean; dst?: number;
      /** no cast bar (e.g. Mist Form: the caster turns to mist instead) */
      hidden?: boolean;
      /** Break Gauge size of a non-interruptible but breakable cast */
      breakRequired?: number;
    }
  /** CAST_PROGRESS: every 25% of the cast */
  | { type: 'castProgress'; src: number; skill: string; pct: number }
  /** SKILL_ACTIVATED: the cast reached its activation point (effects applied now) */
  | { type: 'skillActivated'; src: number; skill: string; name: string; targets: number[] }
  /** ร่ายสำเร็จ สกิลออกผล (CAST_COMPLETED) */
  | { type: 'castDone'; src: number; skill: string }
  /** cast stopped without an interrupt (caster died / battle ended) — hide the cast bar */
  | { type: 'castCancel'; src: number; skill: string; reason: 'death' | 'end' | 'phase' }
  /** buff applied (refreshed = an existing instance got its duration reset) / expired */
  | { type: 'buff'; src: number; dst: number; buff: string; name: string; refreshed: boolean }
  | { type: 'buffEnd'; dst: number; buff: string }
  /** play / stop a skill FX on a unit (cast FX synced to activation) */
  | { type: 'fx'; src: number; name: string }
  | { type: 'fxStop'; src: number; name: string }
  /** ตัดการร่ายสำเร็จ (src = ผู้ตัด) */
  | { type: 'interrupt'; src: number; dst: number; skill: string }
  /** dedicated interrupt landed (InterruptSystem) — skill = the cancelled skill id */
  | { type: 'CAST_INTERRUPTED'; src: number; dst: number; skill: string }
  /** พยายามตัดแต่สกิลนี้ตัดไม่ได้ / สถานะที่เป้าต้านทาน (skill = ชื่อสกิลหรือสถานะ) */
  | { type: 'immune'; src: number; dst: number; skill: string }
  /** BREAK_GAUGE: break damage dealt to a breakable cast (value / max) */
  | { type: 'breakGauge'; src: number; dst: number; skill: string; value: number; max: number }
  /** BOSS_BROKEN: the gauge filled — cast cancelled, BROKEN applied, skill on full cooldown */
  | { type: 'broken'; src: number; dst: number; skill: string }
  /** BOSS_PHASE_CHANGED */
  | { type: 'bossPhase'; src: number; phase: string; label: string; index: number }
  /** boss seal (untargetable phase) ended — every add of the phase is dead */
  | { type: 'sealBroken'; src: number }
  /** periodic boss pulse (Dark Pulse) hitting every hero */
  | { type: 'pulse'; src: number; name: string }
  /** a monster summoned another (skill / phase) */
  | { type: 'summon'; src: number; dst: number; skill: string }
  /** SOUL LINK moved part of the carrier's damage to its protector */
  | { type: 'soulLink'; src: number; dst: number; amount: number }
  /** เปลี่ยนเป้าโฟกัส (null = ยกเลิก; reason บอกว่ายกเลิกเพราะอะไร) */
  | { type: 'focus'; dst: number | null; reason?: 'player' | 'dead' | 'advance' | 'end' }
  /** Stage / Wave / transition events (PHASE_CHANGED, WAVE_CLEARED, ADVANCE_STARTED, HERO_REVIVED …) */
  | StageEvent;

/** เหตุผลที่ฮีโร่เลือกเป้าตอนนี้ (แสดงใต้รูปในแถบตัวละคร) */
export type Intent = 'normal' | 'focus' | 'hold' | 'blocked' | 'heal' | 'interrupt' | 'taunted';

/** Anything the generic cast system can cast (legacy enemy skills and data-driven monster skills) */
export type CastSkillDef = EnemySkillDef | MonsterSkillDefinition;
export const isMonsterSkill = (d: CastSkillDef): d is MonsterSkillDefinition => 'effects' in d;

/** A real projectile in flight (board cell coordinates, x = column, y = lane) */
export interface RuntimeProjectile {
  id: number;
  defId: string;
  attackerId: number;
  side: Side;
  targetId: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  /** pre-mitigation damage snapshot at spawn */
  damage: number;
  sourceId: string;
}

export interface BattleUnit {
  id: number;
  side: Side;
  name: string;
  cls: HeroClass;
  star?: number;
  level?: number;
  sprite?: string;
  boss?: boolean;
  heroUid?: number;
  heroId?: string;
  /** hero progression: skill ranks + equipment utility (undefined = rank 1, no gear) */
  mods?: CombatModifiers;
  /** the kit this unit fights with (skill ranks applied to a copy; undefined = authored kit) */
  kit?: import('../../core/models/combat').HeroKit;
  /** last time this unit was untargetable (Mist Hunter: +damage for 3 s after it returns) */
  lastUntargetableAt?: number;
  /** logical combat cell on the current encounter grid (column 0–15 × lane 0–2) */
  pos: Cell;
  /**
   * continuous world position (x = world column, y = lane) — what the battlefield renders.
   * During COMBAT it glides toward the logical cell; during transitions it is driven directly (advance / regroup).
   */
  x: number;
  y: number;
  /** แนวรบตามฟอร์เมชัน (แถวหน้า/หลัง) ใช้เลือกเป้า */
  line: Line;
  /** wave this unit belongs to (0-based); -1 = not wave-bound (the player team) */
  wave: number;
  /** counts toward "wave cleared" (false = disposable summons / scenery) */
  required: boolean;
  /** logical life state (source of truth) — `alive` mirrors life === 'ALIVE' */
  life: LifeState;
  /** what it is doing now (debug / UI) */
  activity: CombatActivity;
  /** battlefield visual presence (renderer / hitbox / selection) — separate from the logical state */
  visible: boolean;
  diedOnWave: number | null;
  revivedCount: number;
  /** REVIVING: seconds until ALIVE (untargetable while materialising) */
  reviveTimer: number;
  maxHp: number;
  hp: number;
  atk: number;
  def: number;
  atkSpeed: number;
  moveSpeed: number;
  range: number;
  maxMana: number;
  mana: number;
  alive: boolean;
  targetId: number | null;
  atkCd: number;
  moveCd: number;
  /** เวลาที่ยังค้างท่าร่ายสกิล (ขยับ/ตีไม่ได้) */
  castLock: number;
  /** คูลดาวน์ที่เหลือของสกิล 1 / สกิล 2 (วิ) */
  cd1: number;
  cd2: number;
  /** ผู้เล่นสั่งท่าไม้ตายแล้ว รอจังหวะร่าย */
  ultQueued: boolean;
  /** ศัตรู: สกิลร่ายที่มี + คูลดาวน์ที่เหลือ */
  castSkills: { def: CastSkillDef; cd: number }[];
  /** ล็อกเป้าถึงเวลานี้ (กันเปลี่ยนเป้าทุกเฟรม) และรอบคิดของ AI (ทุก THINK วิ) */
  lockUntil: number;
  thinkCd: number;
  /** เหตุผลของการเลือกเป้าล่าสุด */
  intent: Intent;
  /** กำลังร่าย (state = CASTING): ยืนนิ่ง ทำอย่างอื่นไม่ได้ */
  casting: {
    def: CastSkillDef; left: number; target: number | null; token: number; nextProgress: number;
    /** Break Gauge filled so far (breakable casts) */
    breakDamage: number;
    /** interrupt / break commitments of heroes whose skills are on the way (InterruptReservation) */
    commits?: { by: number; breakPower: number; until: number }[];
  } | null;
  /** เตรียมไว้สำหรับบอสในอนาคต (Break Gauge) — ยังไม่ใช้ */
  interruptResistance: number;
  /** โล่ดูดซับดาเมจ และเวลาที่เหลือ */
  shield: number;
  shieldTime: number;
  /** runtime status effects: buffs, debuffs, DoT/HoT, stun/root/taunted (base stats are never modified) */
  buffs: ActiveBuff[];
  /** battle time of the last receive-hit gauge gain (+2, internal cooldown RECEIVE_GAUGE_ICD) */
  lastGaugeHitAt: number;
  /** charge / dash / knock-back: the visual position slides fast until this time */
  dashUntil: number;
  /** false while dead / reviving (future: untargetable phases) */
  targetable: boolean;
  /** cells — projectile collision */
  collisionRadius: number;
  elite?: boolean;
  /** fraction of the target's DEF ignored by this unit's damage (Forest Spirit 0.2) */
  defenseIgnore?: number;
  /** heavy body: hostile units can't walk through its cell (Corrupted Treant) */
  bodyBlock?: boolean;
  /** summoned by this unit (skill / boss phase) */
  summonedBy?: number;
  /** hero AI use mode per slot (player / tactical override; default = the skill's useMode or AUTO) */
  skillModes: Partial<Record<SkillSlot, SkillUseMode>>;
  /** interrupt skills ignore casts below this priority (tactical setting; default LOW = any) */
  interruptMinPriority: InterruptPriority;
  /** player ordered skill 1 / 2 (manual activation, also for RESERVE / MANUAL skills) */
  skillQueued: 'skill' | 'skill2' | null;
  /** data-driven monster: runtime state (definition in MONSTERS) */
  monster?: MonsterCombatState;
}

export interface BattleConfig {
  allies: UnitSpec[];
  stage: StageDef;
  enemyTemplates: Record<string, EnemyTemplate>;
  seed?: number;
  /** ฝั่งเราร่ายท่าไม้ตายเองเมื่อเกจเต็ม (จำลอง/โหมดออโต้) · ศัตรูร่ายเองเสมอ */
  autoUlt?: boolean;
  /** data-driven monsters (default MONSTERS) — stage enemy ids are looked up here first */
  monsters?: Record<string, MonsterDefinition>;
  /** override the stage's battle rules (tests / special modes) */
  rules?: Partial<StageBattleRules>;
}

/** stage stat tuning may only nudge monsters: difficulty must come from mechanics (HP +40%, ATK +25%, DEF +30% max) */
export const MONSTER_TUNING_LIMITS = { hp: 1.4, atk: 1.25, def: 1.3 };

/**
 * A stage asking for more than the tuning ceilings is flagged, never silently applied beyond them (the engine clamps):
 * that stage needs a mechanic / composition / hero power review, not bigger numbers. [] = within limits.
 */
export function monsterTuningReview(stage: StageDef): string[] {
  const t = stage.monsterTuning ?? {};
  const out: string[] = [];
  for (const k of ['hp', 'atk', 'def'] as const) {
    const v = t[k];
    if (v != null && v > MONSTER_TUNING_LIMITS[k] + 1e-9) out.push(`${k.toUpperCase()} ×${v} > ×${MONSTER_TUNING_LIMITS[k]}`);
  }
  return out;
}

/** CAST_PROGRESS granularity */
const CAST_PROGRESS_STEP = 0.25;
/** hero collision radius (cells) for projectiles */
const HERO_RADIUS = 0.35;

const CAST_LOCK = 0.4;
/** hero projectiles: flight = base + per cell · sky volleys fall in a fixed time */
const PROJ_BASE = 0.1;
const PROJ_PER_CELL = 0.06;
const PROJ_SKY = 0.35;
/** fast visible slide for charges / dashes (cells per second) */
const DASH_SPEED = 14;
/** STEP 9: AI คิดเลือกเป้าทุก 0.25 วิ · เปลี่ยนเป้าแล้วล็อกอย่างน้อย 0.6 วิ (ยกเว้นเป้าตาย/โฟกัสเปลี่ยน) */
const THINK = 0.25;
const TARGET_LOCK = 0.6;

/**
 * เอนจินต่อสู้อัตโนมัติบนสนาม 3 เลน x 12 (TypeScript ล้วน ไม่ผูกกับ Angular)
 * ด่านกำจัดมีหลายเวฟได้ (stage.rounds): เคลียร์แล้วทีมเดินไปจุดถัดไป ADVANCE_TIME วินาที แล้วศัตรูเวฟใหม่เกิด
 * เรียก step(dt) ซ้ำ ๆ จนกว่า result จะไม่เป็น null
 */
export class BattleEngine {
  readonly units: BattleUnit[] = [];
  readonly grid = new Grid(STACK_CAP);
  /** colliding projectiles currently flying */
  readonly projectiles: RuntimeProjectile[] = [];
  /** runs every data-driven monster (one shared state machine) */
  readonly monsterAI: MonsterController;
  /** hero skills: targeting, AI tiers, effects (data in core/data/hero-skills.ts) */
  readonly skills: SkillSystem;
  /** hero positioning: leash, threat zones, danger score, safe engagement */
  readonly positioning: Positioning;
  /** simulation metrics (decisions vs stats) */
  readonly metrics = new BattleMetrics();
  private readonly monsterDefs: Record<string, MonsterDefinition>;
  private seq = 1;
  /** เวลารวม (รวมช่วงเปลี่ยนเวฟ) */
  time = 0;
  /** เวลาที่ต่อสู้จริง (ใช้กับเวลาจำกัดของด่าน) */
  fightTime = 0;
  /** Stage / Wave / transition state machine of this battle session */
  readonly flow: StageFlow;
  readonly rules: StageBattleRules;
  private listeners: ((e: BattleEvent) => void)[] = [];

  private readonly rng: () => number;
  private readonly stage: StageDef;
  private readonly templates: Record<string, EnemyTemplate>;
  private events = new EventQueue(e => this.listeners.forEach(l => l(e)));
  /** การกระทำที่รอให้ท่าถึงเฟรม hit/move ก่อน (เรียงตามเวลาที่ใส่) */
  private pending: { at: number; fn: () => void }[] = [];
  private nextId = 1;
  private nextWaveAt: number;
  private reinforcementIndex = 0;
  private readonly enemyCap: number;
  /** STEP 9: เป้าโฟกัสที่ผู้เล่นเลือก (ศัตรู) — เป็นการเพิ่มลำดับความสำคัญ ไม่ใช่คำสั่งบังคับ */
  focusTargetId: number | null = null;
  /** ฝั่งเราร่ายท่าไม้ตายเองเมื่อเกจเต็ม (สลับได้ระหว่างสู้) */
  autoUlt: boolean;

  constructor(cfg: BattleConfig) {
    this.rng = createRng(cfg.seed ?? Date.now());
    this.stage = cfg.stage;
    this.templates = cfg.enemyTemplates;
    this.autoUlt = cfg.autoUlt ?? false;
    this.monsterDefs = cfg.monsters ?? MONSTERS;
    this.monsterAI = new MonsterController(this.combatContext(), this.monsterDefs, MONSTER_SKILLS);
    this.skills = new SkillSystem(this.skillHost());
    this.positioning = new Positioning({
      grid: this.grid,
      units: this.units,
      isValidTarget: (u, t) => this.isValidTarget(u, t),
      anchorOf: u => (u.side === PLAYER_TEAM ? this.flow?.formation.localAnchorOf(u.id) ?? null : null),
      bodyBlocked: u => this.bodyBlocked(u),
      attackRangeOf: t => (t.monster ? this.monsterDefs[t.monster.definitionId]?.stats.attackRange ?? t.range : t.range),
    });
    this.nextWaveAt = cfg.stage.waveEvery ?? Infinity;
    this.enemyCap = cfg.stage.enemies.length;
    this.rules = { ...resolveRules(cfg.stage), ...(cfg.rules ?? {}) };
    this.flow = new StageFlow(this.stageHost(), cfg.stage, this.rules);

    for (const spec of cfg.allies) {
      const u = this.addUnit('ally', spec);
      if (u) this.flow.assignPlayer(u, spec.pos.r, spec.pos.c);
    }
    this.flow.spawnWave(0, false);
  }

  // ---------------------------------------------------------------- stage API

  get phase(): BattlePhase {
    return this.flow.phase;
  }
  /** current wave (0-based) / number of waves */
  get waveIndex(): number {
    return this.flow.waveIndex;
  }
  get totalWaves(): number {
    return this.flow.totalWaves;
  }
  get formation(): FormationRuntime {
    return this.flow.formation;
  }
  /** world x of the camera (left edge of the encounter window) */
  get cameraX(): number {
    return this.flow.cameraX;
  }
  get result(): BattleResult | null {
    return this.flow.outcome;
  }
  get stageResult(): StageResult | null {
    return this.flow.stageResult;
  }
  /** a wave transition is running (no combat) */
  get inTransition(): boolean {
    const p = this.flow.phase;
    return p === BattlePhase.WAVE_CLEAR || p === BattlePhase.ADVANCING || p === BattlePhase.REGROUPING || p === BattlePhase.NEXT_WAVE_READY || p === BattlePhase.WAVE_START;
  }

  /** generic resurrection command (skills, items, shrines, events …) */
  reviveHero(cmd: ReviveHeroCommand): ReviveResult {
    const r = this.flow.revive(cmd);
    if (r.ok) {
      this.metrics.revives++;
      this.metrics.unit(cmd.unitId).revives++;
    }
    return r;
  }

  getAllPartyHeroes(): BattleUnit[] {
    return getAllPartyHeroes(this.units);
  }
  getAliveHeroes(): BattleUnit[] {
    return getAliveHeroes(this.units);
  }
  getDeadVisibleHeroes(): BattleUnit[] {
    return getDeadVisibleHeroes(this.units);
  }
  getDeadHiddenHeroes(): BattleUnit[] {
    return getDeadHiddenHeroes(this.units);
  }
  getActiveBattlefieldHeroes(): BattleUnit[] {
    return getActiveBattlefieldHeroes(this.units);
  }

  /** subscribe to every event as it happens (UI / audio / camera / quests / analytics); returns unsubscribe */
  subscribe(listener: (e: BattleEvent) => void): () => void {
    this.listeners.push(listener);
    return () => (this.listeners = this.listeners.filter(l => l !== listener));
  }

  /** ดึงเหตุการณ์ที่เกิดขึ้นตั้งแต่ครั้งก่อน (ใช้ทำแอนิเมชัน) */
  drainEvents(): BattleEvent[] {
    return this.events.drain();
  }

  alive(side: Side): BattleUnit[] {
    return this.units.filter(u => u.alive && u.side === side);
  }

  /** ฮีโร่ของเราที่ล้มในการต่อสู้นี้ (ยังตายอยู่) */
  fallenHeroUids(): number[] {
    return this.units.filter(u => u.side === PLAYER_TEAM && !u.alive && u.life !== 'REVIVING' && u.heroUid != null).map(u => u.heroUid!);
  }

  step(dt: number): void {
    if (this.result) return;
    this.time += dt;
    this.flow.update(dt);
    if (this.flow.stageResult) this.flow.stageResult.battleDuration = this.time;
  }

  /** one COMBAT tick: pending hits, projectiles, every unit's timers + AI, reinforcements, glide */
  private combatStep(dt: number): void {
    this.runPending();
    this.updateProjectiles(dt);
    this.fightTime += dt;
    // all units act; wave clear / wipe is evaluated by the flow after the whole tick (no update-order effects)
    for (const u of this.units) {
      if (!u.alive) continue;
      this.updateUnit(u, dt);
    }
    this.sampleMetrics(dt);
    if (this.stage.mode === 'survive' && this.fightTime >= this.nextWaveAt) {
      this.nextWaveAt += this.stage.waveEvery!;
      this.spawnReinforcements();
    }
    this.glide(dt);
  }

  /** per-tick metrics: Focus uptime, distance from the formation anchors */
  private sampleMetrics(dt: number): void {
    const m = this.metrics;
    const heroes = this.units.filter(u => u.side === PLAYER_TEAM && u.alive);
    for (const h of heroes) {
      const a = this.flow.formation.localAnchorOf(h.id);
      if (a) {
        m.anchorDistanceSum += distance(h.pos, a);
        m.anchorSamples++;
      }
    }
    if (this.focusTargetId != null && heroes.length) {
      m.focusTime += dt;
      m.focusHeroTime += dt * heroes.length;
      m.focusOnTargetHeroTime += dt * heroes.filter(h => h.targetId === this.focusTargetId).length;
    }
    for (const x of this.units) if (x.alive && x.side !== PLAYER_TEAM && hasFlag(x, 'untargetable')) x.lastUntargetableAt = this.time;
    for (const b of this.units) {
      if (!b.boss || !b.alive) continue;
      for (const st of b.buffs) if (st.def.buff) m.bossStatusTime[st.def.id] = (m.bossStatusTime[st.def.id] ?? 0) + dt;
    }
  }

  /** visual positions follow the logical cells continuously (no cell-centre locking on screen) */
  private glide(dt: number): void {
    const origin = this.flow.formation.originPosition;
    for (const u of this.units) {
      // dead units stop where they fell (movement cancelled)
      if (!u.visible || (u.life !== 'ALIVE' && u.life !== 'REVIVING')) continue;
      const tx = origin + u.pos.c;
      const ty = u.pos.r;
      const d = Math.hypot(tx - u.x, ty - u.y);
      if (d < 1e-4) continue;
      const step = Math.min(d, Math.max(u.moveSpeed, 1.5) * 1.15 * dt);
      u.x += ((tx - u.x) / d) * step;
      u.y += ((ty - u.y) / d) * step;
    }
  }

  /** the StageHost the flow drives (the flow never runs AI; the engine never decides phases) */
  private stageHost(): StageHost {
    const self = this;
    return {
      units: this.units,
      grid: this.grid,
      get fightTime() {
        return self.fightTime;
      },
      emit: e => self.events.push(e),
      spawnEnemy: (id, cell) => {
        const u = self.spawnEnemy(id, cell);
        if (u && self.flow && self.flow.phase !== BattlePhase.PREPARATION) self.events.push({ type: 'spawn', dst: u.id });
        return u;
      },
      combatStep: dt => self.combatStep(dt),
      tickTimers: (u, dt, cooldowns, statuses) => self.tickTimers(u, dt, cooldowns, statuses, true),
      runPending: () => self.runPending(),
      quiesce: reason => self.quiesce(reason),
      heal: (u, amount) => self.heal(u, amount),
    };
  }

  /** drop everything in flight: pending hits, projectiles, casts, focus */
  private quiesce(reason: 'advance' | 'end'): void {
    this.pending = [];
    this.projectiles.length = 0;
    for (const u of this.units) {
      if (u.casting) this.cancelCast(u, 'end');
      u.castLock = 0;
    }
    this.clearFocus(reason);
  }

  /** mana (ultimate gauge) only grows in COMBAT unless the stage rules say otherwise */
  private gainMana(u: BattleUnit, amount: number): void {
    if (u.maxMana <= 0) return;
    if (this.flow.phase !== BattlePhase.COMBAT && !this.rules.ultimateGaugeGenerationDuringTransition) return;
    u.mana = Math.min(u.maxMana, u.mana + amount);
  }

  /** รันจนจบโดยไม่แสดงผล (ใช้จำลอง/ปรับสมดุล) */
  run(dt = 0.05, maxTime = 300): BattleResult {
    while (!this.result && this.time < maxTime) this.step(dt);
    return this.result ?? 'timeout';
  }

  /** ทำสิ่งที่ถึงเวลาแล้ว (ดาเมจตรงเฟรม hit, วาร์ปตรงเฟรม move) */
  private runPending(): void {
    if (!this.pending.length) return;
    const due = this.pending.filter(p => p.at <= this.time + 1e-9);
    if (!due.length) return;
    this.pending = this.pending.filter(p => p.at > this.time + 1e-9);
    for (const p of due) p.fn();
  }

  /** รอ `delay` วินาทีแล้วค่อยทำ (ยกเลิกถ้าผู้ใช้ล้มไปก่อน) */
  later(delay: number, u: BattleUnit, fn: () => void): void {
    const run = () => {
      if (u.alive) fn();
    };
    if (delay <= 0) run();
    else this.pending.push({ at: this.time + delay, fn: run });
  }

  /** (unused helper kept for reference) เป้าเดิมถ้ายังอยู่ ไม่งั้นศัตรูที่ใกล้ที่สุดในระยะ */
  private liveTarget(u: BattleUnit, t: BattleUnit): BattleUnit | null {
    if (t.alive) return t;
    return (
      this.alive(u.side === 'ally' ? 'enemy' : 'ally')
        .filter(f => distance(f.pos, u.pos) <= u.range + 1)
        .sort((a, b) => distance(a.pos, u.pos) - distance(b.pos, u.pos) || a.id - b.id)[0] ?? null
    );
  }

  // ---------------------------------------------------------------- setup

  private addUnit(side: Side, spec: UnitSpec, boardPos?: Cell): BattleUnit | null {
    let pos = boardPos ?? toBoard(side, spec.pos);
    if (!this.grid.isFree(pos)) {
      const alt = this.freeCellOnSide(side, spec.cls);
      if (!alt) return null;
      pos = alt;
    }
    const s = spec.stats;
    const u: BattleUnit = {
      id: this.nextId++,
      side,
      name: spec.name,
      cls: spec.cls,
      star: spec.star,
      level: spec.level,
      sprite: spec.sprite,
      boss: spec.boss,
      heroUid: spec.heroUid,
      heroId: spec.heroId,
      mods: spec.mods,
      kit: spec.skillRanks ? rankedKit(spec.heroId, spec.cls, spec.skillRanks) : undefined,
      pos,
      x: (this.flow?.formation.originPosition ?? 0) + pos.c,
      y: pos.r,
      wave: side === PLAYER_TEAM ? -1 : this.flow?.waveIndex ?? 0,
      required: true,
      life: 'ALIVE',
      activity: 'IDLE',
      visible: true,
      diedOnWave: null,
      revivedCount: 0,
      reviveTimer: 0,
      maxHp: s.hp,
      hp: s.hp,
      atk: s.atk,
      def: s.def,
      atkSpeed: s.atkSpeed,
      moveSpeed: s.moveSpeed,
      range: s.range,
      maxMana: s.maxMana,
      mana: 0,
      alive: true,
      targetId: null,
      atkCd: this.rng() * 0.3,
      moveCd: 0,
      castLock: 0,
      // skills start at 50% of their cooldown
      cd1: (rankedKit(spec.heroId, spec.cls, spec.skillRanks).skill.cooldown ?? 0) * START_CD,
      cd2: (rankedKit(spec.heroId, spec.cls, spec.skillRanks).skill2.cooldown ?? 0) * START_CD,
      ultQueued: false,
      castSkills: [],
      lockUntil: 0,
      thinkCd: 0,
      intent: 'normal',
      casting: null,
      interruptResistance: 0,
      line: lineOf(spec.pos.r),
      shield: 0,
      shieldTime: 0,
      buffs: [],
      lastGaugeHitAt: -Infinity,
      dashUntil: 0,
      targetable: true,
      collisionRadius: HERO_RADIUS,
      skillModes: {},
      interruptMinPriority: 'LOW',
      skillQueued: null,
    };
    this.grid.place(u.id, pos);
    this.units.push(u);
    return u;
  }

  private spawnEnemy(enemyId: string, local?: Cell): BattleUnit | null {
    const m = this.monsterDefs[enemyId];
    if (m) return this.spawnMonster(m, local);
    const t = this.templates[enemyId];
    if (!t) throw new Error(`Unknown enemy: ${enemyId}`);
    const pos = local ?? { r: SIDE_DEPTH - 1, c: Math.floor(this.rng() * LANES) };
    const u = this.addUnit('enemy', {
      name: t.name,
      cls: t.cls,
      boss: t.boss,
      sprite: t.sprite,
      stats: enemyStats(t, this.stage),
      pos,
    });
    if (u) {
      u.interruptResistance = t.interruptResistance ?? 0;
      u.castSkills = (t.castSkills ?? [])
        .map(id => ENEMY_SKILLS[id])
        .filter(Boolean)
        .map(def => ({ def, cd: def.cooldown * ENEMY_SKILL_START_CD }));
    }
    return u;
  }

  /** Spawn a data-driven monster: stats/skills from its definition, runtime state separate */
  private spawnMonster(def: MonsterDefinition, local?: Cell, boardPos?: Cell): BattleUnit | null {
    const pos = local ?? { r: SIDE_DEPTH - 1, c: Math.floor(this.rng() * LANES) };
    const t = this.stage.monsterTuning ?? {};
    const clamp = (v: number | undefined, max: number) => Math.min(max, Math.max(1, v ?? 1));
    const kHp = clamp(t.hp, MONSTER_TUNING_LIMITS.hp);
    const kAtk = clamp(t.atk, MONSTER_TUNING_LIMITS.atk);
    const kDef = clamp(t.def, MONSTER_TUNING_LIMITS.def);
    const st = def.stats;
    const u = this.addUnit('enemy', {
      name: def.name,
      cls: def.displayClass,
      boss: isBossRank(def.rank),
      sprite: def.animation.sheet,
      stats: {
        hp: Math.round(st.maxHp * kHp),
        atk: Math.round(st.attack * kAtk),
        def: Math.round(st.defense * kDef),
        atkSpeed: 1 / st.attackCooldown,
        moveSpeed: st.moveSpeed,
        range: st.attackRange,
        maxMana: 0,
      },
      pos,
    }, boardPos);
    if (!u) return null;
    u.elite = def.rank === 'ELITE';
    u.collisionRadius = st.collisionRadius;
    u.defenseIgnore = st.defenseIgnore;
    u.bodyBlock = st.bodyBlock;
    u.moveCd = 0;
    // first cast: firstCastDelay (default cooldown × 0.5) ± initialDelayRandom (casters of one kind don't sync)
    u.castSkills = def.skills
      .map(id => MONSTER_SKILLS[id])
      .filter(Boolean)
      .map(sk => ({
        def: sk,
        cd: Math.max(0, (sk.firstCastDelay ?? sk.cooldown * ENEMY_SKILL_START_CD) + (sk.initialDelayRandom ? (this.rng() * 2 - 1) * sk.initialDelayRandom : 0)),
      }));
    u.monster = MonsterController.createState(u.id, def);
    if (u.boss && this.metrics.bossSpawnedAt == null) this.metrics.bossSpawnedAt = this.time;
    return u;
  }

  /** survive mode: explicitly configured reinforcements (part of the current wave) */
  private spawnReinforcements(): void {
    const pool = this.stage.waves ?? this.stage.enemies.map(e => e.enemy);
    let need = this.enemyCap - this.alive('enemy').length;
    while (need-- > 0) {
      const u = this.spawnEnemy(pool[this.reinforcementIndex++ % pool.length]);
      if (u) this.events.push({ type: 'spawn', dst: u.id });
    }
  }

  /** หาช่องว่างในครึ่งกระดานของฝั่งนั้น แถวหน้าก่อนสำหรับสายประชิด แถวหลังก่อนสำหรับสายระยะไกล */
  private freeCellOnSide(side: Side, cls: HeroClass): Cell | null {
    const depth = Array.from({ length: SIDE_DEPTH }, (_, i) => i);
    const rows = cls === 'tank' || cls === 'fighter' || cls === 'assassin' ? depth : depth.reverse();
    const cols = [1, 0, 2];
    for (const r of rows) {
      for (const c of cols) {
        const cell = toBoard(side, { r, c });
        if (this.grid.isFree(cell)) return cell;
      }
    }
    return null;
  }

  // ---------------------------------------------------------------- per-unit logic

  /**
   * Timers of one unit. `cooldowns` = skill / attack cooldowns, `statuses` = buffs, debuffs, shields, poison …
   * During wave transitions the flow calls this with the stage rules' flags (battle time keeps running).
   */
  private tickTimers(u: BattleUnit, dt: number, cooldowns: boolean, statuses: boolean, transition = false): void {
    if (cooldowns) {
      u.atkCd -= dt;
      u.moveCd -= dt;
      // คูลดาวน์ติดลบได้ = สกิลพร้อมมานานแค่ไหนแล้ว (ใช้ตัดสินว่ารอ AoE นานเกินไปหรือยัง)
      u.cd1 = Math.max(-10, u.cd1 - dt);
      u.cd2 = Math.max(-10, u.cd2 - dt);
      if (u.thinkCd > 0) u.thinkCd -= dt;
      for (const cs of u.castSkills) if (cs.cd > 0) cs.cd -= dt;
    }
    if (transition && u.castLock > 0) u.castLock = Math.max(0, u.castLock - dt);
    if (!statuses) return;
    if (u.shieldTime > 0 && (u.shieldTime -= dt) <= 0) u.shield = 0;
    const st = tickStatuses(u, dt, transition);
    for (const t of st.ticks) {
      if (!u.alive) break;
      // DoT (poison): direct damage from the source's ATK snapshot · HoT: heal
      if (t.kind === 'DAMAGE') {
        // an untargetable unit (mist form, boss seal) can't be hurt — its DoTs keep running but deal nothing
        // equipment Bleed Guard: bleed ticks × (1 − bleedReduction)
        const bleedCut = t.buff.def.id === 'bleed' ? (u.mods?.bleedReduction ?? 0) : 0;
        if (bleedCut > 0) this.metrics.gearProcs['bleedReduced'] = (this.metrics.gearProcs['bleedReduced'] ?? 0) + 1;
        if (!hasFlag(u, 'untargetable')) this.applyDamage(u, Math.max(1, Math.round(t.amount * (1 - bleedCut))), false, true);
      }
      else this.heal(u, t.amount, this.units.find(x => x.id === t.buff.sourceId));
    }
    for (const b of st.expired) this.events.push({ type: 'buffEnd', dst: u.id, buff: b.def.id });
  }

  private updateUnit(u: BattleUnit, dt: number): void {
    this.tickTimers(u, dt, true, true);
    if (!u.alive) return;
    // data-driven monsters: shared state machine (targeting / movement / attack / cast from their definition)
    if (u.monster) {
      // sealed boss (Dark Mist Dominion): untargetable, pulses until its adds are dead — no other action
      if (u.monster.seal) return this.updateSeal(u, dt);
      this.monsterAI.update(u, dt);
      return;
    }
    // กำลังร่าย (CASTING): ยืนนิ่งจนร่ายเสร็จ หรือถูกตัด
    if (u.casting) {
      this.updateCast(u, dt);
      return;
    }
    if (u.castLock > 0) {
      u.castLock -= dt;
      return;
    }

    // stunned: no actions and no movement (timers keep running)
    if (hasFlag(u, 'stun')) return;

    // legacy token enemies with cast skills (floors 4–10): start a cast when ready
    if (u.castSkills.length && this.tryStartCast(u)) return;

    const current = this.acquireTarget(u);
    // healers show ✚ while someone needs healing (their basic action is a Heal Bolt then)
    if (u.side === PLAYER_TEAM && this.skills.healBoltTarget(u)) u.intent = 'heal';

    // player-ordered skill (any mode): fire at the skill's own target rules
    if (u.skillQueued && (u.skillQueued === 'skill' ? u.cd1 : u.cd2) <= 0) {
      const slot = u.skillQueued;
      const s = this.skills.kit(u)[slot];
      const t = this.skills.pickTarget(u, s, current);
      if (t) {
        u.skillQueued = null;
        this.skills.use(u, slot, s, t);
        u.atkCd = Math.max(u.atkCd, 0) + 1 / (u.atkSpeed * modifier(u, 'attackSpeedMultiplier'));
        return;
      }
    }

    // ultimate: full gauge + (player tap / AUTO per UltimateUseMode / enemy) → fires once a suitable target exists
    const ultMode = this.skills.mode(u, 'ult');
    const autoOk = this.autoUlt && ultMode !== 'MANUAL' && (ultMode !== 'RESERVE' || this.skills.reserveUltReady(u));
    const wantsUlt = u.ultQueued || u.side !== PLAYER_TEAM || autoOk;
    if (u.mana >= u.maxMana && wantsUlt && this.tryUltimate(u, u.ultQueued)) {
      u.ultQueued = false;
      return;
    }

    const aspd = u.atkSpeed * modifier(u, 'attackSpeedMultiplier');
    // interrupt opportunity: react right away (a cast bar won't wait for the attack timer)
    const intr = this.skills.chooseInterrupt(u, current);
    if (intr) {
      u.intent = 'interrupt';
      u.lockUntil = this.time + TARGET_LOCK;
      this.skills.use(u, intr.slot, intr.skill, intr.target);
      u.atkCd = Math.max(u.atkCd, 0) + 1 / aspd;
      return;
    }
    // an interruptible cast just out of reach of a ready interrupt: walk into range first
    const chase = u.side === PLAYER_TEAM ? this.skills.interruptChase(u) : null;
    if (chase) u.intent = 'interrupt';
    if (u.atkCd <= 0 && !chase) {
      // skill AI tiers: emergency → interrupt → heal → high value → normal (SkillSystem), else the basic action
      const pick = this.skills.chooseSkill(u, current);
      if (pick) {
        // an interrupt skill spent on damage (AUTO fallback) is not an interrupt: no intent / target lock for it
        const stopping = pick.tier === 'INTERRUPT' && pick.target.side !== u.side && !!pick.target.casting && canStopCast(pick.target.casting.def);
        if (stopping) u.intent = 'interrupt';
        else if (pick.tier === 'EMERGENCY' || pick.tier === 'HEAL') u.intent = 'heal';
        if (stopping) u.lockUntil = this.time + TARGET_LOCK;
        this.skills.use(u, pick.slot, pick.skill, pick.target);
        u.atkCd = Math.max(u.atkCd, 0) + 1 / aspd;
        return;
      }
      if (this.skills.basic(u, current)) {
        u.atkCd = Math.max(u.atkCd, 0) + 1 / aspd;
        return;
      }
    }
    const goal = chase ?? current;
    // ranged heroes: safe positioning (leash, threat zones, preferred range, frontline) instead of walking to max range
    if (u.side === PLAYER_TEAM && isRanged(u)) return this.rangedMove(u, goal, !!chase);
    if (!goal) return;
    if (!chase && distance(u.pos, goal.pos) <= u.range) {
      // ranged: keep distance while reloading — step back once when a foe is adjacent
      if (u.range >= 3 && u.moveCd <= 0) this.kite(u, goal);
      return;
    }

    // ROOT: cannot move (may still attack / cast when a target is in range)
    if (u.moveCd <= 0 && !hasFlag(u, 'root')) {
      const blocked = this.bodyBlocked(u);
      const step =
        nextStep(this.grid, u.pos, c => distance(c, goal.pos) <= (chase ? this.skills.interruptReach(u) : u.range), blocked) ??
        greedyStep(this.grid, u.pos, goal.pos, blocked);
      if (step) {
        this.grid.move(u.id, u.pos, step);
        u.pos = step;
        this.events.push({ type: 'move', src: u.id });
      }
      u.moveCd = 1 / u.moveSpeed;
    }
  }

  // ---------------------------------------------------------------- target resolver (STEP 8 + 9)

  /**
   * เลือกเป้า — Target Resolver กลาง (คิดทุก THINK วิ ไม่ใช่ทุกเฟรม)
   *   1. ถูกยั่วยุ → ต้องตีแทงก์ที่ยั่วยุ (บังคับ)
   *   2. หน้าที่สำคัญของสาย (critical role): แทงก์ที่กำลังถือแนวหน้าไม่ทิ้งศัตรูที่ประชิดอยู่
   *   3. โฟกัสของผู้เล่น — เฉพาะเมื่อ canEngage() (ยิงถึง / เดินถึงโดยไม่ต้องทะลุแนวหน้าศัตรู / นักฆ่าวาร์ปข้ามได้)
   *   4. AI ปกติตามสาย (normalTarget)
   * เปลี่ยนเป้าแล้วล็อก TARGET_LOCK วิ (กันกระพริบ) ยกเว้นเป้าเดิมตาย/หายไป หรือผู้เล่นเปลี่ยนโฟกัส
   * (ฮีลฉุกเฉินของฮีลเลอร์ และโอกาสตัดการร่าย จัดการใน updateUnit ก่อนมาถึงตรงนี้)
   */
  private acquireTarget(u: BattleUnit): BattleUnit | null {
    const foes = this.alive(u.side === 'ally' ? 'enemy' : 'ally').filter(f => f.targetable && !hasFlag(f, 'untargetable'));
    if (!foes.length) return null;

    // taunted (status from a tank): must attack that tank while it is valid
    const src = tauntSource(u);
    const taunter = src != null ? foes.find(f => f.id === src) : undefined;
    if (taunter) {
      u.targetId = taunter.id;
      u.intent = 'taunted';
      return taunter;
    }

    const current = foes.find(f => f.id === u.targetId) ?? null;
    if (current && u.thinkCd > 0) return current;
    u.thinkCd = THINK;

    const focus = u.side === 'ally' ? this.focusUnit() : null;
    const hold = this.holdTarget(u, foes, current);
    let pick: BattleUnit;
    let intent: Intent = 'normal';
    if (hold) {
      pick = hold;
      intent = focus && focus !== hold ? 'hold' : 'normal';
    } else if (focus && this.canEngage(u, focus, foes)) {
      // soft Focus: only when this hero can engage it safely (else keep fighting normally; Focus stays stored)
      pick = focus;
      intent = 'focus';
    } else {
      pick = this.normalTarget(u, foes, current);
      if (focus) intent = 'blocked';
    }

    // ล็อกเป้า: ยังไม่หมดเวลาล็อก + เป้าเดิมยังตีได้อยู่ → ไม่เปลี่ยน (โฟกัสใหม่รีเซ็ตล็อกให้แล้ว)
    if (current && pick !== current && this.time < u.lockUntil && distance(current.pos, u.pos) <= u.range) {
      return current;
    }
    if (pick !== current) u.lockUntil = this.time + TARGET_LOCK;
    u.targetId = pick.id;
    u.intent = intent;
    return pick;
  }

  /** AI ปกติตามสาย (STEP 8) */
  private normalTarget(u: BattleUnit, foes: BattleUnit[], current: BattleUnit | null): BattleUnit {
    const d = (f: BattleUnit) => distance(f.pos, u.pos);
    const inRange = foes.filter(f => d(f) <= u.range);
    if (current && (d(current) <= u.range || !inRange.length) && u.cls !== 'assassin') return current;
    const front = (f: BattleUnit) => (f.line === 'front' ? 0 : 1);
    if (u.cls === 'assassin') {
      // นักฆ่า: แถวหลังก่อน ฮีลเลอร์ > นักเวท > นักธนู > เลือดน้อย
      const order: Partial<Record<HeroClass, number>> = { healer: 0, mage: 1, archer: 2 };
      const backs = foes.filter(f => f.line === 'back');
      const pool = backs.length ? backs : foes;
      if (current && pool.includes(current)) return current;
      return [...pool].sort((a, b) => (order[a.cls] ?? 3) - (order[b.cls] ?? 3) || a.hp / a.maxHp - b.hp / b.maxHp || d(a) - d(b))[0];
    }
    if (u.range >= 3) {
      // สายระยะไกล: ในระยะยิง นักเวท > นักธนู > เลือดน้อย > ใกล้ · ไม่มีในระยะ → ใกล้สุด
      const order: Partial<Record<HeroClass, number>> = { mage: 0, archer: 1 };
      if (inRange.length) {
        return [...inRange].sort((a, b) => (order[a.cls] ?? 2) - (order[b.cls] ?? 2) || a.hp / a.maxHp - b.hp / b.maxHp || d(a) - d(b))[0];
      }
      if (u.side === PLAYER_TEAM) {
        // nothing in range: the enemy with the safest firing position inside the leash (nearest as a tie-break)
        const scored = foes
          .map(f => ({ f, spot: this.positioning.firingCell(u, f, { respectLeash: true, safeOnly: true }) }))
          .filter(x => x.spot)
          .sort((a, b) => a.spot!.danger - b.spot!.danger || d(a.f) - d(b.f));
        if (scored.length) return scored[0].f;
      }
      return [...foes].sort((a, b) => d(a) - d(b) || a.id - b.id)[0];
    }
    if (u.cls === 'tank') {
      // แทงก์: ศัตรูที่กำลังตีแถวหลังของเรา → บอส/อีลิท → ใกล้สุด
      const mine = new Set(this.alive(u.side).filter(a => a.line === 'back').map(a => a.id));
      const diving = (f: BattleUnit) => (f.targetId != null && mine.has(f.targetId) ? 0 : 1);
      const big = (f: BattleUnit) => Number(!!f.boss || !!f.elite);
      return [...foes].sort((a, b) => diving(a) - diving(b) || big(b) - big(a) || d(a) - d(b) || a.id - b.id)[0];
    }
    // สายประชิด: แถวหน้าก่อน (ในระยะถ้ามี) แล้วค่อยแถวหลัง
    const pool = inRange.length ? inRange : foes;
    return [...pool].sort((a, b) => front(a) - front(b) || d(a) - d(b) || a.id - b.id)[0];
  }

  /**
   * หน้าที่สำคัญของแทงก์: กำลังถือแนวหน้า (มีศัตรูประชิดตัว) → ตีตัวที่ประชิดต่อ ไม่วิ่งไปหาโฟกัส
   * (ศัตรูที่หลุดไปตีแถวหลังมาก่อน ถ้าอยู่ใกล้)
   */
  private holdTarget(u: BattleUnit, foes: BattleUnit[], current: BattleUnit | null): BattleUnit | null {
    if (u.cls !== 'tank') return null;
    const engaged = foes.filter(f => distance(f.pos, u.pos) <= 1);
    if (!engaged.length) return null;
    if (current && engaged.includes(current)) return current;
    const mine = new Set(this.alive(u.side).filter(a => a.line === 'back').map(a => a.id));
    return [...engaged].sort((a, b) => Number(!mine.has(a.targetId ?? -1)) - Number(!mine.has(b.targetId ?? -1)) || a.id - b.id)[0];
  }

  /**
   * ไปตีเป้านี้ได้อย่างสมเหตุสมผลไหม (STEP 9 canEngage)
   * - เป้าต้องยังอยู่ในสนามรอบนี้ และไม่ได้กำลังเดินไปเวฟถัดไป
   * - (ฮีโร่) ใช้ Positioning.canSafelyEngage: ระยะยิง/ตำแหน่งยิงที่ปลอดภัยในสายจูง/ระยะไล่โฟกัสของบทบาท
   * - นักฆ่า: วาร์ป/พุ่งข้ามแนวหน้าได้เสมอ
   * - สายประชิด: ใกล้ (≤ 2 ช่อง) หรือไม่มีศัตรูยืนขวางระหว่างทาง (คอลัมน์ระหว่างเรากับเป้า เลนติดกัน)
   */
  canEngage(u: BattleUnit, t: BattleUnit, _foes?: BattleUnit[]): boolean {
    if (u.side !== PLAYER_TEAM) {
      if (!this.isValidTarget(u, t)) return false;
      if (u.range >= 3 || u.cls === 'assassin' || distance(u.pos, t.pos) <= 2) return true;
    }
    const r = this.positioning.canSafelyEngage(u, t);
    return r.canAttackNow || r.canRepositionSafely;
  }

  // ---------------------------------------------------------------- focus (STEP 9)

  /** ผู้เล่นเลือก/ยกเลิกเป้าโฟกัส (เลือกตัวเดิมซ้ำ = ยกเลิก) */
  setFocus(id: number | null): number | null {
    const t = id == null ? null : this.units.find(x => x.id === id && x.side === 'enemy' && x.alive) ?? null;
    const next = !t || t.id === this.focusTargetId ? null : t.id;
    if (next === this.focusTargetId) return next;
    this.focusTargetId = next;
    // โฟกัสเปลี่ยน = เหตุการณ์ที่ให้ทุกคนคิดใหม่ทันที (ไม่ต้องรอหมดล็อก)
    for (const a of this.alive('ally')) {
      a.thinkCd = 0;
      a.lockUntil = 0;
    }
    this.events.push({ type: 'focus', dst: next, reason: 'player' });
    return next;
  }

  /** เป้าโฟกัสที่ยังใช้ได้ (ตาย/หลุดสนาม = ยกเลิกอัตโนมัติ) */
  private focusUnit(): BattleUnit | null {
    if (this.focusTargetId == null) return null;
    const t = this.units.find(x => x.id === this.focusTargetId);
    if (t && t.alive && t.visible && (t.wave < 0 || t.wave === this.flow.waveIndex)) return t;
    this.clearFocus(t && !t.alive ? 'dead' : 'advance');
    return null;
  }

  private clearFocus(reason: 'dead' | 'advance' | 'end'): void {
    if (this.focusTargetId == null) return;
    this.focusTargetId = null;
    for (const a of this.alive('ally')) {
      a.thinkCd = 0;
      a.lockUntil = 0;
    }
    this.events.push({ type: 'focus', dst: null, reason });
  }

  // ---------------------------------------------------------------- smart ultimates / kiting

  /**
   * Ranged hero movement: stay near the formation anchor, outside hostile melee threat zones, behind the allied frontline,
   * around the preferred range. In range → only small safer steps; out of range → walk to the best firing cell
   * (inside the leash first); nothing to shoot → drift back toward the anchor. Never snaps / teleports.
   */
  private rangedMove(u: BattleUnit, goal: BattleUnit | null, chase: boolean): void {
    const ally = () => !!goal && goal.side === u.side;
    if (u.moveCd > 0 || hasFlag(u, 'root')) return;
    const P = this.positioning;
    // healers: allied survival first — walk (safely) back into heal range of a hurt ally that drifted away
    const hb = this.skills.kit(u).healBolt;
    if (hb) {
      const hurt = this.units
        .filter(a => a !== u && a.alive && a.side === u.side && a.visible && a.hp < a.maxHp * hb.allyHpBelow && distance(a.pos, u.pos) > u.range)
        .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
      if (hurt) goal = hurt;
    }
    const zones = P.threats(u);
    const frontX = P.frontlineX(u);
    const here = P.danger(u, u.pos, zones, frontX);
    const blocked = this.bodyBlocked(u);
    // voluntary moves never path through hostile melee threat zones (unless already standing in one)
    const avoid = (c: { r: number; c: number }) => !!blocked?.(c) || (P.threatCount(c, zones) > 0 && here < SAFE_DANGER);
    const stepTo = (cell: { r: number; c: number }) => {
      if (cell.r === u.pos.r && cell.c === u.pos.c) return;
      const step = nextStep(this.grid, u.pos, c => c.r === cell.r && c.c === cell.c, avoid) ?? greedyStep(this.grid, u.pos, cell, avoid);
      if (!step) return;
      this.grid.move(u.id, u.pos, step);
      u.pos = step;
      u.moveCd = 1 / u.moveSpeed;
      this.events.push({ type: 'move', src: u.id });
      if (u.intent === 'focus' && here < SAFE_DANGER && P.threatCount(step, zones) > 0) this.metrics.unsafeFocusChaseCount++;
    };
    if (goal && distance(u.pos, goal.pos) <= u.range) {
      // already firing: only step if a clearly safer cell still keeps the target in range
      const alt = [u.pos, ...Grid.neighbors(u.pos)]
        .filter(c => (c === u.pos || (this.grid.canEnter(c) && !blocked?.(c))) && distance(c, goal.pos) <= u.range)
        .map(c => ({ c, d: P.danger(u, c, zones, frontX) }))
        .sort((a, b) => a.d - b.d)[0];
      if (alt && alt.d < here - 2) stepTo(alt.c);
      return;
    }
    if (goal) {
      const maxMove = chase ? 3 : undefined;
      const spot =
        P.firingCell(u, goal, { respectLeash: true, maxMove, safeOnly: true }) ??
        // leaving the leash only to save an ally, or when no allied melee hero is left to bring the fight closer
        (chase || (frontX != null && !ally()) ? null : P.firingCell(u, goal, { respectLeash: false, safeOnly: true })) ??
        (chase || (frontX != null && !ally()) ? null : P.firingCell(u, goal, { respectLeash: false }));
      if (spot) return stepTo(spot.cell);
    }
    // nothing safe to shoot: drift back toward the (fight-following) formation anchor
    const anchor = P.anchorOf(u);
    if (anchor && distance(u.pos, anchor) > 0.5 && this.grid.canEnter(anchor)) stepTo(anchor);
  }

  /** สายระยะไกลถอยหนีศัตรูที่ประชิดตัว 1 ก้าว ไปทางฝั่งตัวเอง (ต้องยังยิงเป้าถึง) — ROOT ห้ามขยับ */
  private kite(u: BattleUnit, target: BattleUnit): void {
    if (hasFlag(u, 'root')) return;
    const foes = this.alive(u.side === 'ally' ? 'enemy' : 'ally');
    const nearest = (c: Cell) => Math.min(...foes.map(f => distance(f.pos, c)));
    if (nearest(u.pos) > 1) return;
    const back = u.side === 'ally' ? -1 : 1;
    const step = Grid.neighbors(u.pos)
      .filter(c => this.grid.canEnter(c) && Math.sign(c.c - u.pos.c) !== -back && distance(c, target.pos) <= u.range)
      .sort((a, b) => nearest(b) - nearest(a) || Math.abs(a.r - u.pos.r) - Math.abs(b.r - u.pos.r))[0];
    if (!step || nearest(step) <= nearest(u.pos)) return;
    this.grid.move(u.id, u.pos, step);
    u.pos = step;
    u.moveCd = 1 / u.moveSpeed;
    this.events.push({ type: 'move', src: u.id });
  }

  // ---------------------------------------------------------------- casting / interrupt (STEP 7)

  /** เริ่มร่ายสกิลที่พร้อมตัวแรกที่มีเป้า */
  private tryStartCast(u: BattleUnit): boolean {
    const foes = this.alive(u.side === 'ally' ? 'enemy' : 'ally');
    if (!foes.length) return false;
    const near = Math.min(...foes.map(f => distance(f.pos, u.pos)));
    for (const cs of u.castSkills) {
      if (cs.cd > 0 || isMonsterSkill(cs.def)) continue;
      const def = cs.def;
      let target: BattleUnit | null = null;
      if (def.effect === 'meteor') {
        const inRange = foes.filter(f => distance(f.pos, u.pos) <= u.range);
        if (!inRange.length) continue;
        target = [...inRange].sort((a, b) => Number(a.line !== 'back') - Number(b.line !== 'back') || a.hp / a.maxHp - b.hp / b.maxHp)[0];
      } else if (def.effect === 'berserk') {
        if (near > 2) continue;
      } else if (def.effect === 'massHeal') {
        if (!this.alive(u.side).some(a => a.hp < a.maxHp * 0.75)) continue;
      } else if (near > Math.max(u.range, 3)) {
        continue; // แผ่นดินไหว/คลื่นมรณะ: ร่ายเมื่อเข้าปะทะแล้ว
      }
      this.beginCast(u, def, target);
      return true;
    }
    return false;
  }

  // ---------------------------------------------------------------- generic cast system
  // CAST_STARTED (castStart) → CAST_PROGRESS (castProgress) → SKILL_ACTIVATED (skillActivated) → CAST_COMPLETED (castDone)
  // or → CAST_INTERRUPTED (interrupt) / castCancel (death, battle end). Damage never interrupts; only interrupt skills do.

  private beginCast(u: BattleUnit, def: CastSkillDef, target: BattleUnit | null = null): void {
    const cs = u.castSkills.find(c => c.def === def);
    const mdef = isMonsterSkill(def) ? def : null;
    if (cs) cs.cd = mdef?.once ? Infinity : this.monsterAI.cooldownOf(u, def);
    const token = this.seq++;
    u.casting = { def, left: def.castTime, target: target?.id ?? null, token, nextProgress: CAST_PROGRESS_STEP, breakDamage: 0 };
    if (u.side !== PLAYER_TEAM && canStopCast(def)) this.metrics.interruptOpportunities++;
    if (u.monster) this.metrics.cast(def.id, 'started');
    // Mist Form: the caster turns to mist for the whole cast (no cast bar)
    const hidden = !!mdef?.untargetableWhileCasting;
    if (hidden) this.applyStatus(u, 'untargetable', u, def.castTime + 0.05);
    this.events.push({
      type: 'castStart', src: u.id, skill: def.name, label: def.label,
      castTime: def.castTime, interruptible: def.interruptible, ...(target ? { dst: target.id } : {}),
      ...(hidden ? { hidden } : {}), ...(mdef?.breakRequired ? { breakRequired: mdef.breakRequired } : {}),
    });
    // cast FX starts early so its activation frame lands exactly on SKILL_ACTIVATE
    const md = u.monster ? this.monsterDefs[u.monster.definitionId] : undefined;
    if (isMonsterSkill(def) && def.fx && md) {
      const fx = def.fx.id;
      const at = castTimeline(def, md.animation).fxStart ?? 0;
      this.later(Math.max(0, at), u, () => {
        if (u.casting?.token === token) this.events.push({ type: 'fx', src: u.id, name: fx });
      });
    }
  }

  private updateCast(u: BattleUnit, dt: number): void {
    const c = u.casting;
    if (!c) return;
    c.left -= dt;
    const pct = 1 - Math.max(0, c.left) / c.def.castTime;
    while (c.nextProgress < 1 - 1e-9 && pct >= c.nextProgress - 1e-9) {
      this.events.push({ type: 'castProgress', src: u.id, skill: c.def.id, pct: c.nextProgress });
      c.nextProgress += CAST_PROGRESS_STEP;
    }
    if (c.left <= 1e-9) this.finishCast(u);
  }

  /** Stop a cast without interrupt (caster died / battle over) */
  private cancelCast(u: BattleUnit, reason: 'death' | 'end' | 'phase'): void {
    const c = u.casting;
    if (!c) return;
    u.casting = null;
    if (u.monster) this.metrics.cast(c.def.id, 'cancelled');
    this.events.push({ type: 'castCancel', src: u.id, skill: c.def.id, reason });
    if (isMonsterSkill(c.def) && c.def.fx) this.events.push({ type: 'fxStop', src: u.id, name: c.def.fx.id });
    if (isMonsterSkill(c.def) && c.def.untargetableWhileCasting) this.removeStatus(u, 'untargetable');
    if (u.monster) this.monsterAI.onCastEnd(u, 'cancelled');
  }

  /**
   * SKILL_ACTIVATE of a data-driven skill — the MonsterSkill executor. Effects run in order on the units valid right now
   * (the aimed unit is re-validated; team-wide skills re-collect their targets). Everything comes from the skill data.
   */
  private activateMonsterSkill(u: BattleUnit, def: MonsterSkillDefinition, aimedId: number | null): void {
    const aimedUnit = aimedId != null ? this.units.find(x => x.id === aimedId) ?? null : null;
    // an aimed hero must still be a valid target; an aimed ally must still be alive
    let aim: BattleUnit | null = null;
    if (aimedUnit) aim = aimedUnit.side === u.side ? (aimedUnit.alive ? aimedUnit : null) : this.isValidTarget(u, aimedUnit) ? aimedUnit : null;
    const targets = this.monsterAI.skillTargets(u, def, aim);
    // exposure: how often a status-hunting skill (Mist Strike vs bleed) lands on a marked target
    for (const eff of def.effects) {
      if (eff.type !== 'DAMAGE' || !eff.bonusVsStatus || !aim) continue;
      const a = (this.metrics.skillAims[def.id] ??= { total: 0, marked: 0 });
      a.total++;
      if (aim.buffs.some(b => b.def.id === eff.bonusVsStatus!.status)) a.marked++;
    }
    const foes = () => this.units.filter(t => this.isValidTarget(u, t));
    const allies = () => this.units.filter(a => a.alive && a.side === u.side && (a.wave < 0 || a.wave === this.flow.waveIndex));
    const isDive = def.effects.some(e => e.type === 'LEAP_BEHIND');
    let hits: BattleUnit[] = [];
    for (const eff of def.effects) {
      if (!u.alive && eff.type !== 'SACRIFICE') break;
      switch (eff.type) {
        case 'APPLY_BUFF': {
          const b = BUFFS[eff.buffId];
          if (!b) break;
          for (const t of targets) {
            const r = applyBuff(t, b, u.id);
            this.events.push({ type: 'buff', src: u.id, dst: t.id, buff: b.id, name: b.name, refreshed: r === 'refreshed' });
          }
          break;
        }
        case 'DAMAGE': {
          const pool = foes();
          const single = eff.area === 'SINGLE';
          if (eff.center === 'TARGET' && !aim) {
            hits = [];
            break;
          }
          const list = eff.area === 'ALL_ENEMIES' ? pool : resolveArea({ pattern: eff.area, caster: u, primary: aim, center: eff.center, candidates: pool });
          hits = [];
          for (const t of list) {
            if (single && this.dodged(u, t)) continue;
            let bonus = eff.bonusVsStatus && t.buffs.some(b => b.def.id === eff.bonusVsStatus!.status) ? eff.bonusVsStatus.mul : 1;
            // equipment Backline Guard: teleport / dive skills (LEAP_BEHIND) deal less to the wearer
            if (isDive && t.mods?.diveReduction) {
              bonus *= 1 - t.mods.diveReduction;
              this.metrics.gearProcs['diveReduced'] = (this.metrics.gearProcs['diveReduced'] ?? 0) + 1;
            }
            if (eff.bonusVsStatus && t.buffs.some(b => b.def.id === eff.bonusVsStatus!.status)) this.metrics.bonusHits[def.id] = (this.metrics.bonusHits[def.id] ?? 0) + 1;
            const res = DamageResolver.resolve({ attacker: u, target: t, multiplier: eff.mul * bonus, damageType: eff.damageType ?? 'PHYSICAL', sourceId: def.id });
            this.applyDamage(t, res.amount, false, false, u);
            hits.push(t);
          }
          break;
        }
        case 'APPLY_STATUS': {
          const to =
            eff.to === 'HIT' ? hits : eff.to === 'TARGET' ? (aim ? [aim] : []) : eff.to === 'SELF' ? [u] : foes();
          for (const t of to) if (t.alive) this.applyStatus(t, eff.status, u, eff.duration);
          break;
        }
        case 'HEAL_PCT': {
          const to = eff.to === 'TARGET' ? (aim && aim.side === u.side ? [aim] : []) : allies().filter(a => !eff.excludeSummons || a.summonedBy == null);
          for (const a of to) this.heal(a, a.maxHp * eff.pct, u);
          break;
        }
        case 'LEAP_BEHIND': {
          if (!aim) break;
          // never overlap: land on a free cell next to the target, on its far side from the caster
          const cell = this.freeCellNear(aim.pos, u.pos);
          if (cell) this.relocate(u, cell, 'dash');
          if (u.monster) {
            u.monster.currentTargetId = aim.id;
            u.monster.targetLockUntil = this.time + 1.5;
          }
          u.targetId = aim.id;
          break;
        }
        case 'SUMMON': {
          const adds = this.summon(u, def.id, eff.monsters, eff.maxActive);
          // Ancient Protection: while any add of this skill lives (never stacks)
          if (eff.grantWhileAlive && adds.length) this.applyStatus(u, eff.grantWhileAlive, u);
          break;
        }
        case 'SOUL_LINK': {
          if (!aim || aim.side !== u.side) break;
          const st = SkillSystem.status(eff.status);
          const r = applyBuff(u, st, aim.id);
          this.events.push({ type: 'buff', src: aim.id, dst: u.id, buff: st.id, name: st.name, refreshed: r !== 'applied' });
          break;
        }
        case 'SACRIFICE': {
          const bosses = allies().filter(a => a !== u && a.monster && isBossRank(this.monsterDefs[a.monster.definitionId]?.rank ?? 'COMMON'));
          const b = SkillSystem.status(eff.buffId);
          for (const boss of bosses) {
            this.heal(boss, boss.maxHp * eff.bossHealPct, u);
            const r = applyBuff(boss, b, u.id);
            this.events.push({ type: 'buff', src: u.id, dst: boss.id, buff: b.id, name: b.name, refreshed: r !== 'applied' });
          }
          // the shaman gives its life for it
          if (u.alive) this.applyDamage(u, u.hp, false, true);
          break;
        }
      }
    }
    const md = this.monsterDefs[u.monster?.definitionId ?? ''];
    const mark = def.clip ? md?.animation.clips[def.clip]?.events?.find(e => e.event === 'SKILL_ACTIVATE') : undefined;
    this.events.push({ type: 'animEvent', src: u.id, event: 'SKILL_ACTIVATE', name: mark?.name ?? def.id });
    this.events.push({
      type: 'skillActivated', src: u.id, skill: def.id, name: def.name,
      targets: (hits.length ? hits : targets).map(t => t.id),
    });
  }

  /** a summoned add died: its summoner loses a `grantWhileAlive` status once none of that skill's adds remain */
  private onSummonDied(dead: BattleUnit): void {
    const owner = this.units.find(x => x.id === dead.summonedBy);
    if (!owner?.monster || !owner.alive) return;
    for (const [skillId, ids] of Object.entries(owner.monster.summons)) {
      if (!ids.includes(dead.id)) continue;
      const grant = MONSTER_SKILLS[skillId]?.effects.find(e => e.type === 'SUMMON' && e.grantWhileAlive);
      if (grant?.type === 'SUMMON' && grant.grantWhileAlive && !this.monsterAI.liveSummons(owner, skillId).length) {
        this.removeStatus(owner, grant.grantWhileAlive);
      }
    }
  }

  /** summon monsters next to the caster (never more than `maxActive` alive from this skill) */
  private summon(u: BattleUnit, skillId: string, list: { id: string; count: number }[], maxActive: number): BattleUnit[] {
    const out: BattleUnit[] = [];
    let room = maxActive - (u.monster ? this.monsterAI.liveSummons(u, skillId).length : 0);
    for (const m of list) {
      for (let i = 0; i < m.count && room > 0; i++) {
        const cell = this.summonCell(u);
        if (!cell) return out;
        const s = this.spawnMonsterAt(m.id, cell, u);
        if (!s) continue;
        room--;
        out.push(s);
        if (u.monster) (u.monster.summons[skillId] ??= []).push(s.id);
        this.events.push({ type: 'spawn', dst: s.id });
        this.events.push({ type: 'summon', src: u.id, dst: s.id, skill: skillId });
      }
    }
    return out;
  }

  /** a free cell near `u` (own side of it first, then anywhere) */
  private summonCell(u: BattleUnit): Cell | null {
    const back = u.side === 'enemy' ? 1 : -1;
    for (let r = 1; r <= 4; r++) {
      const ring: Cell[] = [];
      for (let dr = -r; dr <= r; dr++) {
        for (let dc = -r; dc <= r; dc++) {
          if (Math.max(Math.abs(dr), Math.abs(dc)) !== r) continue;
          const c = { r: u.pos.r + dr, c: u.pos.c + dc };
          if (this.grid.isFree(c)) ring.push(c);
        }
      }
      ring.sort((a, b) => Math.sign(b.c - u.pos.c) * back - Math.sign(a.c - u.pos.c) * back || Math.abs(a.r - u.pos.r) - Math.abs(b.r - u.pos.r) || a.c - b.c);
      if (ring.length) return ring[0];
    }
    return null;
  }

  /** spawn a data-driven monster on a board cell in the middle of combat (summons / phase adds) */
  private spawnMonsterAt(id: string, cell: Cell, by: BattleUnit): BattleUnit | null {
    const def = this.monsterDefs[id];
    if (!def) return null;
    const u = this.spawnMonster(def, { r: 0, c: 0 }, cell);
    if (!u) return null;
    u.wave = by.wave;
    u.summonedBy = by.id;
    u.x = this.flow.formation.originPosition + cell.c;
    u.y = cell.r;
    return u;
  }

  private finishCast(u: BattleUnit): void {
    const c = u.casting!;
    u.casting = null;
    if (u.side !== PLAYER_TEAM && canStopCast(c.def)) {
      if (rankOf(priorityOf(c.def)) >= rankOf('HIGH')) this.metrics.criticalCastsCompleted++;
      if (breakRequiredOf(c.def) > 0) this.metrics.breakFailure++;
    }
    if (isMonsterSkill(c.def)) {
      if (u.monster) this.metrics.cast(c.def.id, 'completed');
      if (c.def.untargetableWhileCasting) this.removeStatus(u, 'untargetable');
      this.activateMonsterSkill(u, c.def, c.target);
      this.events.push({ type: 'castDone', src: u.id, skill: c.def.name });
      if (u.monster) this.monsterAI.onCastEnd(u, 'completed');
      return;
    }
    u.castLock = CAST_LOCK;
    this.events.push({ type: 'castDone', src: u.id, skill: c.def.name });
    this.events.push({ type: 'cast', src: u.id, skill: c.def.name, kind: 'ult', ...(c.target != null ? { dst: c.target } : {}) });
    const foes = this.alive(u.side === 'ally' ? 'enemy' : 'ally');
    switch (c.def.effect) {
      case 'quake':
        for (const f of foes) this.applyDamage(f, Math.max(1, Math.round(f.maxHp * c.def.power)), false);
        break;
      case 'meteor': {
        const t = foes.find(f => f.id === c.target) ?? foes[0];
        if (!t) break;
        for (const f of foes.filter(f => distance(f.pos, t.pos) <= 1)) this.damage(u, f, f === t ? c.def.power : c.def.power * 0.6);
        break;
      }
      case 'massHeal':
        for (const a of this.alive(u.side)) this.heal(a, a.maxHp * c.def.power, u);
        break;
      case 'berserk':
        this.applyStatus(u, 'berserk', u, c.def.duration ?? 8);
        break;
    }
  }

  /** สกิลที่ตัดได้โดนตัวที่กำลังร่าย → ยกเลิกการร่าย สกิลนั้นเข้าคูลดาวน์เต็ม */
  private tryInterrupt(src: BattleUnit, dst: BattleUnit, breakPower = 0): void {
    const c = dst.casting;
    if (!c || !dst.alive) return;
    if (dst.side !== PLAYER_TEAM && canStopCast(c.def)) this.metrics.interruptAttempts++;
    if (!c.def.interruptible) {
      const need = isMonsterSkill(c.def) ? c.def.breakRequired ?? 0 : 0;
      if (need > 0 && breakPower > 0) return this.addBreak(src, dst, breakPower, need);
      this.events.push({ type: 'immune', src: src.id, dst: dst.id, skill: c.def.name });
      return;
    }
    dst.casting = null;
    this.metrics.interruptSuccesses++;
    if (dst.monster) this.metrics.cast(c.def.id, 'interrupted');
    const cs = dst.castSkills.find(x => x.def === c.def);
    // the skill still goes on (full) cooldown — a successful interrupt is a big win
    if (cs && cs.cd !== Infinity) cs.cd = (isMonsterSkill(c.def) ? c.def.interruptedCooldown : undefined) ?? this.monsterAI.cooldownOf(dst, c.def);
    this.events.push({ type: 'interrupt', src: src.id, dst: dst.id, skill: c.def.name });
    this.events.push({ type: 'CAST_INTERRUPTED', src: src.id, dst: dst.id, skill: c.def.id });
    if (isMonsterSkill(c.def) && c.def.fx) this.events.push({ type: 'fxStop', src: dst.id, name: c.def.fx.id });
    if (dst.monster) this.monsterAI.onCastEnd(dst, 'interrupted');
    else dst.castLock = CAST_LOCK;
  }

  /**
   * Break Gauge: approved interrupt skills deal break damage to a breakable (non-interruptible) cast.
   * Full gauge → the cast is cancelled (no effect), BROKEN (can't act, takes ×1.25), the skill goes on full cooldown.
   * The gauge belongs to that one cast — it resets with the next cast.
   */
  private addBreak(src: BattleUnit, dst: BattleUnit, power: number, need: number): void {
    const c = dst.casting!;
    c.breakDamage = Math.min(need, c.breakDamage + power);
    this.events.push({ type: 'breakGauge', src: src.id, dst: dst.id, skill: c.def.id, value: c.breakDamage, max: need });
    if (c.breakDamage < need) return;
    const def = c.def as MonsterSkillDefinition;
    dst.casting = null;
    const cs = dst.castSkills.find(x => x.def === c.def);
    if (cs) cs.cd = this.monsterAI.cooldownOf(dst, def);
    this.events.push({ type: 'broken', src: src.id, dst: dst.id, skill: def.id });
    this.metrics.interruptSuccesses++;
    this.metrics.breakSuccess++;
    this.metrics.cast(def.id, 'broken');
    this.events.push({ type: 'CAST_INTERRUPTED', src: src.id, dst: dst.id, skill: def.id });
    if (def.fx) this.events.push({ type: 'fxStop', src: dst.id, name: def.fx.id });
    if (dst.monster) this.monsterAI.onCastEnd(dst, 'interrupted');
    this.applyStatus(dst, def.brokenStatus ?? 'broken', src);
  }

  /** player / tactical setting: AI use mode of one hero slot (skill / skill2 / ult) */
  setSkillMode(id: number, slot: 'skill' | 'skill2' | 'ult', mode: SkillUseMode): void {
    const u = this.units.find(x => x.id === id);
    if (u) u.skillModes[slot] = mode;
  }

  /** player / tactical setting: this hero's interrupt skills ignore casts below `p` */
  setInterruptMinPriority(id: number, p: InterruptPriority): void {
    const u = this.units.find(x => x.id === id);
    if (u) u.interruptMinPriority = p;
  }

  /** could hero `id`'s skill 1 / 2 reach `targetId` now (in range, or a short allowed chase)? — used by the tactical bot */
  canReachWithSkill(id: number, slot: 'skill' | 'skill2', targetId: number): boolean {
    const u = this.units.find(x => x.id === id);
    const t = this.units.find(x => x.id === targetId);
    if (!u || !t || !u.alive || !t.alive) return false;
    const range = this.skills.rangeOf(u, this.skills.kit(u)[slot]);
    const d = distance(u.pos, t.pos);
    if (d <= range) return true;
    return d <= range + 3 && (this.skillHost().chaseAllowed?.(u, t) ?? true);
  }

  /** player orders skill 1 / 2 now (works for RESERVE / MANUAL skills too) — false = on cooldown / not possible */
  requestSkill(id: number, slot: 'skill' | 'skill2'): boolean {
    const u = this.units.find(x => x.id === id);
    if (!u || !u.alive || u.side !== PLAYER_TEAM || this.result) return false;
    if ((slot === 'skill' ? u.cd1 : u.cd2) > 0) return false;
    u.skillQueued = slot;
    return true;
  }

  /** ผู้เล่นกดใช้ท่าไม้ตาย (คืน false ถ้ายังใช้ไม่ได้) */
  requestUlt(id: number): boolean {
    const u = this.units.find(x => x.id === id);
    if (!u || !u.alive || u.side !== 'ally' || u.mana < u.maxMana || this.result) return false;
    u.ultQueued = true;
    return true;
  }

  /** ท่าไม้ตาย: ใช้เกจเต็ม (ผู้เล่นสั่ง = ขอแค่มีเป้า · ออโต้/ศัตรู = ต้องผ่านเงื่อนไข AI ด้วย) · เกจ = 0 */
  private tryUltimate(u: BattleUnit, manual: boolean): boolean {
    const t = this.skills.chooseUltimate(u, this.units.find(x => x.id === u.targetId) ?? null, manual);
    if (!t) return false;
    u.mana = 0;
    this.skills.use(u, 'ult', this.skills.kit(u).ult, t);
    return true;
  }

  /**
   * One hit through the DamageResolver (±10% variance, crit ×1.5, statuses) — false = dodged / target gone.
   * Plain damage never interrupts: interrupts are a separate, explicit effect (SkillSystem → interrupt()).
   */
  private hit(
    src: BattleUnit, dst: BattleUnit, mul: number, o: { crit?: boolean; damageType?: DamageKind; sourceId: string; slot?: SkillSlot },
  ): boolean {
    if (!dst.alive || hasFlag(dst, 'untargetable')) return false;
    if (this.dodged(src, dst)) return false;
    // DARK FOG: ranged units only — basic attacks ×0.75, skills / ultimates ×0.85 (melee and healing unaffected)
    if (src.range > 1.5 && o.slot) {
      mul *= modifier(src, o.slot === 'attack' ? 'rangedAttackMultiplier' : 'rangedSkillMultiplier');
    }
    // equipment: Execution (target below 30 % HP) · Mist Hunter (target back from untargetable within 3 s)
    if (src.mods) {
      if (src.mods.execution > 0 && dst.hp < dst.maxHp * 0.3) {
        mul *= 1 + src.mods.execution;
        this.metrics.gearProcs['execution'] = (this.metrics.gearProcs['execution'] ?? 0) + 1;
      }
      if (src.mods.mistHunter > 0 && dst.lastUntargetableAt != null && this.time - dst.lastUntargetableAt <= MIST_HUNTER_WINDOW) {
        mul *= 1 + src.mods.mistHunter;
        this.metrics.gearProcs['mistHunter'] = (this.metrics.gearProcs['mistHunter'] ?? 0) + 1;
      }
    }
    const res = DamageResolver.resolve({
      attacker: src, target: dst, multiplier: mul, damageType: o.damageType ?? 'PHYSICAL',
      sourceId: o.sourceId, variance: this.rng(), crit: !!o.crit, critMultiplier: src.mods?.critMultiplier,
    });
    this.applyDamage(dst, res.amount, res.crit, false, src);
    return true;
  }

  /** evasion (e.g. Nox Shadow Evasion 30%): the attack misses entirely */
  private dodged(src: BattleUnit, dst: BattleUnit): boolean {
    const chance = dodgeChance(dst);
    if (chance <= 0 || this.rng() >= chance) return false;
    this.events.push({ type: 'miss', src: src.id, dst: dst.id });
    return true;
  }

  /** legacy enemy cast skills (meteor) */
  private damage(src: BattleUnit, dst: BattleUnit, mul: number): void {
    this.hit(src, dst, mul, { crit: this.rng() < CRIT_CHANCE, sourceId: 'cast' });
  }

  private applyStatus(dst: BattleUnit, id: string, src: BattleUnit, duration?: number, opts?: StatusApplyOptions): void {
    if (!dst.alive) return;
    const def = this.rankedStatus(SkillSystem.status(id), opts?.modifiers);
    if (this.resists(dst, def)) {
      this.events.push({ type: 'immune', src: src.id, dst: dst.id, skill: def.name });
      return;
    }
    // equipment resistances shorten harmful statuses on heroes (bleed / poison / root / corruption / stun)
    const resist = dst.mods?.statusResist[def.id as ResistableStatus] ?? 0;
    if (resist > 0) {
      const base = duration ?? def.duration;
      if (Number.isFinite(base)) duration = base * (1 - resist);
    }
    const r = applyBuff(dst, def, src.id, { magnitude: effectiveAttack(src) * (opts?.potency ?? 1), duration });
    this.metrics.statusApplied[def.id] = (this.metrics.statusApplied[def.id] ?? 0) + 1;
    this.events.push({ type: 'buff', src: src.id, dst: dst.id, buff: def.id, name: def.name, refreshed: r !== 'applied' });
    if (def.flags?.includes('taunted')) {
      dst.targetId = src.id;
      if (dst.monster) dst.monster.currentTargetId = src.id;
    }
  }

  /** a skill rank's status modifiers (taunt_guard 45 % DR …) → a derived definition with the same id (cached) */
  private statusVariants = new Map<string, import('../../core/models/combat').StatusEffectDefinition>();
  private rankedStatus(def: import('../../core/models/combat').StatusEffectDefinition, mods?: StatusApplyOptions['modifiers']) {
    if (!mods) return def;
    const key = `${def.id}|${JSON.stringify(mods)}`;
    let v = this.statusVariants.get(key);
    if (!v) this.statusVariants.set(key, (v = { ...def, modifiers: { ...def.modifiers, ...mods } }));
    return v;
  }

  /** boss immunities (definition `immune`): STUN (unless the status is boss-valid, e.g. BROKEN) / ROOT / TAUNT */
  private resists(dst: BattleUnit, def: import('../../core/models/combat').StatusEffectDefinition): boolean {
    const immune = dst.monster ? this.monsterDefs[dst.monster.definitionId]?.immune : undefined;
    if (!immune?.length || def.bossValid) return false;
    const f = def.flags ?? [];
    return (f.includes('stun') && immune.includes('STUN')) || (f.includes('root') && immune.includes('ROOT')) ||
      (f.includes('taunted') && immune.includes('TAUNT'));
  }

  private removeStatus(u: BattleUnit, id: string): void {
    if (!hasStatus(u, id)) return;
    u.buffs = u.buffs.filter(b => b.def.id !== id);
    this.events.push({ type: 'buffEnd', dst: u.id, buff: id });
  }

  /** cells a hero can't walk through: hostile heavy bodies (Corrupted Treant) */
  private bodyBlocked(u: BattleUnit): ((c: Cell) => boolean) | undefined {
    const blockers = this.units.filter(b => b.alive && b.bodyBlock && b.side !== u.side);
    if (!blockers.length) return undefined;
    return c => blockers.some(b => b.pos.r === c.r && b.pos.c === c.c);
  }

  // ---------------------------------------------------------------- boss phases

  /** HP crossed the next phase threshold: enter it (thresholds in order, once each, never skipped) */
  private enterPhase(u: BattleUnit): void {
    const s = u.monster!;
    const def = this.monsterDefs[s.definitionId];
    const ph = def.phases![s.phaseIndex];
    s.phaseIndex++;
    this.metrics.bossPhaseReached = Math.max(this.metrics.bossPhaseReached, s.phaseIndex);
    this.metrics.bossPhases.push({ index: s.phaseIndex, id: ph.id, at: this.time });
    this.events.push({ type: 'bossPhase', src: u.id, phase: ph.id, label: ph.label, index: s.phaseIndex });
    if (ph.interruptSelf) {
      // immediately clear any cast / idle delay (recovery, hit reaction, pending swing)
      if (u.casting) this.cancelCast(u, 'phase');
      s.recoverTimer = 0;
      s.hurtTimer = 0;
      s.attackToken++;
      s.attackCooldownRemaining = 0;
      if (s.state === 'RECOVERING' || s.state === 'HURT' || s.state === 'ATTACKING' || s.state === 'CASTING') {
        s.state = 'SEARCHING';
        s.stateTime = 0;
        s.animationState = 'idle';
      }
    }
    for (const id of ph.statuses ?? []) this.applyStatus(u, id, u);
    if (ph.transition) this.applyStatus(u, 'phase_shift', u, ph.transition);
    if (ph.cooldownScale != null) {
      s.cooldownScale = ph.cooldownScale;
      for (const cs of u.castSkills) if (cs.cd !== Infinity) cs.cd = Math.min(cs.cd, this.monsterAI.cooldownOf(u, cs.def as MonsterSkillDefinition));
    }
    for (const [id, cd] of Object.entries(ph.cooldownOverride ?? {})) {
      s.cooldownOverride[id] = cd;
      const cs = u.castSkills.find(c => c.def.id === id);
      if (cs) cs.cd = Math.min(cs.cd, cd);
    }
    for (const e of ph.enableSkills ?? []) {
      const sk = MONSTER_SKILLS[e.id];
      if (sk && !u.castSkills.some(c => c.def.id === e.id)) u.castSkills.push({ def: sk, cd: e.firstDelay });
    }
    const adds = ph.summon ? this.summon(u, `phase:${ph.id}`, ph.summon, Infinity) : [];
    if (ph.seal && adds.length) {
      s.seal = { adds: adds.map(a => a.id), ...ph.seal, timer: ph.seal.pulseEvery };
      if (u.casting) this.cancelCast(u, 'phase');
      this.applyStatus(u, 'boss_seal', u);
      s.currentTargetId = null;
      u.targetId = null;
    }
  }

  /** sealed boss: pulse every `pulseEvery` s (pulseAtkPct × ATK to every hero) until the phase adds are dead */
  private updateSeal(u: BattleUnit, dt: number): void {
    const s = u.monster!;
    const seal = s.seal!;
    if (seal.adds.every(id => !this.units.find(x => x.id === id)?.alive)) {
      s.seal = null;
      this.metrics.sealBrokenAt ??= this.time;
      this.removeStatus(u, 'boss_seal');
      this.events.push({ type: 'sealBroken', src: u.id });
      return;
    }
    s.animationState = 'cast';
    if ((seal.timer -= dt) > 0) return;
    seal.timer += seal.pulseEvery;
    this.events.push({ type: 'pulse', src: u.id, name: seal.pulseName });
    for (const h of this.units.filter(t => this.isValidTarget(u, t))) {
      const res = DamageResolver.resolve({ attacker: u, target: h, multiplier: seal.pulseAtkPct, damageType: 'MAGIC', sourceId: 'dark_pulse' });
      this.applyDamage(h, res.amount, false, false, u);
    }
  }

  /** ช่องว่างรอบ ๆ ตำแหน่ง ที่อยู่ไกลจาก `from` ที่สุด (= ด้านหลังเป้าหมาย) */
  private freeCellNear(at: Cell, from: Cell): Cell | null {
    const free = Grid.neighbors(at).filter(c => this.grid.isFree(c));
    free.sort((a, b) => distance(b, from) - distance(a, from) || Math.abs(a.r - at.r) - Math.abs(b.r - at.r));
    return free[0] ?? null;
  }

  /** move a unit on the combat grid: blink = instant (fade in), dash = fast visible slide */
  private relocate(u: BattleUnit, cell: Cell, how: 'blink' | 'dash'): void {
    this.grid.move(u.id, u.pos, cell);
    u.pos = cell;
    if (how === 'blink') {
      u.x = this.flow.formation.originPosition + cell.c;
      u.y = cell.r;
      this.events.push({ type: 'blink', src: u.id });
    } else {
      u.dashUntil = this.time + 0.4;
      this.events.push({ type: 'move', src: u.id });
    }
  }

  /** the SkillHost the SkillSystem drives */
  private skillHost(): SkillHost {
    const self = this;
    const foesOf = (u: BattleUnit) => self.units.filter(t => self.isValidTarget(u, t));
    return {
      get time() {
        return self.time;
      },
      rng: () => self.rng(),
      emit: e => self.events.push(e),
      foes: u => (self.flow.phase === BattlePhase.COMBAT || self.flow.phase === BattlePhase.WAVE_CLEAR ? foesOf(u) : []),
      allies: u => self.units.filter(a => a.alive && a.side === u.side && a.visible && (a.wave < 0 || a.wave === self.flow.waveIndex)),
      deadAllies: u => {
        const dead = self.units.filter(a => a.side === u.side && a !== u && (a.life === 'DEAD_VISIBLE' || a.life === 'DEAD_HIDDEN') && a.wave < 0);
        return [...dead.filter(a => a.life === 'DEAD_VISIBLE'), ...dead.filter(a => a.life === 'DEAD_HIDDEN')];
      },
      focus: u => (u.side === PLAYER_TEAM ? self.focusUnit() : null),
      chaseAllowed: (u, f) => {
        if (u.side !== PLAYER_TEAM) return true;
        const P = self.positioning;
        if (isRanged(u)) return !!P.firingCell(u, f, { respectLeash: true, maxMove: 3, safeOnly: true });
        const anchor = self.flow.formation.localAnchorOf(u.id);
        if (anchor && distance(anchor, f.pos) > P.leashOf(u) + u.range + 1e-9) return false;
        // the tank does not abandon a held frontline to chase a caster
        return u.cls !== 'tank' || !self.units.some(o => o.side !== u.side && self.isValidTarget(u, o) && distance(o.pos, u.pos) <= 1);
      },
      onSkillUse: (u, slot, s) => {
        if (u.side === PLAYER_TEAM && slot !== 'attack') {
          if (slot === 'ult') self.metrics.unit(u.id).ults++;
          else self.metrics.unit(u.id).skills++;
        }
        if (u.side !== PLAYER_TEAM || slot === 'attack' || self.skills.mode(u, slot) !== 'RESERVE') return;
        if (s.effects.some(e => (e.type === 'DAMAGE' && e.interrupt) || e.type === 'INTERRUPT') &&
          self.units.some(f => f.side !== u.side && f.alive && f.casting && canStopCast(f.casting.def))) self.metrics.reservedSkillHits++;
        else self.metrics.reservedSkillMisses++;
      },
      later: (d, u, fn) => self.later(d, u, fn),
      shoot: (u, t, slot, sky, onArrive) => {
        const flight = sky ? PROJ_SKY : PROJ_BASE + PROJ_PER_CELL * distance(u.pos, t.pos);
        self.events.push({ type: 'projectile', src: u.id, dst: t.id, kind: slot, flight, ...(sky ? { sky } : {}) });
        self.pending.push({ at: self.time + flight, fn: onArrive });
      },
      hit: (src, dst, mul, o) => self.hit(src, dst, mul, o),
      heal: (dst, amount, src) => self.heal(dst, amount, src),
      applyStatus: (dst, id, src, duration, opts) => self.applyStatus(dst, id, src, duration, opts),
      interrupt: (src, dst, breakPower) => self.tryInterrupt(src, dst, breakPower),
      knockback: (src, dst, cells) => {
        if (dst.monster && self.monsterDefs[dst.monster.definitionId]?.immune?.includes('KNOCKBACK')) return;
        for (let i = 0; i < cells; i++) {
          const back = { r: dst.pos.r, c: dst.pos.c + (Math.sign(dst.pos.c - src.pos.c) || (src.side === 'ally' ? 1 : -1)) };
          if (!self.grid.canEnter(back)) break;
          self.grid.move(dst.id, dst.pos, back);
          dst.pos = back;
          dst.dashUntil = self.time + 0.3;
        }
      },
      shield: (src, dst, amount, duration) => {
        dst.shield += amount;
        dst.shieldTime = duration;
        self.events.push({ type: 'shield', src: src.id, dst: dst.id, amount });
      },
      revive: (src, dead, hpPct) =>
        self.reviveHero({ unitId: dead.id, reviveHpPercent: hpPct, sourceUnitId: src.id, sourceId: `ult:${src.heroId ?? src.cls}`, countsTowardLimit: true }).ok,
      freeCellNear: (at, from) => self.freeCellNear(at, from),
      relocate: (u, cell, how) => self.relocate(u, cell, how),
      canLand: cell => Grid.inBounds(cell) && self.grid.isFree(cell),
      basicGauge: u => self.gainMana(u, MANA_PER_ATTACK),
    };
  }

  /**
   * หักโล่ก่อนแล้วค่อยหักเลือด (ดาเมจพิษไม่เพิ่มมานา)
   * - SOUL LINK: `damageTransfer` of the carrier's final damage goes to the link source (no crit / on-hit / chain)
   * - boss phases: a hit never carries the boss past its next phase threshold (phases are never skipped)
   */
  private applyDamage(dst: BattleUnit, total: number, crit: boolean, poison = false, src?: BattleUnit, noTransfer = false): void {
    if (!dst.alive) return;
    // equipment Damage Reduction (heroes): every incoming hit / tick
    if (dst.mods?.damageReduction && total > 0) total = Math.max(1, Math.round(total * (1 - dst.mods.damageReduction)));
    if (!noTransfer) {
      const link = dst.buffs.find(b => b.def.damageTransfer);
      const protector = link ? this.units.find(x => x.id === link.sourceId && x.alive) : undefined;
      if (link && protector && protector !== dst) {
        const share = Math.round(total * link.def.damageTransfer!);
        if (share > 0) {
          total -= share;
          this.events.push({ type: 'soulLink', src: dst.id, dst: protector.id, amount: share });
          this.applyDamage(protector, share, false, false, src, true);
        }
        if (total <= 0) return;
      }
    }
    const blocked = Math.min(dst.shield, total);
    let amount = total - blocked;
    dst.shield -= blocked;
    const ms = dst.monster;
    const phases = ms ? this.monsterDefs[ms.definitionId]?.phases : undefined;
    if (phases && ms!.phaseIndex < phases.length) {
      const floor = Math.ceil(phases[ms!.phaseIndex].hpBelow * dst.maxHp);
      if (dst.hp > floor && dst.hp - amount < floor) amount = dst.hp - floor;
    }
    dst.hp -= amount;
    if (phases && dst.hp > 0) {
      while (ms!.phaseIndex < phases.length && dst.hp <= phases[ms!.phaseIndex].hpBelow * dst.maxHp + 1e-9) this.enterPhase(dst);
    }
    // receive-hit gauge: +2, at most once per RECEIVE_GAUGE_ICD s (multi-hits can't farm it); DoT gives none
    if (!poison && amount + blocked > 0 && this.time - dst.lastGaugeHitAt >= RECEIVE_GAUGE_ICD - 1e-9 && dst.maxMana > 0) {
      dst.lastGaugeHitAt = this.time;
      this.gainMana(dst, MANA_PER_HIT);
    }
    if (dst.side === PLAYER_TEAM) {
      this.flow.damageTaken += amount;
      this.metrics.damageTaken += amount;
    } else if (src?.side === PLAYER_TEAM) {
      this.metrics.damageDealt += amount;
      this.metrics.unit(src.id).dealt += amount;
    }
    // hit reaction: heroes always flinch visually; monsters go through their anti stun-lock rule
    const hurt = !poison && dst.hp > 0 && (dst.monster ? this.monsterAI.onHit(dst) : true);
    this.events.push({ type: 'damage', dst: dst.id, amount, crit, blocked, hurt, ...(poison ? { poison } : {}) });
    if (dst.hp <= 0) {
      // death: no targeting / moving / attacking / casting; channel + ult cancelled; out of the targeting pools
      dst.hp = 0;
      dst.alive = false;
      dst.targetable = false;
      this.cancelCast(dst, 'death');
      if (dst.monster) this.monsterAI.markDead(dst);
      if (dst.id === this.focusTargetId) this.clearFocus('dead');
      for (const o of this.units) if (o.targetId === dst.id) o.targetId = null;
      if (dst.side === PLAYER_TEAM) {
        this.metrics.deaths++;
        this.metrics.unit(dst.id).deaths++;
        if (isRanged(dst) && this.positioning.threatCount(dst.pos, this.positioning.threats(dst)) > 0) this.metrics.rangedDeathsInThreat++;
      }
      this.grid.remove(dst.id, dst.pos);
      if (dst.boss && dst.side !== PLAYER_TEAM && this.metrics.bossDiedAt == null) this.metrics.bossDiedAt = this.time;
      this.events.push({ type: 'death', dst: dst.id });
      this.flow.onDeath(dst);
      if (dst.summonedBy != null) this.onSummonDied(dst);
      // links end with their protector; a fallen boss takes its summons with it
      for (const o of this.units) {
        const links = o.buffs.filter(b => b.def.damageTransfer && b.sourceId === dst.id);
        for (const b of links) this.removeStatus(o, b.def.id);
      }
      if (dst.boss) for (const o of this.units.filter(x => x.alive && x.summonedBy === dst.id)) this.applyDamage(o, o.hp, false, true);
    }
  }

  private heal(dst: BattleUnit, amount: number, src?: BattleUnit): void {
    if (!dst.alive) return;
    // Forest Oblivion: healing received −50% · equipment Healing Received
    amount *= modifier(dst, 'healingReceivedMultiplier') * (dst.mods?.healingReceived ?? 1);
    const a = Math.round(Math.min(amount, dst.maxHp - dst.hp));
    if (a <= 0) return;
    dst.hp += a;
    if (dst.side === PLAYER_TEAM) {
      this.metrics.healing += a;
      if (src?.side === PLAYER_TEAM) this.metrics.unit(src.id).healed += a;
    }
    this.events.push({ type: 'heal', dst: dst.id, amount: a, ...(src ? { src: src.id } : {}) });
  }

  // ---------------------------------------------------------------- projectiles (colliding)

  private fireProjectile(u: BattleUnit, t: BattleUnit, attack: AttackDefinition): void {
    const def = PROJECTILES[attack.projectileId ?? ''];
    if (!def) return;
    const dx = t.pos.c - u.pos.c;
    const dy = t.pos.r - u.pos.r;
    const len = Math.hypot(dx, dy) || 1;
    const p: RuntimeProjectile = {
      id: this.seq++,
      defId: def.id,
      attackerId: u.id,
      side: u.side,
      targetId: t.id,
      x: u.pos.c,
      y: u.pos.r,
      vx: (dx / len) * def.speed,
      vy: (dy / len) * def.speed,
      age: 0,
      damage: effectiveAttack(u) * attack.damageMultiplier * def.damageMultiplier,
      sourceId: attack.id,
    };
    this.projectiles.push(p);
    this.events.push({ type: 'projectile', src: u.id, dst: t.id, kind: 'attack', flight: len / def.speed, pid: p.id });
  }

  /** Move projectiles; a hit damages exactly one unit and destroys the projectile */
  private updateProjectiles(dt: number): void {
    if (!this.projectiles.length) return;
    for (const p of [...this.projectiles]) {
      const def = PROJECTILES[p.defId];
      const x0 = p.x, y0 = p.y;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.age += dt;
      const candidates = this.units.filter(
        v => v.alive && v.targetable && !hasFlag(v, 'untargetable') && v.side !== p.side && (def.hits === 'ANY_ENEMY' || v.id === p.targetId),
      );
      // swept test: closest point of this tick's segment to the unit centre
      const hit = candidates
        .map(v => ({ v, d: segDist(x0, y0, p.x, p.y, v.pos.c, v.pos.r) }))
        .filter(h => h.d <= def.collisionRadius + h.v.collisionRadius)
        .sort((a, b) => a.d - b.d)[0]?.v;
      if (hit) {
        this.projectiles.splice(this.projectiles.indexOf(p), 1);
        if (this.dodged(this.units.find(v => v.id === p.attackerId)!, hit)) continue;
        const res = DamageResolver.resolve({
          attacker: this.units.find(v => v.id === p.attackerId)!, target: hit,
          baseDamage: p.damage, damageType: def.damageType, sourceId: p.sourceId,
        });
        this.events.push({ type: 'projectileHit', pid: p.id, dst: hit.id });
        this.applyDamage(hit, res.amount, false);
        continue;
      }
      if (p.age >= def.maxLifetime || p.x < -1 || p.x > BOARD_COLS || p.y < -1 || p.y > LANES) {
        this.projectiles.splice(this.projectiles.indexOf(p), 1);
        this.events.push({ type: 'projectileExpire', pid: p.id });
      }
    }
  }

  // ---------------------------------------------------------------- monster combat context

  /**
   * Target Resolver validity: ALIVE + targetable + hostile + visible on the battlefield + part of the current wave,
   * and only while COMBAT runs. DEAD_VISIBLE / DEAD_HIDDEN / REVIVING are never valid.
   */
  isValidTarget(u: BattleUnit, t: BattleUnit): boolean {
    return (
      t.life === 'ALIVE' && t.alive && t.targetable && t.visible && t.side !== u.side && !hasFlag(t, 'untargetable') &&
      this.flow.phase === BattlePhase.COMBAT && Grid.inBounds(t.pos) &&
      (t.wave < 0 || t.wave === this.flow.waveIndex)
    );
  }

  private combatContext(): CombatContext {
    const self = this;
    return {
      get time() {
        return self.time;
      },
      unit: id => self.units.find(x => x.id === id),
      opponentsOf: u => self.units.filter(t => self.isValidTarget(u, t)),
      alliesOf: u => self.units.filter(a => a.alive && a.side === u.side && (a.wave < 0 || a.wave === self.flow.waveIndex)),
      isValidTarget: (u, t) => self.isValidTarget(u, t),
      stepToward: (u, target, goal) => {
        const step = nextStep(self.grid, u.pos, goal) ?? greedyStep(self.grid, u.pos, target);
        if (!step) return false;
        self.grid.move(u.id, u.pos, step);
        u.pos = step;
        self.events.push({ type: 'move', src: u.id });
        return true;
      },
      stepAway: (u, threat, keep, range) => {
        const back = u.side === 'ally' ? -1 : 1;
        const step = Grid.neighbors(u.pos)
          .filter(c => self.grid.canEnter(c) && Math.sign(c.c - u.pos.c) === back && distance(c, threat) > distance(u.pos, threat) && distance(c, keep) <= range)
          .sort((a, b) => Math.abs(a.r - u.pos.r) - Math.abs(b.r - u.pos.r))[0];
        if (!step) return false;
        self.grid.move(u.id, u.pos, step);
        u.pos = step;
        self.events.push({ type: 'move', src: u.id });
        return true;
      },
      later: (delay, u, fn) => self.later(delay, u, fn),
      meleeHit: (u, t, a) => {
        if (self.dodged(u, t)) return;
        const res = DamageResolver.resolve({ attacker: u, target: t, multiplier: a.damageMultiplier, damageType: a.damageType, sourceId: a.id });
        self.applyDamage(t, res.amount, false, false, u);
        // every Nth successful hit on the same target applies a status (Corrupted Wolf: BLEED on the 3rd bite)
        const n = a.onHitEveryN;
        const st = u.monster;
        if (!n || !st || !t.alive) return;
        if (st.hitStreak.targetId !== t.id) st.hitStreak = { targetId: t.id, count: 0 };
        if (++st.hitStreak.count % n.n === 0) self.applyStatus(t, n.status, u);
      },
      fireProjectile: (u, t, a) => self.fireProjectile(u, t, a),
      startCast: (u, skill, target) => self.beginCast(u, skill, target),
      updateCast: (u, dt) => self.updateCast(u, dt),
      emit: e => self.events.push(e),
    };
  }
}

/** distance from point (px,py) to segment (x0,y0)-(x1,y1) */
function segDist(x0: number, y0: number, x1: number, y1: number, px: number, py: number): number {
  const dx = x1 - x0, dy = y1 - y0;
  const len2 = dx * dx + dy * dy;
  const t = len2 ? Math.max(0, Math.min(1, ((px - x0) * dx + (py - y0) * dy) / len2)) : 0;
  return Math.hypot(x0 + t * dx - px, y0 + t * dy - py);
}

/** event list that also notifies subscribers as events happen */
class EventQueue {
  private list: BattleEvent[] = [];
  constructor(private readonly notify: (e: BattleEvent) => void) {}
  push(...events: BattleEvent[]): number {
    for (const e of events) {
      this.list.push(e);
      this.notify(e);
    }
    return this.list.length;
  }
  drain(): BattleEvent[] {
    const out = this.list;
    this.list = [];
    return out;
  }
}
