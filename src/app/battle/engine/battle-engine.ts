import { kitName, kitVariant } from '../../core/data/hero-kits';
import { canInterrupt, MANA_PER_ATTACK, MANA_PER_HIT, SKILL2_NAME, SKILL_CD, SKILL_NAME, START_CD, ULT_NAME } from '../../core/data/classes';
import { ENEMY_SKILL_START_CD, ENEMY_SKILLS, EnemySkillDef } from '../../core/data/enemy-skills';
import { animTiming, SkillKind } from '../../core/data/sprites';
import { HeroClass } from '../../core/models/hero';
import { EnemyTemplate, StageDef } from '../../core/models/stage';
import { Cell, Side, UnitSpec } from '../../core/models/unit';
import { enemyStats } from '../../core/rules/stats';
import { distance, Grid, LANES, Line, lineOf, SIDE_DEPTH, STACK_CAP, toBoard } from './grid';
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
  | { type: 'damage'; dst: number; amount: number; crit: boolean; blocked: number; poison?: boolean }
  | { type: 'heal'; dst: number; amount: number; src?: number }
  /** ลูกธนู/ลูกแสงที่บินไปหาเป้า (sky = ตกจากฟ้า) ดาเมจเข้าเมื่อถึง */
  | { type: 'projectile'; src: number; dst: number; kind: 'attack' | SkillKind; flight: number; sky?: boolean }
  /** ฟื้นคืนชีพ */
  | { type: 'revive'; src: number; dst: number; amount: number }
  /** ได้โล่ (src = ผู้ให้) */
  | { type: 'shield'; src: number; dst: number; amount: number }
  | { type: 'death'; dst: number }
  | { type: 'spawn'; dst: number }
  /** เคลียร์เวฟแล้ว ทีมเริ่มเดินไปจุดถัดไป (round = เวฟที่กำลังจะเริ่ม เริ่มนับ 0) */
  | { type: 'advance'; round: number; duration: number }
  /** ถึงจุดถัดไป ศัตรูเวฟใหม่บุกเข้ามา */
  | { type: 'round'; round: number }
  /** ศัตรูเริ่มร่ายสกิล (มีแถบร่าย) */
  | { type: 'castStart'; src: number; skill: string; label: string; castTime: number; interruptible: boolean; dst?: number }
  /** ร่ายสำเร็จ สกิลออกผล */
  | { type: 'castDone'; src: number; skill: string }
  /** ตัดการร่ายสำเร็จ (src = ผู้ตัด) */
  | { type: 'interrupt'; src: number; dst: number; skill: string }
  /** พยายามตัดแต่สกิลนี้ตัดไม่ได้ */
  | { type: 'immune'; src: number; dst: number; skill: string }
  /** เปลี่ยนเป้าโฟกัส (null = ยกเลิก; reason บอกว่ายกเลิกเพราะอะไร) */
  | { type: 'focus'; dst: number | null; reason?: 'player' | 'dead' | 'advance' | 'end' };

/** เหตุผลที่ฮีโร่เลือกเป้าตอนนี้ (แสดงใต้รูปในแถบตัวละคร) */
export type Intent = 'normal' | 'focus' | 'hold' | 'blocked' | 'heal' | 'interrupt' | 'taunted';

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
  pos: Cell;
  /** ตำแหน่งตั้งต้น (ทีมกลับมาจัดแถวตรงนี้ตอนเดินไปเวฟถัดไป) */
  home: Cell;
  /** แนวรบตามฟอร์เมชัน (แถวหน้า/หลัง) ใช้เลือกเป้า */
  line: Line;
  /** ศัตรู: มาจากเวฟไหน (เริ่มนับ 0) */
  round: number;
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
  /** เวลาที่ยังยั่วยุอยู่ (ลดดาเมจที่ได้รับ 50%) */
  taunt: number;
  /** คูลดาวน์ที่เหลือของสกิล 1 / สกิล 2 (วิ) */
  cd1: number;
  cd2: number;
  /** ผู้เล่นสั่งท่าไม้ตายแล้ว รอจังหวะร่าย */
  ultQueued: boolean;
  /** ศัตรู: สกิลร่ายที่มี + คูลดาวน์ที่เหลือ */
  castSkills: { def: EnemySkillDef; cd: number }[];
  /** ล็อกเป้าถึงเวลานี้ (กันเปลี่ยนเป้าทุกเฟรม) และรอบคิดของ AI (ทุก THINK วิ) */
  lockUntil: number;
  thinkCd: number;
  /** เหตุผลของการเลือกเป้าล่าสุด */
  intent: Intent;
  /** กำลังร่าย (state = CASTING): ยืนนิ่ง ทำอย่างอื่นไม่ได้ */
  casting: { def: EnemySkillDef; left: number; target: number | null } | null;
  /** คลั่ง: เวลาที่เหลือ และตัวคูณ atk/ความเร็วตี */
  rage: number;
  rageMul: number;
  /** เตรียมไว้สำหรับบอสในอนาคต (Break Gauge) — ยังไม่ใช้ */
  interruptResistance: number;
  /** โล่ดูดซับดาเมจ และเวลาที่เหลือ */
  shield: number;
  shieldTime: number;
  /** พิษ: ดาเมจต่อวินาที เวลาที่เหลือ และตัวนับรอบติดดาเมจ */
  poison: number;
  poisonTime: number;
  poisonTick: number;
}

export interface BattleConfig {
  allies: UnitSpec[];
  stage: StageDef;
  enemyTemplates: Record<string, EnemyTemplate>;
  seed?: number;
  /** ฝั่งเราร่ายท่าไม้ตายเองเมื่อเกจเต็ม (จำลอง/โหมดออโต้) · ศัตรูร่ายเองเสมอ */
  autoUlt?: boolean;
}

const CAST_LOCK = 0.4;
const TAUNT_TIME = 3;
const TAUNT_RADIUS = 3;
const CRIT_CHANCE = 0.1;
const CRIT_MUL = 1.5;
/** แทงก์ สกิล 2 พุ่งชนโล่: ดาเมจ 160% ผลักถอย 1 ช่อง มึน 1 วิ */
const CHARGE_MUL = 1.6;
const CHARGE_STUN = 1;
/**
 * ท่าไม้ตายทุกสายใช้เกจมานาเต็ม (ผู้เล่นกดที่รูปตัวละคร / ศัตรูและโหมดออโต้ร่ายเอง) — ไม่จำกัดจำนวนครั้ง
 * แทงก์ ท่าไม้ตาย: ร่ายเมื่อมีศัตรูในระยะยั่วยุ
 * → โล่ตัวเอง 30% / เพื่อนทุกคนในทีม 15% ของเลือดสูงสุดแทงก์ อยู่ 6 วิ + ยั่วยุ
 */
const ULT_SELF_SHIELD = 0.3;
const ULT_ALLY_SHIELD = 0.15;
const ULT_LOCK = 0.6;
const SHIELD_TIME = 6;
/** นักฆ่า สกิล 1 จู่โจมเงา: วาร์ปไปหลังศัตรูที่เลือดเหลือน้อยที่สุด ฟัน 200% */
const BLINK_MUL = 2;
/** สกิลเฉพาะตัว (hero-kits): โทสะเลือด / เมฆพิษ · นักเวท สกิล 2 มือกระดูก */
const RAGE_HIT = 1.5;
const RAGE_TIME = 6;
const RAGE_MUL = 1.35;
const MIASMA_MUL = 1.1;
const BONE_MUL = 2;
const BONE_STUN = 1.2;
/** นักฆ่า สกิล 2 ควันพิษ: ฟัน 120% + พิษรอบเป้าหมาย 1 ช่อง 25% atk ต่อวินาที 4 วิ */
const SMOKE_MUL = 1.2;
const POISON_DPS = 0.25;
const POISON_TIME = 4;
const POISON_TICK = 0.5;
/** นักฆ่า ท่าไม้ตาย ประหารเงามายา: วาร์ปไปหาศัตรูที่เลือด % ต่ำสุดในระยะ 4 ช่อง ฟัน 350% คริแน่นอน */
const EXEC_REACH = 4;
const EXEC_MUL = 3.5;
/** นักสู้ สกิล 2 พุ่งทะลวง: 180% เป้าหมาย + 120% ศัตรูที่ยืนถัดไปข้างหลัง */
const PIERCE_MUL = 1.8;
const PIERCE_BEHIND_MUL = 1.2;
/** นักสู้ ท่าไม้ตาย: 300% เป้าหมาย + 150% ศัตรูรอบเป้า 1 ช่อง */
const BLADE_ULT_MUL = 3;
const BLADE_ULT_SPLASH = 1.5;
/** นักสู้ สกิล 1 ดาบหมุนวน: 180% เป้าหมาย + 100% ศัตรูรอบตัว 1 ช่อง */
const SPIN_MUL = 1.8;
const SPIN_SPLASH = 1;
/** ลูกธนู/ลูกแสง: เวลาบิน = ค่าตั้งต้น + ต่อช่อง, ตกจากฟ้าใช้เวลาคงที่ */
const PROJ_BASE = 0.1;
const PROJ_PER_CELL = 0.06;
const PROJ_SKY = 0.35;
/** นักธนู สกิล 1 ยิงรัว: 4 ดอกห่างกัน 0.1 วิ ดอกละ 80% · สกิล 2 ห่าธนู: 130% เป้า + ศัตรูรอบเป้า 1 ช่อง */
const RAPID_SHOTS = 4;
const RAPID_GAP = 0.1;
const RAPID_MUL = 0.8;
const VOLLEY_MUL = 1.3;
/** นักธนู ท่าไม้ตาย ฝนธนูสวรรค์: ศัตรูทุกตัว 150% */
const RAIN_MUL = 1.5;
/** ฮีลเลอร์ สกิล 2 พรศักดิ์สิทธิ์: ฮีลเพื่อนที่เลือด % ต่ำสุด atk×2.2 + 10% เลือดสูงสุด */
const BLESS_ATK = 2.2;
const BLESS_PCT = 0.1;
/** ฮีลเลอร์ ท่าไม้ตาย คืนชีพศักดิ์สิทธิ์: เพื่อนที่ล้มฟื้นด้วยเลือด 50% */
const REVIVE_HP = 0.5;
/** เวลาเดินไปเวฟถัดไป (วินาที) — ระหว่างนี้ไม่มีใครต่อสู้ และไม่นับเวลาจำกัด */
export const ADVANCE_TIME = 2.4;
/** STEP 9: AI คิดเลือกเป้าทุก 0.25 วิ · เปลี่ยนเป้าแล้วล็อกอย่างน้อย 0.6 วิ (ยกเว้นเป้าตาย/โฟกัสเปลี่ยน) */
const THINK = 0.25;
const TARGET_LOCK = 0.6;
/** ฮีลฉุกเฉิน: เพื่อนเลือดต่ำกว่านี้ ฮีลเลอร์ทิ้งทุกอย่าง (รวมโฟกัส) มาฮีลก่อน */
const EMERGENCY_HP = 0.35;
/** สกิลวงกว้างรอให้โดน ≥ 2 ตัว — แต่ถ้ารอเกินกี่วิแล้วก็ใช้ไปเลย */
const AOE_OVERDUE = 4;
/** สายระยะไกลยอมขยับเข้าหาเป้าโฟกัสได้ไม่เกินกี่ช่อง */
const FOCUS_STEP_IN = 2;
/** นักเวท ท่าไม้ตาย: 250% เป้า + 150% รอบเป้า 1 ช่อง · ฮีลเลอร์ ท่าไม้ตาย: ฮีลทั้งทีม (+ชุบเพื่อนที่ล้ม 1 คน) */
const METEOR_MUL = 2.5;
const METEOR_SPLASH = 1.5;
const ULT_HEAL_ATK = 1.5;
const ULT_HEAL_PCT = 0.15;

/**
 * เอนจินต่อสู้อัตโนมัติบนสนาม 3 เลน x 12 (TypeScript ล้วน ไม่ผูกกับ Angular)
 * ด่านกำจัดมีหลายเวฟได้ (stage.rounds): เคลียร์แล้วทีมเดินไปจุดถัดไป ADVANCE_TIME วินาที แล้วศัตรูเวฟใหม่เกิด
 * เรียก step(dt) ซ้ำ ๆ จนกว่า result จะไม่เป็น null
 */
export class BattleEngine {
  readonly units: BattleUnit[] = [];
  readonly grid = new Grid(STACK_CAP);
  /** เวลารวม (รวมช่วงเดินไปเวฟถัดไป) */
  time = 0;
  /** เวลาที่ต่อสู้จริง (ใช้กับเวลาจำกัดของด่าน) */
  fightTime = 0;
  /** เวฟปัจจุบัน (เริ่มนับ 0) และจำนวนเวฟทั้งหมด */
  round = 0;
  readonly totalRounds: number;
  /** เวลาที่ยังเหลือของช่วงเดินไปเวฟถัดไป (> 0 = กำลังเดิน) */
  advancing = 0;
  result: BattleResult | null = null;

  private readonly rng: () => number;
  private readonly stage: StageDef;
  private readonly templates: Record<string, EnemyTemplate>;
  private events: BattleEvent[] = [];
  /** การกระทำที่รอให้ท่าถึงเฟรม hit/move ก่อน (เรียงตามเวลาที่ใส่) */
  private pending: { at: number; fn: () => void }[] = [];
  private nextId = 1;
  private nextWaveAt: number;
  private waveIndex = 0;
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
    this.nextWaveAt = cfg.stage.waveEvery ?? Infinity;
    this.enemyCap = cfg.stage.enemies.length;
    this.totalRounds = cfg.stage.mode === 'eliminate' ? 1 + (cfg.stage.rounds?.length ?? 0) : 1;

    for (const spec of cfg.allies) this.addUnit('ally', spec);
    for (const p of cfg.stage.enemies) this.spawnEnemy(p.enemy, p);
  }

  /** ดึงเหตุการณ์ที่เกิดขึ้นตั้งแต่ครั้งก่อน (ใช้ทำแอนิเมชัน) */
  drainEvents(): BattleEvent[] {
    const e = this.events;
    this.events = [];
    return e;
  }

  alive(side: Side): BattleUnit[] {
    return this.units.filter(u => u.alive && u.side === side);
  }

  /** ฮีโร่ของเราที่ล้มในการต่อสู้นี้ */
  fallenHeroUids(): number[] {
    return this.units.filter(u => u.side === 'ally' && !u.alive && u.heroUid != null).map(u => u.heroUid!);
  }

  step(dt: number): void {
    if (this.result) return;
    this.time += dt;

    // กำลังเดินไปเวฟถัดไป: ไม่มีการต่อสู้ แค่นับเวลาถอยหลัง
    if (this.advancing > 0) {
      this.advancing -= dt;
      if (this.advancing <= 0) this.startRound();
      return;
    }

    this.runPending();
    if (this.checkEnd()) return;
    this.fightTime += dt;

    for (const u of this.units) {
      if (!u.alive) continue;
      this.updateUnit(u, dt);
      if (this.checkEnd()) return;
    }

    if (this.stage.mode === 'survive' && this.fightTime >= this.nextWaveAt) {
      this.nextWaveAt += this.stage.waveEvery!;
      this.spawnWave();
    }
    this.checkEnd();
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
  private later(delay: number, u: BattleUnit, fn: () => void): void {
    const run = () => {
      if (u.alive) fn();
    };
    if (delay <= 0) run();
    else this.pending.push({ at: this.time + delay, fn: run });
  }

  /** เป้าเดิมถ้ายังอยู่ ไม่งั้นศัตรูที่ใกล้ที่สุดในระยะ (ท่าฟาดลงไปแล้วค่อยเปลี่ยนเป้า) */
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
      home: pos,
      round: this.round,
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
      taunt: 0,
      cd1: SKILL_CD[spec.cls][0] * START_CD,
      cd2: SKILL_CD[spec.cls][1] * START_CD,
      ultQueued: false,
      castSkills: [],
      lockUntil: 0,
      thinkCd: 0,
      intent: 'normal',
      casting: null,
      rage: 0,
      rageMul: 1,
      interruptResistance: 0,
      line: lineOf(spec.pos.r),
      shield: 0,
      shieldTime: 0,
      poison: 0,
      poisonTime: 0,
      poisonTick: 0,
    };
    this.grid.place(u.id, pos);
    this.units.push(u);
    return u;
  }

  private spawnEnemy(enemyId: string, local?: Cell): BattleUnit | null {
    const t = this.templates[enemyId];
    if (!t) throw new Error(`Unknown enemy: ${enemyId}`);
    const pos = local ?? { r: SIDE_DEPTH - 1, c: Math.floor(this.rng() * LANES) };
    const u = this.addUnit('enemy', {
      name: t.name,
      cls: t.cls,
      boss: t.boss,
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

  /** เคลียร์เวฟแล้ว: ทีมที่รอดกลับไปจัดแถวที่ตำแหน่งตั้งต้น แล้วเดินหน้า */
  private beginAdvance(): void {
    this.clearFocus('advance');
    this.round++;
    this.advancing = ADVANCE_TIME;
    // ดาเมจ/กระสุนที่ยังค้างอยู่ของเวฟที่แล้ว ทิ้งไป (ศัตรูตายหมดแล้ว)
    this.pending = [];
    for (const u of this.alive('ally')) {
      this.grid.move(u.id, u.pos, u.home);
      u.pos = u.home;
      u.targetId = null;
      u.castLock = 0;
    }
    this.events.push({ type: 'advance', round: this.round, duration: ADVANCE_TIME });
  }

  private startRound(): void {
    this.advancing = 0;
    for (const p of this.stage.rounds?.[this.round - 1] ?? []) {
      const u = this.spawnEnemy(p.enemy, p);
      if (u) this.events.push({ type: 'spawn', dst: u.id });
    }
    this.events.push({ type: 'round', round: this.round });
  }

  private spawnWave(): void {
    const pool = this.stage.waves ?? this.stage.enemies.map(e => e.enemy);
    let need = this.enemyCap - this.alive('enemy').length;
    while (need-- > 0) {
      const u = this.spawnEnemy(pool[this.waveIndex++ % pool.length]);
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

  private updateUnit(u: BattleUnit, dt: number): void {
    u.atkCd -= dt;
    u.moveCd -= dt;
    // คูลดาวน์ติดลบได้ = สกิลพร้อมมานานแค่ไหนแล้ว (ใช้ตัดสินว่ารอ AoE นานเกินไปหรือยัง)
    u.cd1 = Math.max(-10, u.cd1 - dt);
    u.cd2 = Math.max(-10, u.cd2 - dt);
    if (u.thinkCd > 0) u.thinkCd -= dt;
    for (const cs of u.castSkills) if (cs.cd > 0) cs.cd -= dt;
    if (u.rage > 0 && (u.rage -= dt) <= 0) u.rageMul = 1;
    if (u.taunt > 0) u.taunt -= dt;
    if (u.shieldTime > 0 && (u.shieldTime -= dt) <= 0) u.shield = 0;
    if (u.poisonTime > 0) {
      u.poisonTime -= dt;
      u.poisonTick += dt;
      if (u.poisonTick >= POISON_TICK || u.poisonTime <= 0) {
        this.applyDamage(u, Math.max(1, Math.round(u.poison * u.poisonTick)), false, true);
        u.poisonTick = 0;
        if (!u.alive) return;
      }
    }
    // กำลังร่าย (CASTING): ยืนนิ่งจนร่ายเสร็จ หรือถูกตัด
    if (u.casting) {
      u.casting.left -= dt;
      if (u.casting.left <= 0) this.finishCast(u);
      return;
    }
    if (u.castLock > 0) {
      u.castLock -= dt;
      return;
    }

    // ศัตรูที่มีสกิลร่าย: เริ่มร่ายเมื่อสกิลพร้อมและมีเป้า
    if (u.castSkills.length && this.tryStartCast(u)) return;

    // ท่าไม้ตาย: เกจมานาเต็ม + (ผู้เล่นกดสั่ง หรือออโต้ หรือเป็นศัตรู) → ร่ายทันทีถ้ามีเป้าที่ใช้ได้
    if (u.mana >= u.maxMana && (u.ultQueued || u.side === 'enemy' || (this.autoUlt && !this.holdUltForInterrupt(u))) && this.tryUltimate(u)) {
      u.ultQueued = false;
      return;
    }

    // โอกาสตัดการร่าย: มีสกิลที่ตัดได้พร้อม + ศัตรูกำลังร่ายสกิลที่ตัดได้ในระยะ → ใช้ทันที (ไม่สนเป้าเดิม)
    if (u.side === 'ally' && u.atkCd <= 0 && this.tryInterruptSkill(u)) return;

    // ฮีลเลอร์: ฮีลฉุกเฉิน (สำคัญกว่าโฟกัส) — เพื่อนเลือด < 35% ในระยะ → พรศักดิ์สิทธิ์ถ้าพร้อม ไม่งั้นฮีลธรรมดา
    if (u.cls === 'healer' && u.atkCd <= 0) {
      const dying = this.alive(u.side)
        .filter(a => a.hp / a.maxHp < EMERGENCY_HP && distance(a.pos, u.pos) <= u.range)
        .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
      if (dying) {
        u.intent = 'heal';
        const offensive2 = kitVariant(u.heroId, 'skill2') === 'miasma';
        if (offensive2 && u.cd1 <= 0) {
          this.cast(u, dying, 'skill');
          u.atkCd = Math.max(u.atkCd, 0) + 1 / u.atkSpeed;
          return;
        }
        if (!offensive2 && u.cd2 <= 0) {
          this.cast(u, dying, 'skill2');
          u.atkCd = Math.max(u.atkCd, 0) + 1 / u.atkSpeed;
          return;
        }
        if (u.cd1 > 0) {
          this.basicHeal(u, dying);
          return;
        }
      }
    }

    // ฮีลเลอร์: ถ้ามีเพื่อนเลือดน้อยในระยะ ให้ฮีลแทนการตี
    if (u.cls === 'healer' && u.atkCd <= 0 && u.cd1 > 0 && u.cd2 > 0) {
      const hurt = this.alive(u.side)
        .filter(a => a.hp / a.maxHp < 0.6 && distance(a.pos, u.pos) <= u.range)
        .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
      if (hurt) {
        u.intent = 'heal';
        this.basicHeal(u, hurt);
        return;
      }
    }

    const target = this.acquireTarget(u);
    if (!target) return;

    if (distance(u.pos, target.pos) <= u.range) {
      if (u.atkCd <= 0) {
        // สกิล 2 (สำคัญ) ก่อน แล้วสกิล 1 · ไม่พร้อมทั้งคู่ = ตีธรรมดา (สร้างเกจ)
        // สกิลวงกว้างรอจังหวะที่โดนหลายตัว (โฟกัสไม่ได้แปลว่าต้องทิ้งสกิลใส่เป้าเดี่ยว)
        if (u.cd2 <= 0 && this.worthCasting(u, 'skill2', target)) this.cast(u, target, 'skill2');
        else if (u.cd1 <= 0 && this.worthCasting(u, 'skill', target)) this.cast(u, target, 'skill');
        else this.basicAttack(u, target);
        u.atkCd = Math.max(u.atkCd, 0) + 1 / (u.atkSpeed * u.rageMul);
      } else if (u.range >= 3 && u.moveCd <= 0) {
        // สายระยะไกล: รักษาระยะ — ศัตรูประชิดตัวระหว่างรอตีครั้งถัดไป ให้ถอยหนี 1 ก้าว (ถ้าเป้ายังอยู่ในระยะ)
        this.kite(u, target);
      }
      return;
    }

    if (u.moveCd <= 0) {
      const step =
        nextStep(this.grid, u.pos, c => distance(c, target.pos) <= u.range) ??
        greedyStep(this.grid, u.pos, target.pos);
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
    const foes = this.alive(u.side === 'ally' ? 'enemy' : 'ally');
    if (!foes.length) return null;

    const taunter = foes
      .filter(f => f.taunt > 0 && distance(f.pos, u.pos) <= TAUNT_RADIUS)
      .sort((a, b) => distance(a.pos, u.pos) - distance(b.pos, u.pos))[0];
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
      return [...foes].sort((a, b) => diving(a) - diving(b) || Number(!!b.boss) - Number(!!a.boss) || d(a) - d(b) || a.id - b.id)[0];
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
    if (!t.alive || t.side === u.side || this.advancing > 0) return false;
    if (t.side === 'enemy' && t.round !== this.round) return false;
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
    if (t && t.alive && t.round === this.round) return t;
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

  // ---------------------------------------------------------------- smart skills

  /** มีสกิลตัดการร่ายพร้อม + ศัตรูร่ายสกิลที่ตัดได้อยู่ในระยะ → ใช้เลย (โฟกัสก่อนถ้ากำลังร่าย) */
  private tryInterruptSkill(u: BattleUnit): boolean {
    const kinds = (['skill2', 'skill'] as const).filter(k => canInterrupt(u.cls, k) && (k === 'skill2' ? u.cd2 : u.cd1) <= 0);
    if (!kinds.length) return false;
    const focus = this.focusUnit();
    const casters = this.alive('enemy')
      .filter(f => f.casting?.def.interruptible && distance(f.pos, u.pos) <= u.range)
      .sort((a, b) => Number(b === focus) - Number(a === focus) || a.casting!.left - b.casting!.left);
    const t = casters[0];
    if (!t) return false;
    u.targetId = t.id;
    u.intent = 'interrupt';
    u.lockUntil = this.time + TARGET_LOCK;
    this.cast(u, t, kinds[0]);
    u.atkCd = Math.max(u.atkCd, 0) + 1 / (u.atkSpeed * u.rageMul);
    return true;
  }

  /** สกิลวงกว้างรอให้โดน ≥ 2 ตัว (หรือเหลือศัตรูตัวเดียว / รอนานเกิน AOE_OVERDUE วิ) */
  private worthCasting(u: BattleUnit, kind: SkillKind, t: BattleUnit): boolean {
    const foes = this.alive(u.side === 'ally' ? 'enemy' : 'ally');
    const cd = kind === 'skill2' ? u.cd2 : u.cd1;
    if (foes.length <= 1 || cd <= -AOE_OVERDUE) return true;
    const around = (c: Cell) => foes.filter(f => distance(f.pos, c) <= 1).length;
    if (u.cls === 'fighter' && kind === 'skill') return around(u.pos) >= 2; // ดาบหมุนวนรอบตัว
    if (u.cls === 'archer' && kind === 'skill2') return around(t.pos) >= 2; // ห่าธนูตกเป็นวง
    if (u.cls === 'mage' && kind === 'skill') return around(t.pos) >= 2;
    return true;
  }

  /** โหมดออโต้: ฮีโร่ที่ท่าไม้ตายตัดได้ เก็บเกจไว้ถ้ามีศัตรูที่ร่ายสกิลอันตรายได้ (จนกว่าจะเริ่มร่าย) */
  private holdUltForInterrupt(u: BattleUnit): boolean {
    if (u.side !== 'ally' || !canInterrupt(u.cls, 'ult') || u.hp < u.maxHp * 0.3) return false;
    const foes = this.alive('enemy');
    const reach = (f: BattleUnit) => u.cls !== 'tank' || distance(f.pos, u.pos) <= TAUNT_RADIUS + 1;
    const castingNow = foes.some(f => f.casting?.def.interruptible && reach(f));
    if (castingNow) return false;
    return foes.some(f => f.castSkills.some(cs => cs.def.interruptible) && reach(f));
  }

  private basicHeal(u: BattleUnit, ally: BattleUnit): void {
    const tm = animTiming(u.sprite, 'attack');
    u.castLock = Math.max(u.castLock, tm.hit);
    u.atkCd = Math.max(u.atkCd, 0) + 1 / u.atkSpeed;
    this.events.push({ type: 'attack', src: u.id, dst: ally.id });
    this.later(tm.hit, u, () => {
      this.heal(ally, u.atk * 1.3, u);
      u.mana = Math.min(u.maxMana, u.mana + MANA_PER_ATTACK);
    });
  }

  /** สายระยะไกลถอยหนีศัตรูที่ประชิดตัว 1 ก้าว ไปทางฝั่งตัวเอง (ต้องยังยิงเป้าถึง) */
  private kite(u: BattleUnit, target: BattleUnit): void {
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
      if (cs.cd > 0) continue;
      let target: BattleUnit | null = null;
      if (cs.def.effect === 'meteor') {
        const inRange = foes.filter(f => distance(f.pos, u.pos) <= u.range);
        if (!inRange.length) continue;
        target = [...inRange].sort((a, b) => Number(a.line !== 'back') - Number(b.line !== 'back') || a.hp / a.maxHp - b.hp / b.maxHp)[0];
      } else if (cs.def.effect === 'berserk') {
        if (near > 2) continue;
      } else if (cs.def.effect === 'massHeal') {
        if (!this.alive(u.side).some(a => a.hp < a.maxHp * 0.75)) continue;
      } else if (near > Math.max(u.range, 3)) {
        continue; // แผ่นดินไหว/คลื่นมรณะ: ร่ายเมื่อเข้าปะทะแล้ว
      }
      cs.cd = cs.def.cooldown;
      u.casting = { def: cs.def, left: cs.def.castTime, target: target?.id ?? null };
      this.events.push({
        type: 'castStart', src: u.id, skill: cs.def.name, label: cs.def.label,
        castTime: cs.def.castTime, interruptible: cs.def.interruptible, ...(target ? { dst: target.id } : {}),
      });
      return true;
    }
    return false;
  }

  private finishCast(u: BattleUnit): void {
    const c = u.casting!;
    u.casting = null;
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
        u.rage = c.def.duration ?? 8;
        u.rageMul = 1 + c.def.power;
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
    dst.castLock = CAST_LOCK;
    const cs = dst.castSkills.find(x => x.def === c.def);
    if (cs) cs.cd = c.def.cooldown;
    this.events.push({ type: 'interrupt', src: src.id, dst: dst.id, skill: c.def.name });
  }

  /** ตีธรรมดา: เริ่มท่าทันที ดาเมจเข้าตรงเฟรม hit (ยืนนิ่งระหว่างเงื้อ) */
  private basicAttack(u: BattleUnit, t: BattleUnit): void {
    this.events.push({ type: 'attack', src: u.id, dst: t.id });
    const tm = animTiming(u.sprite, 'attack');
    u.castLock = Math.max(u.castLock, tm.hit);
    this.later(tm.hit, u, () => {
      const tt = this.liveTarget(u, t);
      if (!tt) return;
      u.mana = Math.min(u.maxMana, u.mana + MANA_PER_ATTACK);
      // สายระยะไกล: ปล่อยลูกธนู/ลูกแสงตรงเฟรม hit ดาเมจเข้าเมื่อถึงเป้า
      if (u.range > 1) this.shoot(u, tt, 1, 'attack');
      else this.damage(u, tt, 1);
    });
  }

  /** ยิงกระสุนไปหาเป้า: ดาเมจเข้าเมื่อบินถึง (ยังเข้าแม้ผู้ยิงล้มระหว่างทาง) */
  private shoot(u: BattleUnit, t: BattleUnit, mul: number, kind: 'attack' | SkillKind, sky = false, crit = false): void {
    const flight = sky ? PROJ_SKY : PROJ_BASE + PROJ_PER_CELL * distance(u.pos, t.pos);
    this.events.push({ type: 'projectile', src: u.id, dst: t.id, kind, flight, ...(sky ? { sky } : {}) });
    this.pending.push({ at: this.time + flight, fn: () => this.damage(u, t, mul, crit, kind) });
  }

  /** เริ่มท่าสกิล: ล็อกตัวจนท่าจบ (ไม่ให้ท่าตีธรรมดามาตัดกลางท่า) */
  private beginSkill(u: BattleUnit, kind: SkillKind): { total: number; hit: number; move: number } {
    const tm = animTiming(u.sprite, kind);
    u.castLock = Math.max(u.castLock, tm.total, CAST_LOCK);
    return tm;
  }

  private cast(u: BattleUnit, t: BattleUnit, kind: SkillKind): void {
    const [cd1, cd2] = SKILL_CD[u.cls];
    if (kind === 'skill2') u.cd2 = cd2;
    else u.cd1 = cd1;
    const skill = kitName(u.heroId, kind) ?? ((kind === 'skill2' && SKILL2_NAME[u.cls]) || SKILL_NAME[u.cls]);
    const foes = this.alive(u.side === 'ally' ? 'enemy' : 'ally');
    // นักฆ่า สกิล 1 เลือกเป้าใหม่: ศัตรูที่เลือดเหลือน้อยที่สุด (มักเป็นแถวหลัง) ที่มีช่องว่างข้าง ๆ
    const focus = u.side === 'ally' ? this.focusUnit() : null;
    if (u.cls === 'assassin' && kind === 'skill' && focus && this.freeCellNear(focus.pos, u.pos)) {
      t = focus; // โฟกัส: นักฆ่าวาร์ปข้ามแนวหน้าไปหาเป้าโฟกัส
    } else if (u.cls === 'assassin' && kind === 'skill') {
      const prey = foes
        .filter(f => this.freeCellNear(f.pos, u.pos))
        .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp || distance(b.pos, u.pos) - distance(a.pos, u.pos))[0];
      if (prey) t = prey;
    }
    this.events.push({ type: 'cast', src: u.id, skill, kind, dst: t.id });
    const tm = this.beginSkill(u, kind);
    if (u.cls === 'assassin' && kind === 'skill') this.later(tm.move, u, () => t.alive && this.blink(u, t));
    this.later(tm.hit, u, () => {
      const tt = this.liveTarget(u, t);
      this.events.push({ type: 'impact', src: u.id, dst: tt?.id, kind });
      this.resolveSkill(u, tt, kind);
    });
  }

  private ultName(u: BattleUnit): string {
    return kitName(u.heroId, 'ult') ?? ULT_NAME[u.cls]!;
  }

  /** ผลของสกิล ณ เฟรมที่โดน (t = null เมื่อเป้าหายไปหมดแล้ว) */
  private resolveSkill(u: BattleUnit, t: BattleUnit | null, kind: SkillKind): void {
    const foes = this.alive(u.side === 'ally' ? 'enemy' : 'ally');
    // สกิลเฉพาะตัวของฮีโร่ (ดู core/data/hero-kits.ts)
    switch (kitVariant(u.heroId, kind)) {
      case 'rage':
        if (t) this.damage(u, t, RAGE_HIT);
        u.rage = RAGE_TIME;
        u.rageMul = RAGE_MUL;
        return;
      case 'pierce': {
        if (!t) return;
        const behind = this.grid.occupant({ r: t.pos.r + Math.sign(t.pos.r - u.pos.r), c: t.pos.c + Math.sign(t.pos.c - u.pos.c) });
        const next = foes.find(f => f.id === behind && f !== t);
        this.damage(u, t, PIERCE_MUL);
        if (next) this.damage(u, next, PIERCE_BEHIND_MUL);
        return;
      }
      case 'miasma': {
        const tt = t && t.side !== u.side ? t : [...foes].sort((a, b) => distance(a.pos, u.pos) - distance(b.pos, u.pos))[0];
        if (!tt) return;
        const at = tt.pos;
        this.damage(u, tt, MIASMA_MUL);
        for (const f of foes.filter(f => f.alive && distance(f.pos, at) <= 1)) {
          f.poison = Math.max(f.poison, u.atk * POISON_DPS);
          f.poisonTime = POISON_TIME;
        }
        return;
      }
    }
    if (!t && u.cls !== 'healer') return;
    switch (u.cls) {
      case 'tank':
        if (kind === 'skill2') {
          this.shieldCharge(u, t!);
        } else {
          u.taunt = TAUNT_TIME;
          this.damage(u, t!, 1);
        }
        break;
      case 'fighter':
        if (kind === 'skill2') {
          const tt = t!;
          const behind = this.grid.occupant({ r: tt.pos.r + Math.sign(tt.pos.r - u.pos.r), c: tt.pos.c + Math.sign(tt.pos.c - u.pos.c) });
          const next = foes.find(f => f.id === behind && f !== tt);
          this.damage(u, tt, PIERCE_MUL);
          if (next) this.damage(u, next, PIERCE_BEHIND_MUL);
        } else {
          // ดาบหมุนวน: ฟันเป้าหมายแรง + โดนศัตรูรอบตัวทุกตัว
          const around = foes.filter(f => f !== t && distance(f.pos, u.pos) <= 1);
          this.damage(u, t!, SPIN_MUL);
          for (const f of around) this.damage(u, f, SPIN_SPLASH);
        }
        break;
      case 'assassin':
        if (kind === 'skill') {
          this.damage(u, t!, BLINK_MUL);
        } else {
          const at = t!.pos;
          this.damage(u, t!, SMOKE_MUL);
          for (const f of foes.filter(f => f.alive && distance(f.pos, at) <= 1)) {
            f.poison = Math.max(f.poison, u.atk * POISON_DPS);
            f.poisonTime = POISON_TIME;
          }
        }
        break;
      case 'archer': {
        const tt = t!;
        if (kind === 'skill') {
          // ยิงรัว: หลายดอกติดกัน ดอกแรกออกตรงเฟรม hit
          for (let i = 0; i < RAPID_SHOTS; i++) {
            this.later(i * RAPID_GAP, u, () => {
              const x = this.liveTarget(u, tt);
              if (x) this.shoot(u, x, RAPID_MUL, 'skill');
            });
          }
        } else {
          // ห่าธนู: ลูกธนูตกจากฟ้าใส่เป้าและศัตรูรอบ ๆ
          for (const f of foes.filter(f => distance(f.pos, tt.pos) <= 1)) this.shoot(u, f, VOLLEY_MUL, 'skill2', true);
        }
        break;
      }
      case 'mage':
        if (kind === 'skill2') {
          // มือกระดูก: มือโผล่จากพื้นจับเป้า 200% + มึน
          this.damage(u, t!, BONE_MUL);
          if (t!.alive) t!.castLock = Math.max(t!.castLock, BONE_STUN);
        } else {
          for (const f of foes.filter(f => distance(f.pos, t!.pos) <= 1)) this.damage(u, f, 1.6);
        }
        break;
      case 'healer':
        if (kind === 'skill2') {
          // พรศักดิ์สิทธิ์: ฮีลก้อนใหญ่ให้เพื่อนที่เลือด % ต่ำสุด
          const low = this.alive(u.side).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
          if (low) this.heal(low, u.atk * BLESS_ATK + low.maxHp * BLESS_PCT, u);
        } else {
          for (const a of this.alive(u.side).filter(a => distance(a.pos, u.pos) <= 3)) {
            this.heal(a, u.atk + a.maxHp * 0.08, u);
          }
        }
        break;
    }
  }

  /** ผู้เล่นกดใช้ท่าไม้ตาย (คืน false ถ้ายังใช้ไม่ได้) */
  requestUlt(id: number): boolean {
    const u = this.units.find(x => x.id === id);
    if (!u || !u.alive || u.side !== 'ally' || u.mana < u.maxMana || this.result) return false;
    u.ultQueued = true;
    return true;
  }

  /** ร่ายท่าไม้ตายตามสาย (คืน false ถ้ายังไม่มีเป้าที่เหมาะ จะรอจนมี) */
  private tryUltimate(u: BattleUnit): boolean {
    const foes = this.alive(u.side === 'ally' ? 'enemy' : 'ally');
    if (!foes.length) return false;
    const nearest = [...foes].sort((a, b) => distance(a.pos, u.pos) - distance(b.pos, u.pos))[0];
    let ok = true;
    switch (u.cls) {
      case 'tank':
        ok = distance(nearest.pos, u.pos) <= TAUNT_RADIUS;
        if (ok) this.ultimate(u);
        break;
      case 'assassin': {
        // ประหาร: ศัตรูที่เลือด % ต่ำสุดในระยะวาร์ป
        const prey = foes.filter(f => distance(f.pos, u.pos) <= EXEC_REACH).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
        ok = !!prey;
        if (prey) this.execute(u, prey);
        break;
      }
      case 'healer': {
        const fallen = this.units.find(a => a.side === u.side && !a.alive && a !== u && a.round === u.round);
        this.resurrect(u, fallen ?? null);
        break;
      }
      case 'fighter':
        ok = distance(nearest.pos, u.pos) <= Math.max(u.range, 2);
        if (ok) this.bladeUlt(u, nearest);
        break;
      case 'archer':
        this.arrowRain(u, nearest);
        break;
      case 'mage':
        ok = distance(nearest.pos, u.pos) <= u.range + 1;
        if (ok) this.meteor(u, nearest);
        break;
    }
    if (ok) u.mana = 0;
    return ok;
  }

  /** นักเวท ท่าไม้ตาย: อุกกาบาตใส่เป้าและรอบ ๆ */
  private meteor(u: BattleUnit, t: BattleUnit): void {
    this.events.push({ type: 'cast', src: u.id, skill: this.ultName(u), kind: 'ult', dst: t.id });
    const tm = this.beginSkill(u, 'ult');
    this.later(tm.hit, u, () => {
      // ลำแสง/ลูกไฟบินไปหาเป้า แล้วระเบิดเป็นวงเมื่อถึง
      const flight = PROJ_BASE + PROJ_PER_CELL * distance(u.pos, t.pos);
      if (t.alive) this.events.push({ type: 'projectile', src: u.id, dst: t.id, kind: 'ult', flight });
      const at = { ...t.pos };
      this.pending.push({
        at: this.time + flight,
        fn: () => {
          this.events.push({ type: 'impact', src: u.id, dst: t.alive ? t.id : undefined, kind: 'ult' });
          for (const f of this.alive(t.side).filter(f => distance(f.pos, at) <= 1)) this.damage(u, f, f === t ? METEOR_MUL : METEOR_SPLASH);
        },
      });
    });
  }

  /** แทงก์ สกิล 2: กระแทกโล่ใส่เป้าหมาย ผลักถอย 1 ช่อง (ถ้าว่าง) และทำให้มึน */
  private shieldCharge(u: BattleUnit, t: BattleUnit): void {
    this.damage(u, t, CHARGE_MUL, false, 'skill2');
    if (!t.alive) return;
    t.castLock = Math.max(t.castLock, CHARGE_STUN);
    const back = { r: t.pos.r + Math.sign(t.pos.r - u.pos.r), c: t.pos.c + Math.sign(t.pos.c - u.pos.c) };
    if (this.grid.canEnter(back)) {
      this.grid.move(t.id, t.pos, back);
      t.pos = back;
    }
  }

  /** แทงก์ ท่าไม้ตาย: กางโล่ให้ตัวเองและเพื่อนทุกคน แล้วยั่วยุ */
  private ultimate(u: BattleUnit): void {
    u.taunt = Math.max(u.taunt, TAUNT_TIME);
    this.events.push({ type: 'cast', src: u.id, skill: this.ultName(u), kind: 'ult' });
    const tm = animTiming(u.sprite, 'ult');
    u.castLock = Math.max(u.castLock, tm.total, ULT_LOCK);
    this.later(tm.hit, u, () => {
      this.events.push({ type: 'impact', src: u.id, kind: 'ult' });
      u.taunt = Math.max(u.taunt, TAUNT_TIME);
      // คลื่นยั่วยุ: ตัดการร่ายของศัตรูทุกตัวในระยะยั่วยุ (ไกลเกินก็ตัดไม่ถึง)
      if (canInterrupt(u.cls, 'ult')) {
        for (const f of this.alive(u.side === 'ally' ? 'enemy' : 'ally')) {
          if (f.casting && distance(f.pos, u.pos) <= TAUNT_RADIUS) this.tryInterrupt(u, f);
        }
      }
      for (const a of this.alive(u.side)) {
        const amount = Math.round(u.maxHp * (a === u ? ULT_SELF_SHIELD : ULT_ALLY_SHIELD));
        a.shield += amount;
        a.shieldTime = SHIELD_TIME;
        this.events.push({ type: 'shield', src: u.id, dst: a.id, amount });
      }
    });
  }

  /** ช่องว่างรอบ ๆ ตำแหน่ง ที่อยู่ไกลจาก `from` ที่สุด (= ด้านหลังเป้าหมาย) */
  private freeCellNear(at: Cell, from: Cell): Cell | null {
    const free = Grid.neighbors(at).filter(c => this.grid.isFree(c));
    free.sort((a, b) => distance(b, from) - distance(a, from) || Math.abs(a.r - at.r) - Math.abs(b.r - at.r));
    return free[0] ?? null;
  }

  /** วาร์ปไปยืนข้างเป้าหมาย (ฝั่งตรงข้ามกับที่ยืนอยู่) */
  private blink(u: BattleUnit, t: BattleUnit): void {
    const cell = this.freeCellNear(t.pos, u.pos);
    if (!cell) return;
    this.grid.move(u.id, u.pos, cell);
    u.pos = cell;
    u.targetId = t.id;
    this.events.push({ type: 'blink', src: u.id });
  }

  /** นักธนู ท่าไม้ตาย: ลูกธนูสวรรค์ตกใส่ศัตรูทุกตัว */
  private arrowRain(u: BattleUnit, t: BattleUnit): void {
    this.events.push({ type: 'cast', src: u.id, skill: this.ultName(u), kind: 'ult', dst: t.id });
    const tm = this.beginSkill(u, 'ult');
    this.later(tm.hit, u, () => {
      this.events.push({ type: 'impact', src: u.id, kind: 'ult' });
      const foes = this.alive(u.side === 'ally' ? 'enemy' : 'ally');
      foes.forEach((f, i) => this.later(i * 0.06, u, () => f.alive && this.shoot(u, f, RAIN_MUL, 'ult', true)));
    });
  }

  /** ฮีลเลอร์ ท่าไม้ตาย: ฮีลทั้งทีม และชุบชีวิตเพื่อนที่ล้ม 1 คน (ถ้ามี) */
  private resurrect(u: BattleUnit, d: BattleUnit | null): void {
    this.events.push({ type: 'cast', src: u.id, skill: this.ultName(u), kind: 'ult', dst: d?.id });
    const tm = this.beginSkill(u, 'ult');
    this.later(tm.hit, u, () => {
      if (this.result) return;
      for (const a of this.alive(u.side)) this.heal(a, u.atk * ULT_HEAL_ATK + a.maxHp * ULT_HEAL_PCT, u);
      if (!d || d.alive) {
        this.events.push({ type: 'impact', src: u.id, kind: 'ult' });
        return;
      }
      d.alive = true;
      d.hp = Math.round(d.maxHp * REVIVE_HP);
      d.castLock = 0.5;
      d.targetId = null;
      d.poisonTime = 0;
      this.grid.place(d.id, d.pos);
      this.events.push({ type: 'impact', src: u.id, dst: d.id, kind: 'ult' });
      this.events.push({ type: 'revive', src: u.id, dst: d.id, amount: d.hp });
    });
  }

  /** นักสู้ ท่าไม้ตาย: ฟาดดาบสายฟ้าลงที่เป้าหมาย กระเด็นโดนศัตรูรอบ ๆ */
  private bladeUlt(u: BattleUnit, t: BattleUnit): void {
    this.events.push({ type: 'cast', src: u.id, skill: this.ultName(u), kind: 'ult', dst: t.id });
    const tm = this.beginSkill(u, 'ult');
    this.later(tm.hit, u, () => {
      const tt = this.liveTarget(u, t);
      this.events.push({ type: 'impact', src: u.id, dst: tt?.id, kind: 'ult' });
      if (!tt) return;
      const splash = this.alive(tt.side).filter(f => f !== tt && distance(f.pos, tt.pos) <= 1);
      this.damage(u, tt, BLADE_ULT_MUL);
      for (const f of splash) this.damage(u, f, BLADE_ULT_SPLASH);
    });
  }

  /** นักฆ่า ท่าไม้ตาย: วาร์ปไปประหารศัตรูที่ใกล้ตาย */
  private execute(u: BattleUnit, t: BattleUnit): void {
    this.events.push({ type: 'cast', src: u.id, skill: this.ultName(u), kind: 'ult', dst: t.id });
    const tm = this.beginSkill(u, 'ult');
    u.atkCd = Math.max(u.atkCd, tm.total);
    this.later(tm.move, u, () => {
      if (t.alive && distance(u.pos, t.pos) > 1) this.blink(u, t);
    });
    this.later(tm.hit, u, () => {
      this.events.push({ type: 'impact', src: u.id, dst: t.alive ? t.id : undefined, kind: 'ult' });
      this.damage(u, t, EXEC_MUL, true);
    });
  }

  private damage(src: BattleUnit, dst: BattleUnit, mul: number, forceCrit = false, kind?: 'attack' | SkillKind): void {
    if (!dst.alive) return;
    // สกิลที่ตัดได้ (INTERRUPT) โดนตัวที่กำลังร่าย → ตัดก่อนคิดดาเมจ
    if (kind && dst.casting && canInterrupt(src.cls, kind)) this.tryInterrupt(src, dst);
    let raw = src.atk * src.rageMul * mul * (0.9 + this.rng() * 0.2);
    const crit = forceCrit || this.rng() < CRIT_CHANCE;
    if (crit) raw *= CRIT_MUL;
    if (dst.taunt > 0) raw *= 0.5;
    this.applyDamage(dst, Math.max(1, Math.round((raw * 100) / (100 + dst.def))), crit);
  }

  /** หักโล่ก่อนแล้วค่อยหักเลือด (ดาเมจพิษไม่เพิ่มมานา) */
  private applyDamage(dst: BattleUnit, total: number, crit: boolean, poison = false): void {
    if (!dst.alive) return;
    const blocked = Math.min(dst.shield, total);
    const amount = total - blocked;
    dst.shield -= blocked;
    dst.hp -= amount;
    if (!poison) dst.mana = Math.min(dst.maxMana, dst.mana + MANA_PER_HIT);
    this.events.push({ type: 'damage', dst: dst.id, amount, crit, blocked, ...(poison ? { poison } : {}) });
    if (dst.hp <= 0) {
      dst.hp = 0;
      dst.alive = false;
      dst.casting = null;
      if (dst.id === this.focusTargetId) this.clearFocus('dead');
      dst.shield = 0;
      dst.poisonTime = 0;
      this.grid.remove(dst.id, dst.pos);
      this.events.push({ type: 'death', dst: dst.id });
    }
  }

  private heal(dst: BattleUnit, amount: number, src?: BattleUnit): void {
    if (!dst.alive) return;
    const a = Math.round(Math.min(amount, dst.maxHp - dst.hp));
    if (a <= 0) return;
    dst.hp += a;
    this.events.push({ type: 'heal', dst: dst.id, amount: a, ...(src ? { src: src.id } : {}) });
  }

  private checkEnd(): boolean {
    if (this.result) return true;
    if (!this.alive('ally').length) this.result = 'lose';
    else if (this.stage.mode === 'eliminate' && !this.alive('enemy').length) {
      if (this.round + 1 < this.totalRounds) this.beginAdvance();
      else this.result = 'win';
    } else if (this.stage.mode === 'survive' && this.fightTime >= this.stage.timeLimit) this.result = 'win';
    else if (this.stage.mode === 'eliminate' && this.fightTime >= this.stage.timeLimit) this.result = 'timeout';
    if (this.result) this.clearFocus('end');
    return this.result !== null || this.advancing > 0;
  }
}
