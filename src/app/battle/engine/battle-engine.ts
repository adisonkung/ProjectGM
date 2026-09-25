import { MANA_PER_ATTACK, MANA_PER_HIT, RECEIVE_GAUGE_ICD, START_CD } from '../../core/data/classes';
import { kitInterrupts, kitOf } from '../../core/data/hero-skills';
import { ENEMY_SKILL_START_CD, ENEMY_SKILLS, EnemySkillDef } from '../../core/data/enemy-skills';
import { animTiming, SkillKind } from '../../core/data/sprites';
import { HeroClass } from '../../core/models/hero';
import { EnemyTemplate, StageDef } from '../../core/models/stage';
import { Cell, Side, UnitSpec } from '../../core/models/unit';
import { BUFFS, castTimeline, MONSTER_SKILLS, MONSTERS, PROJECTILES } from '../../core/data/monsters';
import { AttackDefinition, MonsterDefinition, MonsterSkillDefinition, SemanticEvent } from '../../core/models/monster';
import { enemyStats } from '../../core/rules/stats';
import { ActiveBuff, applyBuff, dodgeChance, hasFlag, modifier, tauntSource, tickStatuses } from './buffs';
import { SkillHost, SkillSystem } from './skill-system';
import type { DamageKind } from '../../core/models/combat';
import { FormationRuntime } from './stage/formation';
import {
  getActiveBattlefieldHeroes, getAliveHeroes, getAllPartyHeroes, getDeadHiddenHeroes, getDeadVisibleHeroes, PLAYER_TEAM,
} from './stage/party';
import { resolveRules, StageBattleRules } from './stage/rules';
import { StageFlow, StageHost } from './stage/stage-flow';
import { BattlePhase, CombatActivity, LifeState, ReviveHeroCommand, ReviveResult, StageEvent, StageResult } from './stage/types';
import { CRIT_CHANCE, DamageResolver, effectiveAttack } from './damage-resolver';
import { BOARD_COLS, distance, Grid, LANES, Line, lineOf, SIDE_DEPTH, STACK_CAP, toBoard } from './grid';
import { CombatContext, MonsterCombatState, MonsterController } from './monster-controller';
import { greedyStep, nextStep } from './pathfinding';
import { createRng } from './rng';

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
  | { type: 'castStart'; src: number; skill: string; label: string; castTime: number; interruptible: boolean; dst?: number }
  /** CAST_PROGRESS: every 25% of the cast */
  | { type: 'castProgress'; src: number; skill: string; pct: number }
  /** SKILL_ACTIVATED: the cast reached its activation point (effects applied now) */
  | { type: 'skillActivated'; src: number; skill: string; name: string; targets: number[] }
  /** ร่ายสำเร็จ สกิลออกผล (CAST_COMPLETED) */
  | { type: 'castDone'; src: number; skill: string }
  /** cast stopped without an interrupt (caster died / battle ended) — hide the cast bar */
  | { type: 'castCancel'; src: number; skill: string; reason: 'death' | 'end' }
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
  /** พยายามตัดแต่สกิลนี้ตัดไม่ได้ */
  | { type: 'immune'; src: number; dst: number; skill: string }
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
  casting: { def: CastSkillDef; left: number; target: number | null; token: number; nextProgress: number } | null;
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
/** สายระยะไกลยอมขยับเข้าหาเป้าโฟกัสได้ไม่เกินกี่ช่อง */
const FOCUS_STEP_IN = 2;

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
    return this.flow.revive(cmd);
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
    if (this.stage.mode === 'survive' && this.fightTime >= this.nextWaveAt) {
      this.nextWaveAt += this.stage.waveEvery!;
      this.spawnReinforcements();
    }
    this.glide(dt);
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

  private addUnit(side: Side, spec: UnitSpec): BattleUnit | null {
    let pos = toBoard(side, spec.pos);
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
      cd1: (kitOf(spec.heroId, spec.cls).skill.cooldown ?? 0) * START_CD,
      cd2: (kitOf(spec.heroId, spec.cls).skill2.cooldown ?? 0) * START_CD,
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
  private spawnMonster(def: MonsterDefinition, local?: Cell): BattleUnit | null {
    const pos = local ?? { r: SIDE_DEPTH - 1, c: Math.floor(this.rng() * LANES) };
    const k = this.stage.monsterScale ?? 1;
    const st = def.stats;
    const u = this.addUnit('enemy', {
      name: def.name,
      cls: def.displayClass,
      boss: def.rank === 'BOSS',
      sprite: def.animation.sheet,
      stats: {
        hp: Math.round(st.maxHp * k),
        atk: Math.round(st.attack * k),
        def: st.defense,
        atkSpeed: 1 / st.attackCooldown,
        moveSpeed: st.moveSpeed,
        range: st.attackRange,
        maxMana: 0,
      },
      pos,
    });
    if (!u) return null;
    u.elite = def.rank === 'ELITE';
    u.collisionRadius = st.collisionRadius;
    u.moveCd = 0;
    u.castSkills = def.skills
      .map(id => MONSTER_SKILLS[id])
      .filter(Boolean)
      .map(sk => ({ def: sk, cd: sk.firstCastDelay ?? sk.cooldown * ENEMY_SKILL_START_CD }));
    u.monster = MonsterController.createState(u.id, def);
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
      if (t.kind === 'DAMAGE') this.applyDamage(u, Math.max(1, Math.round(t.amount)), false, true);
      else this.heal(u, t.amount, this.units.find(x => x.id === t.buff.sourceId));
    }
    for (const b of st.expired) this.events.push({ type: 'buffEnd', dst: u.id, buff: b.def.id });
  }

  private updateUnit(u: BattleUnit, dt: number): void {
    this.tickTimers(u, dt, true, true);
    if (!u.alive) return;
    // data-driven monsters: shared state machine (targeting / movement / attack / cast from their definition)
    if (u.monster) {
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

    // ultimate: full gauge + (player tap / AUTO / enemy) → fires once a suitable target exists
    const wantsUlt = u.ultQueued || u.side !== PLAYER_TEAM || (this.autoUlt && !this.holdUltForInterrupt(u));
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
        if (pick.tier === 'INTERRUPT') u.intent = 'interrupt';
        else if (pick.tier === 'EMERGENCY' || pick.tier === 'HEAL') u.intent = 'heal';
        if (pick.tier === 'INTERRUPT' && pick.target.side !== u.side) u.lockUntil = this.time + TARGET_LOCK;
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
    if (!goal) return;
    if (!chase && distance(u.pos, goal.pos) <= u.range) {
      // ranged: keep distance while reloading — step back once when a foe is adjacent
      if (u.range >= 3 && u.moveCd <= 0) this.kite(u, goal);
      return;
    }

    // ROOT: cannot move (may still attack / cast when a target is in range)
    if (u.moveCd <= 0 && !hasFlag(u, 'root')) {
      const step =
        nextStep(this.grid, u.pos, c => distance(c, goal.pos) <= (chase ? this.skills.interruptReach(u) : u.range)) ??
        greedyStep(this.grid, u.pos, goal.pos);
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
    const foes = this.alive(u.side === 'ally' ? 'enemy' : 'ally').filter(f => f.targetable);
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
      return inRange.length
        ? [...inRange].sort((a, b) => (order[a.cls] ?? 2) - (order[b.cls] ?? 2) || a.hp / a.maxHp - b.hp / b.maxHp || d(a) - d(b))[0]
        : [...foes].sort((a, b) => d(a) - d(b) || a.id - b.id)[0];
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
   * - สายระยะไกล: อยู่ในระยะยิง หรือขยับเข้าไม่เกิน FOCUS_STEP_IN ช่อง
   * - นักฆ่า: วาร์ป/พุ่งข้ามแนวหน้าได้เสมอ
   * - สายประชิด: ใกล้ (≤ 2 ช่อง) หรือไม่มีศัตรูยืนขวางระหว่างทาง (คอลัมน์ระหว่างเรากับเป้า เลนติดกัน)
   */
  canEngage(u: BattleUnit, t: BattleUnit, foes = this.alive(t.side)): boolean {
    if (!this.isValidTarget(u, t)) return false;
    const d = distance(u.pos, t.pos);
    // สายระยะไกล: ยิงถึงอยู่แล้ว หรือขยับขึ้นไม่เกิน 2 ช่องก็ยิงถึง (ขยับเพื่อหาระยะยิง ไม่วิ่งลุยเข้าไป)
    if (u.range >= 3) return d <= u.range + FOCUS_STEP_IN;
    if (u.cls === 'assassin') return true;
    if (d <= 2) return true;
    const lo = Math.min(u.pos.c, t.pos.c);
    const hi = Math.max(u.pos.c, t.pos.c);
    return !foes.some(f => f !== t && f.pos.c > lo && f.pos.c < hi && Math.abs(f.pos.r - t.pos.r) <= 1);
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

  /** AUTO: a hero whose ultimate interrupts keeps the gauge while an enemy that can cast is around (until it starts) */
  private holdUltForInterrupt(u: BattleUnit): boolean {
    if (u.side !== PLAYER_TEAM || !kitInterrupts(this.skills.kit(u), 'ult') || u.hp < u.maxHp * 0.3) return false;
    const foes = this.alive(u.side === 'ally' ? 'enemy' : 'ally');
    const reach = (f: BattleUnit) => this.skills.kit(u).ult.range === Infinity || distance(f.pos, u.pos) <= 3;
    if (foes.some(f => f.casting?.def.interruptible && reach(f))) return false;
    return foes.some(f => f.castSkills.some(cs => cs.def.interruptible) && reach(f));
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
    if (cs) cs.cd = def.cooldown;
    const token = this.seq++;
    u.casting = { def, left: def.castTime, target: target?.id ?? null, token, nextProgress: CAST_PROGRESS_STEP };
    this.events.push({
      type: 'castStart', src: u.id, skill: def.name, label: def.label,
      castTime: def.castTime, interruptible: def.interruptible, ...(target ? { dst: target.id } : {}),
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
  private cancelCast(u: BattleUnit, reason: 'death' | 'end'): void {
    const c = u.casting;
    if (!c) return;
    u.casting = null;
    this.events.push({ type: 'castCancel', src: u.id, skill: c.def.id, reason });
    if (isMonsterSkill(c.def) && c.def.fx) this.events.push({ type: 'fxStop', src: u.id, name: c.def.fx.id });
    if (u.monster) this.monsterAI.onCastEnd(u, 'cancelled');
  }

  /** SKILL_ACTIVATE of a data-driven skill: apply its effects to the targets alive right now */
  private activateMonsterSkill(u: BattleUnit, def: MonsterSkillDefinition): void {
    const targets = this.monsterAI.skillTargets(u, def);
    for (const eff of def.effects) {
      if (eff.type === 'APPLY_BUFF') {
        const b = BUFFS[eff.buffId];
        if (!b) continue;
        for (const t of targets) {
          const r = applyBuff(t, b, u.id);
          this.events.push({ type: 'buff', src: u.id, dst: t.id, buff: b.id, name: b.name, refreshed: r === 'refreshed' });
        }
      }
    }
    const md = this.monsterDefs[u.monster?.definitionId ?? ''];
    const mark = md?.animation.clips[def.clip]?.events?.find(e => e.event === 'SKILL_ACTIVATE');
    this.events.push({ type: 'animEvent', src: u.id, event: 'SKILL_ACTIVATE', name: mark?.name ?? def.id });
    this.events.push({ type: 'skillActivated', src: u.id, skill: def.id, name: def.name, targets: targets.map(t => t.id) });
  }

  private finishCast(u: BattleUnit): void {
    const c = u.casting!;
    u.casting = null;
    if (isMonsterSkill(c.def)) {
      this.activateMonsterSkill(u, c.def);
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
  private tryInterrupt(src: BattleUnit, dst: BattleUnit): void {
    const c = dst.casting;
    if (!c || !dst.alive) return;
    if (!c.def.interruptible) {
      this.events.push({ type: 'immune', src: src.id, dst: dst.id, skill: c.def.name });
      return;
    }
    dst.casting = null;
    const cs = dst.castSkills.find(x => x.def === c.def);
    // the skill still goes on (full) cooldown — a successful interrupt is a big win
    if (cs) cs.cd = (isMonsterSkill(c.def) ? c.def.interruptedCooldown : undefined) ?? c.def.cooldown;
    this.events.push({ type: 'interrupt', src: src.id, dst: dst.id, skill: c.def.name });
    this.events.push({ type: 'CAST_INTERRUPTED', src: src.id, dst: dst.id, skill: c.def.id });
    if (isMonsterSkill(c.def) && c.def.fx) this.events.push({ type: 'fxStop', src: dst.id, name: c.def.fx.id });
    if (dst.monster) this.monsterAI.onCastEnd(dst, 'interrupted');
    else dst.castLock = CAST_LOCK;
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
  private hit(src: BattleUnit, dst: BattleUnit, mul: number, o: { crit?: boolean; damageType?: DamageKind; sourceId: string }): boolean {
    if (!dst.alive) return false;
    if (this.dodged(src, dst)) return false;
    const res = DamageResolver.resolve({
      attacker: src, target: dst, multiplier: mul, damageType: o.damageType ?? 'PHYSICAL',
      sourceId: o.sourceId, variance: this.rng(), crit: !!o.crit,
    });
    this.applyDamage(dst, res.amount, res.crit);
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

  private applyStatus(dst: BattleUnit, id: string, src: BattleUnit, duration?: number): void {
    if (!dst.alive) return;
    const def = SkillSystem.status(id);
    const r = applyBuff(dst, def, src.id, { magnitude: effectiveAttack(src), duration });
    this.events.push({ type: 'buff', src: src.id, dst: dst.id, buff: def.id, name: def.name, refreshed: r !== 'applied' });
    if (def.flags?.includes('taunted')) {
      dst.targetId = src.id;
      if (dst.monster) dst.monster.currentTargetId = src.id;
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
      castersNextWave: u => u.side === PLAYER_TEAM && self.flow.nextWaveHasCasters(self.monsterDefs, self.templates),
      later: (d, u, fn) => self.later(d, u, fn),
      shoot: (u, t, slot, sky, onArrive) => {
        const flight = sky ? PROJ_SKY : PROJ_BASE + PROJ_PER_CELL * distance(u.pos, t.pos);
        self.events.push({ type: 'projectile', src: u.id, dst: t.id, kind: slot, flight, ...(sky ? { sky } : {}) });
        self.pending.push({ at: self.time + flight, fn: onArrive });
      },
      hit: (src, dst, mul, o) => self.hit(src, dst, mul, o),
      heal: (dst, amount, src) => self.heal(dst, amount, src),
      applyStatus: (dst, id, src, duration) => self.applyStatus(dst, id, src, duration),
      interrupt: (src, dst) => self.tryInterrupt(src, dst),
      knockback: (src, dst, cells) => {
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

  /** หักโล่ก่อนแล้วค่อยหักเลือด (ดาเมจพิษไม่เพิ่มมานา) */
  private applyDamage(dst: BattleUnit, total: number, crit: boolean, poison = false): void {
    if (!dst.alive) return;
    const blocked = Math.min(dst.shield, total);
    const amount = total - blocked;
    dst.shield -= blocked;
    dst.hp -= amount;
    // receive-hit gauge: +2, at most once per RECEIVE_GAUGE_ICD s (multi-hits can't farm it); DoT gives none
    if (!poison && amount + blocked > 0 && this.time - dst.lastGaugeHitAt >= RECEIVE_GAUGE_ICD - 1e-9 && dst.maxMana > 0) {
      dst.lastGaugeHitAt = this.time;
      this.gainMana(dst, MANA_PER_HIT);
    }
    if (dst.side === PLAYER_TEAM) this.flow.damageTaken += amount;
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
      this.grid.remove(dst.id, dst.pos);
      this.events.push({ type: 'death', dst: dst.id });
      this.flow.onDeath(dst);
    }
  }

  private heal(dst: BattleUnit, amount: number, src?: BattleUnit): void {
    if (!dst.alive) return;
    const a = Math.round(Math.min(amount, dst.maxHp - dst.hp));
    if (a <= 0) return;
    dst.hp += a;
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
        v => v.alive && v.targetable && v.side !== p.side && (def.hits === 'ANY_ENEMY' || v.id === p.targetId),
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
      t.life === 'ALIVE' && t.alive && t.targetable && t.visible && t.side !== u.side &&
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
        self.applyDamage(t, res.amount, false);
      },
      fireProjectile: (u, t, a) => self.fireProjectile(u, t, a),
      startCast: (u, skill) => self.beginCast(u, skill),
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
