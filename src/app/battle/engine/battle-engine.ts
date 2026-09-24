import { MANA_PER_ATTACK, MANA_PER_HIT, SKILL2_NAME, SKILL_NAME, ULT_NAME } from '../../core/data/classes';
import { animTiming, SkillKind } from '../../core/data/sprites';
import { HeroClass } from '../../core/models/hero';
import { EnemyTemplate, StageDef } from '../../core/models/stage';
import { Cell, Side, UnitSpec } from '../../core/models/unit';
import { enemyStats } from '../../core/rules/stats';
import { distance, Grid, LANES, SIDE_DEPTH, STACK_CAP, toBoard } from './grid';
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
  | { type: 'spawn'; dst: number };

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
  pos: Cell;
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
  /** จำนวนครั้งที่ร่ายสกิลแล้ว (ใช้สลับสกิล 1/2) */
  casts: number;
  /** ใช้ท่าไม้ตายไปแล้วหรือยัง (1 ครั้งต่อการต่อสู้) */
  ultUsed: boolean;
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
 * แทงก์ ท่าไม้ตาย: ใช้ทันทีครั้งแรกที่ศัตรูเข้ามาในระยะยั่วยุ (ครั้งเดียวต่อการต่อสู้)
 * → โล่ตัวเอง 30% / เพื่อนทุกคนในทีม 15% ของเลือดสูงสุดแทงก์ อยู่ 6 วิ + ยั่วยุ
 */
const ULT_SELF_SHIELD = 0.3;
const ULT_ALLY_SHIELD = 0.15;
const ULT_LOCK = 0.6;
const SHIELD_TIME = 6;
/** นักฆ่า สกิล 1 จู่โจมเงา: วาร์ปไปหลังศัตรูที่เลือดเหลือน้อยที่สุด ฟัน 200% */
const BLINK_MUL = 2;
/** นักฆ่า สกิล 2 ควันพิษ: ฟัน 120% + พิษรอบเป้าหมาย 1 ช่อง 25% atk ต่อวินาที 4 วิ */
const SMOKE_MUL = 1.2;
const POISON_DPS = 0.25;
const POISON_TIME = 4;
const POISON_TICK = 0.5;
/** นักฆ่า ท่าไม้ตาย ประหารเงามายา: ครั้งเดียว เมื่อมีศัตรูเลือด < 35% ในระยะ 4 ช่อง → วาร์ปไปฟัน 350% คริแน่นอน */
const EXEC_HP = 0.35;
const EXEC_REACH = 4;
const EXEC_MUL = 3.5;
/** นักสู้ สกิล 2 พุ่งทะลวง: 180% เป้าหมาย + 120% ศัตรูที่ยืนถัดไปข้างหลัง */
const PIERCE_MUL = 1.8;
const PIERCE_BEHIND_MUL = 1.2;
/** นักสู้ ท่าไม้ตาย ดาบเทพสายฟ้า: สกิลครั้งที่ 3 (ครั้งเดียว) 300% เป้าหมาย + 150% ศัตรูรอบเป้า 1 ช่อง */
const BLADE_ULT_CAST = 2;
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
/** นักธนู ท่าไม้ตาย ฝนธนูสวรรค์: สกิลครั้งที่ 3 (ครั้งเดียว) ศัตรูทุกตัว 150% */
const RAIN_CAST = 2;
const RAIN_MUL = 1.5;
/** ฮีลเลอร์ สกิล 2 พรศักดิ์สิทธิ์: ฮีลเพื่อนที่เลือด % ต่ำสุด atk×2.2 + 10% เลือดสูงสุด */
const BLESS_ATK = 2.2;
const BLESS_PCT = 0.1;
/** ฮีลเลอร์ ท่าไม้ตาย คืนชีพศักดิ์สิทธิ์: ครั้งเดียว เมื่อมีเพื่อนล้ม → ฟื้นด้วยเลือด 50% */
const REVIVE_HP = 0.5;

/**
 * เอนจินต่อสู้อัตโนมัติบนกระดาน 8x7 (TypeScript ล้วน ไม่ผูกกับ Angular)
 * เรียก step(dt) ซ้ำ ๆ จนกว่า result จะไม่เป็น null
 */
export class BattleEngine {
  readonly units: BattleUnit[] = [];
  readonly grid = new Grid(STACK_CAP);
  time = 0;
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

  constructor(cfg: BattleConfig) {
    this.rng = createRng(cfg.seed ?? Date.now());
    this.stage = cfg.stage;
    this.templates = cfg.enemyTemplates;
    this.nextWaveAt = cfg.stage.waveEvery ?? Infinity;
    this.enemyCap = cfg.stage.enemies.length;

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
    this.runPending();
    if (this.checkEnd()) return;

    for (const u of this.units) {
      if (!u.alive) continue;
      this.updateUnit(u, dt);
      if (this.checkEnd()) return;
    }

    if (this.stage.mode === 'survive' && this.time >= this.nextWaveAt) {
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
      pos,
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
      casts: 0,
      ultUsed: false,
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
    return this.addUnit('enemy', {
      name: t.name,
      cls: t.cls,
      boss: t.boss,
      stats: enemyStats(t, this.stage),
      pos,
    });
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
    if (u.castLock > 0) {
      u.castLock -= dt;
      return;
    }

    // แทงก์: ท่าไม้ตายทันทีเมื่อศัตรูเข้าระยะยั่วยุครั้งแรก (ไม่ต้องรอเลือดลด)
    if (u.cls === 'tank' && !u.ultUsed) {
      const near = this.alive(u.side === 'ally' ? 'enemy' : 'ally').some(f => distance(f.pos, u.pos) <= TAUNT_RADIUS);
      if (near) {
        this.ultimate(u);
        return;
      }
    }

    // นักฆ่า: ท่าไม้ตายทันทีเมื่อเห็นศัตรูใกล้ตาย
    if (u.cls === 'assassin' && !u.ultUsed) {
      const prey = this.alive(u.side === 'ally' ? 'enemy' : 'ally')
        .filter(f => f.hp < f.maxHp * EXEC_HP && distance(f.pos, u.pos) <= EXEC_REACH)
        .sort((a, b) => a.hp - b.hp)[0];
      if (prey) {
        this.execute(u, prey);
        return;
      }
    }

    // ฮีลเลอร์: ท่าไม้ตายคืนชีพเพื่อนที่ล้ม (ครั้งเดียว)
    if (u.cls === 'healer' && !u.ultUsed) {
      const fallen = this.units.find(a => a.side === u.side && !a.alive && a !== u);
      if (fallen) {
        this.resurrect(u, fallen);
        return;
      }
    }

    // ฮีลเลอร์: ถ้ามีเพื่อนเลือดน้อยในระยะ ให้ฮีลแทนการตี
    if (u.cls === 'healer' && u.atkCd <= 0 && u.mana < u.maxMana) {
      const hurt = this.alive(u.side)
        .filter(a => a.hp / a.maxHp < 0.6 && distance(a.pos, u.pos) <= u.range)
        .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
      if (hurt) {
        const tm = animTiming(u.sprite, 'attack');
        u.castLock = Math.max(u.castLock, tm.hit);
        u.atkCd = Math.max(u.atkCd, 0) + 1 / u.atkSpeed;
        this.events.push({ type: 'attack', src: u.id, dst: hurt.id });
        this.later(tm.hit, u, () => {
          this.heal(hurt, u.atk * 1.3, u);
          u.mana = Math.min(u.maxMana, u.mana + MANA_PER_ATTACK);
        });
        return;
      }
    }

    const target = this.acquireTarget(u);
    if (!target) return;

    if (distance(u.pos, target.pos) <= u.range) {
      if (u.atkCd <= 0) {
        if (u.mana >= u.maxMana) this.cast(u, target);
        else this.basicAttack(u, target);
        u.atkCd = Math.max(u.atkCd, 0) + 1 / u.atkSpeed;
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

  private acquireTarget(u: BattleUnit): BattleUnit | null {
    const foes = this.alive(u.side === 'ally' ? 'enemy' : 'ally');
    if (!foes.length) return null;

    // ถูกยั่วยุ: ต้องตีแทงก์ที่ยั่วยุอยู่ใกล้ ๆ
    const taunter = foes
      .filter(f => f.taunt > 0 && distance(f.pos, u.pos) <= TAUNT_RADIUS)
      .sort((a, b) => distance(a.pos, u.pos) - distance(b.pos, u.pos))[0];
    if (taunter) {
      u.targetId = taunter.id;
      return taunter;
    }

    const current = foes.find(f => f.id === u.targetId);
    const inRange = foes.filter(f => distance(f.pos, u.pos) <= u.range);
    if (current && (distance(current.pos, u.pos) <= u.range || !inRange.length)) return current;

    const pool = inRange.length ? inRange : foes;
    const best = pool.sort((a, b) => distance(a.pos, u.pos) - distance(b.pos, u.pos) || a.id - b.id)[0];
    u.targetId = best.id;
    return best;
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
    this.pending.push({ at: this.time + flight, fn: () => this.damage(u, t, mul, crit) });
  }

  /** เริ่มท่าสกิล: ล็อกตัวจนท่าจบ (ไม่ให้ท่าตีธรรมดามาตัดกลางท่า) */
  private beginSkill(u: BattleUnit, kind: SkillKind): { total: number; hit: number; move: number } {
    const tm = animTiming(u.sprite, kind);
    u.castLock = Math.max(u.castLock, tm.total, CAST_LOCK);
    return tm;
  }

  private cast(u: BattleUnit, t: BattleUnit): void {
    u.mana = 0;
    // สลับสกิล 1 / 2 ทุกครั้งที่ร่าย (สายที่ยังไม่มีสกิล 2 ใช้ผลเดิม แค่เปลี่ยนท่า)
    // นักสู้: สกิลครั้งที่ 3 กลายเป็นท่าไม้ตาย (ครั้งเดียวต่อการต่อสู้)
    if (u.cls === 'fighter' && !u.ultUsed && u.casts === BLADE_ULT_CAST) {
      u.casts++;
      this.bladeUlt(u, t);
      return;
    }
    // นักธนู: สกิลครั้งที่ 3 กลายเป็นท่าไม้ตาย ฝนธนูสวรรค์
    if (u.cls === 'archer' && !u.ultUsed && u.casts === RAIN_CAST) {
      u.casts++;
      this.arrowRain(u, t);
      return;
    }
    const kind: SkillKind = u.casts++ % 2 ? 'skill2' : 'skill';
    const skill = (kind === 'skill2' && SKILL2_NAME[u.cls]) || SKILL_NAME[u.cls];
    const foes = this.alive(u.side === 'ally' ? 'enemy' : 'ally');
    // นักฆ่า สกิล 1 เลือกเป้าใหม่: ศัตรูที่เลือดเหลือน้อยที่สุด (มักเป็นแถวหลัง) ที่มีช่องว่างข้าง ๆ
    if (u.cls === 'assassin' && kind === 'skill') {
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

  /** ผลของสกิล ณ เฟรมที่โดน (t = null เมื่อเป้าหายไปหมดแล้ว) */
  private resolveSkill(u: BattleUnit, t: BattleUnit | null, kind: SkillKind): void {
    const foes = this.alive(u.side === 'ally' ? 'enemy' : 'ally');
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
        for (const f of foes.filter(f => distance(f.pos, t!.pos) <= 1)) this.damage(u, f, 1.6);
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

  /** แทงก์ สกิล 2: กระแทกโล่ใส่เป้าหมาย ผลักถอย 1 ช่อง (ถ้าว่าง) และทำให้มึน */
  private shieldCharge(u: BattleUnit, t: BattleUnit): void {
    this.damage(u, t, CHARGE_MUL);
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
    u.ultUsed = true;
    u.taunt = Math.max(u.taunt, TAUNT_TIME);
    this.events.push({ type: 'cast', src: u.id, skill: ULT_NAME[u.cls]!, kind: 'ult' });
    const tm = animTiming(u.sprite, 'ult');
    u.castLock = Math.max(u.castLock, tm.total, ULT_LOCK);
    this.later(tm.hit, u, () => {
      this.events.push({ type: 'impact', src: u.id, kind: 'ult' });
      u.taunt = Math.max(u.taunt, TAUNT_TIME);
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
    u.ultUsed = true;
    this.events.push({ type: 'cast', src: u.id, skill: ULT_NAME[u.cls]!, kind: 'ult', dst: t.id });
    const tm = this.beginSkill(u, 'ult');
    this.later(tm.hit, u, () => {
      this.events.push({ type: 'impact', src: u.id, kind: 'ult' });
      const foes = this.alive(u.side === 'ally' ? 'enemy' : 'ally');
      foes.forEach((f, i) => this.later(i * 0.06, u, () => f.alive && this.shoot(u, f, RAIN_MUL, 'ult', true)));
    });
  }

  /** ฮีลเลอร์ ท่าไม้ตาย: ชุบชีวิตเพื่อนที่ล้ม */
  private resurrect(u: BattleUnit, d: BattleUnit): void {
    u.ultUsed = true;
    this.events.push({ type: 'cast', src: u.id, skill: ULT_NAME[u.cls]!, kind: 'ult', dst: d.id });
    const tm = this.beginSkill(u, 'ult');
    this.later(tm.hit, u, () => {
      if (d.alive || this.result) return;
      d.alive = true;
      d.hp = Math.round(d.maxHp * REVIVE_HP);
      d.mana = 0;
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
    u.ultUsed = true;
    this.events.push({ type: 'cast', src: u.id, skill: ULT_NAME[u.cls]!, kind: 'ult', dst: t.id });
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
    u.ultUsed = true;
    this.events.push({ type: 'cast', src: u.id, skill: ULT_NAME[u.cls]!, kind: 'ult', dst: t.id });
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

  private damage(src: BattleUnit, dst: BattleUnit, mul: number, forceCrit = false): void {
    if (!dst.alive) return;
    let raw = src.atk * mul * (0.9 + this.rng() * 0.2);
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
    else if (this.stage.mode === 'eliminate' && !this.alive('enemy').length) this.result = 'win';
    else if (this.stage.mode === 'survive' && this.time >= this.stage.timeLimit) this.result = 'win';
    else if (this.stage.mode === 'eliminate' && this.time >= this.stage.timeLimit) this.result = 'timeout';
    return this.result !== null;
  }
}
