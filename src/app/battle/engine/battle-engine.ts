import { MANA_PER_ATTACK, MANA_PER_HIT, SKILL_NAME } from '../../core/data/classes';
import { HeroClass } from '../../core/models/hero';
import { EnemyTemplate, StageDef } from '../../core/models/stage';
import { Cell, Side, UnitSpec } from '../../core/models/unit';
import { enemyStats } from '../../core/rules/stats';
import { distance, Grid, SIDE_ROWS, toBoard } from './grid';
import { greedyStep, nextStep } from './pathfinding';
import { createRng } from './rng';

export type BattleResult = 'win' | 'lose' | 'timeout';

export type BattleEvent =
  | { type: 'attack'; src: number; dst: number }
  | { type: 'cast'; src: number; skill: string }
  | { type: 'damage'; dst: number; amount: number; crit: boolean }
  | { type: 'heal'; dst: number; amount: number }
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

/**
 * เอนจินต่อสู้อัตโนมัติบนกระดาน 8x7 (TypeScript ล้วน ไม่ผูกกับ Angular)
 * เรียก step(dt) ซ้ำ ๆ จนกว่า result จะไม่เป็น null
 */
export class BattleEngine {
  readonly units: BattleUnit[] = [];
  readonly grid = new Grid();
  time = 0;
  result: BattleResult | null = null;

  private readonly rng: () => number;
  private readonly stage: StageDef;
  private readonly templates: Record<string, EnemyTemplate>;
  private events: BattleEvent[] = [];
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
    };
    this.grid.place(u.id, pos);
    this.units.push(u);
    return u;
  }

  private spawnEnemy(enemyId: string, local?: Cell): BattleUnit | null {
    const t = this.templates[enemyId];
    if (!t) throw new Error(`Unknown enemy: ${enemyId}`);
    const pos = local ?? { r: SIDE_ROWS - 1, c: Math.floor(this.rng() * 7) };
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
    const rows = cls === 'tank' || cls === 'fighter' ? [0, 1, 2, 3] : [3, 2, 1, 0];
    const cols = [3, 2, 4, 1, 5, 0, 6];
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
    if (u.castLock > 0) {
      u.castLock -= dt;
      return;
    }

    // ฮีลเลอร์: ถ้ามีเพื่อนเลือดน้อยในระยะ ให้ฮีลแทนการตี
    if (u.cls === 'healer' && u.atkCd <= 0 && u.mana < u.maxMana) {
      const hurt = this.alive(u.side)
        .filter(a => a.hp / a.maxHp < 0.6 && distance(a.pos, u.pos) <= u.range)
        .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
      if (hurt) {
        this.heal(hurt, u.atk * 1.3);
        u.mana = Math.min(u.maxMana, u.mana + MANA_PER_ATTACK);
        u.atkCd = Math.max(u.atkCd, 0) + 1 / u.atkSpeed;
        this.events.push({ type: 'attack', src: u.id, dst: hurt.id });
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

  private basicAttack(u: BattleUnit, t: BattleUnit): void {
    this.events.push({ type: 'attack', src: u.id, dst: t.id });
    this.damage(u, t, 1);
    u.mana = Math.min(u.maxMana, u.mana + MANA_PER_ATTACK);
  }

  private cast(u: BattleUnit, t: BattleUnit): void {
    u.mana = 0;
    u.castLock = CAST_LOCK;
    this.events.push({ type: 'cast', src: u.id, skill: SKILL_NAME[u.cls] });
    const foes = this.alive(u.side === 'ally' ? 'enemy' : 'ally');
    switch (u.cls) {
      case 'tank':
        u.taunt = TAUNT_TIME;
        this.damage(u, t, 1);
        break;
      case 'fighter':
        this.damage(u, t, 2.5);
        break;
      case 'archer': {
        const picks = [...foes].sort(() => this.rng() - 0.5).slice(0, 3);
        for (const f of picks) this.damage(u, f, 1.2);
        break;
      }
      case 'mage':
        for (const f of foes.filter(f => distance(f.pos, t.pos) <= 1)) this.damage(u, f, 1.6);
        break;
      case 'healer':
        for (const a of this.alive(u.side).filter(a => distance(a.pos, u.pos) <= 3)) {
          this.heal(a, u.atk + a.maxHp * 0.08);
        }
        break;
    }
  }

  private damage(src: BattleUnit, dst: BattleUnit, mul: number): void {
    if (!dst.alive) return;
    let raw = src.atk * mul * (0.9 + this.rng() * 0.2);
    const crit = this.rng() < CRIT_CHANCE;
    if (crit) raw *= CRIT_MUL;
    if (dst.taunt > 0) raw *= 0.5;
    const amount = Math.max(1, Math.round((raw * 100) / (100 + dst.def)));
    dst.hp -= amount;
    dst.mana = Math.min(dst.maxMana, dst.mana + MANA_PER_HIT);
    this.events.push({ type: 'damage', dst: dst.id, amount, crit });
    if (dst.hp <= 0) {
      dst.hp = 0;
      dst.alive = false;
      this.grid.remove(dst.pos);
      this.events.push({ type: 'death', dst: dst.id });
    }
  }

  private heal(dst: BattleUnit, amount: number): void {
    if (!dst.alive) return;
    const a = Math.round(Math.min(amount, dst.maxHp - dst.hp));
    if (a <= 0) return;
    dst.hp += a;
    this.events.push({ type: 'heal', dst: dst.id, amount: a });
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
