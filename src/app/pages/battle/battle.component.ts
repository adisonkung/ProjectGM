import { Component, computed, inject, OnDestroy, signal } from '@angular/core';
import { ENEMIES } from '../../core/data/enemies';
import { STAGES } from '../../core/data/stages';
import { power } from '../../core/rules/stats';
import { TeamService } from '../../core/services/team.service';
import { AnimState, BoardComponent, FloatText, FxView, UnitView } from '../../battle/board/board.component';
import { fxDuration } from '../../battle/fx-sprite/fx-sprite.component';
import { FX, SHEETS } from '../../core/data/sprites';
import { BattleEngine, BattleEvent, BattleResult } from '../../battle/engine/battle-engine';

const TICK = 0.05;

/**
 * ห้องทดลองต่อสู้ (เฟส 1): เลือกชั้น แล้วดูทีมปัจจุบันสู้กับศัตรูบนกระดาน 8x7
 * ไม่มีผลกับเซฟ ใช้ทดสอบเอนจินและปรับสมดุล
 */
@Component({
  selector: 'app-battle',
  imports: [BoardComponent],
  templateUrl: './battle.component.html',
  styleUrl: './battle.component.scss',
})
export class BattleComponent implements OnDestroy {
  private readonly team = inject(TeamService);

  readonly stages = STAGES;
  readonly floor = signal(1);
  readonly speed = signal(1);
  readonly running = signal(false);
  readonly result = signal<BattleResult | null>(null);
  readonly time = signal(0);
  readonly views = signal<UnitView[]>([]);
  readonly floats = signal<FloatText[]>([]);
  readonly fx = signal<FxView[]>([]);
  readonly anims = signal<Record<number, AnimState>>({});
  readonly simReport = signal<string | null>(null);

  readonly stage = computed(() => STAGES[this.floor() - 1]);
  readonly teamPower = computed(() => this.team.units().reduce((a, u) => a + power(u.stats), 0));
  readonly timeLeft = computed(() => Math.max(0, Math.ceil(this.stage().timeLimit - this.time())));

  private engine!: BattleEngine;
  private timer?: ReturnType<typeof setInterval>;
  private floatId = 0;
  private animKey = 0;

  constructor() {
    this.prepare();
  }

  ngOnDestroy(): void {
    clearInterval(this.timer);
  }

  selectFloor(n: number): void {
    this.floor.set(n);
    this.prepare();
  }

  /** สร้างการต่อสู้ใหม่และแสดงตำแหน่งเริ่มต้น */
  prepare(): void {
    clearInterval(this.timer);
    this.running.set(false);
    this.result.set(null);
    this.simReport.set(null);
    this.floats.set([]);
    this.fx.set([]);
    this.anims.set({});
    this.engine = new BattleEngine({
      allies: this.team.units(),
      stage: this.stage(),
      enemyTemplates: ENEMIES,
    });
    this.time.set(0);
    this.snapshot();
  }

  start(): void {
    if (this.running()) return;
    if (this.result()) this.prepare();
    if (!this.engine.alive('ally').length) return;
    this.running.set(true);
    this.timer = setInterval(() => this.tick(), TICK * 1000);
  }

  setSpeed(v: number): void {
    this.speed.set(v);
  }

  /** จำลอง 100 รอบแบบไม่แสดงผล เพื่อดูอัตราชนะ */
  simulate(runs = 100): void {
    let wins = 0;
    let t = 0;
    for (let seed = 1; seed <= runs; seed++) {
      const e = new BattleEngine({ allies: this.team.units(), stage: this.stage(), enemyTemplates: ENEMIES, seed });
      if (e.run() === 'win') wins++;
      t += e.time;
    }
    this.simReport.set(`จำลอง ${runs} รอบ: ชนะ ${Math.round((wins / runs) * 100)}% · เฉลี่ย ${(t / runs).toFixed(1)} วินาที`);
  }

  private tick(): void {
    for (let i = 0; i < this.speed() && !this.engine.result; i++) this.engine.step(TICK);
    this.handleEvents(this.engine.drainEvents());
    this.time.set(this.engine.time);
    this.snapshot();
    if (this.engine.result) {
      clearInterval(this.timer);
      this.running.set(false);
      this.result.set(this.engine.result);
    }
  }

  private snapshot(): void {
    this.views.set(
      this.engine.units.map(u => ({
        id: u.id,
        side: u.side,
        name: u.name,
        cls: u.cls,
        r: u.pos.r,
        c: u.pos.c,
        hpPct: (u.hp / u.maxHp) * 100,
        manaPct: (u.mana / u.maxMana) * 100,
        shieldPct: (u.shield / u.maxHp) * 100,
        alive: u.alive,
        taunt: u.taunt > 0,
        star: u.star,
        level: u.level,
        sprite: u.sprite,
        boss: u.boss,
      })),
    );
  }

  private handleEvents(events: BattleEvent[]): void {
    if (!events.length) return;
    const anims = { ...this.anims() };
    const floats: FloatText[] = [];
    const fx: FxView[] = [];
    const unitOf = (id: number) => this.engine.units.find(u => u.id === id)!;
    const posOf = (id: number) => unitOf(id).pos;
    const set = (id: number, anim: AnimState['anim']) => (anims[id] = { anim, key: ++this.animKey });

    for (const e of events) {
      switch (e.type) {
        case 'attack':
          set(e.src, 'attack');
          break;
        case 'move':
          if (anims[e.src]?.anim !== 'die') set(e.src, 'walk');
          break;
        case 'cast': {
          set(e.src, e.kind);
          const p = posOf(e.src);
          floats.push({ id: ++this.floatId, r: p.r, c: p.c, text: e.skill, kind: 'skill' });
          const name = SHEETS[unitOf(e.src).sprite ?? '']?.fx?.[e.kind];
          if (name && FX[name]) {
            const q = FX[name].at === 'target' && e.dst != null ? posOf(e.dst) : p;
            const angle = q === p ? 0 : (Math.atan2(q.r - p.r, q.c - p.c) * 180) / Math.PI;
            fx.push({ id: ++this.floatId, r: q.r, c: q.c, name, angle });
          }
          break;
        }
        case 'damage': {
          if (anims[e.dst]?.anim !== 'die') set(e.dst, 'hurt');
          const p = posOf(e.dst);
          const text = e.amount > 0 ? `-${e.amount}` : 'บล็อก';
          floats.push({ id: ++this.floatId, r: p.r, c: p.c, text, kind: e.crit ? 'crit' : 'dmg' });
          break;
        }
        case 'heal': {
          const p = posOf(e.dst);
          floats.push({ id: ++this.floatId, r: p.r, c: p.c, text: `+${e.amount}`, kind: 'heal' });
          break;
        }
        case 'death':
          set(e.dst, 'die');
          break;
      }
    }
    this.anims.set(anims);
    for (const f of fx) {
      this.fx.update(list => [...list, f]);
      setTimeout(() => this.fx.update(list => list.filter(x => x.id !== f.id)), fxDuration(f.name, this.speed()) + 50);
    }
    if (floats.length) {
      this.floats.update(f => [...f, ...floats].slice(-40));
      const ids = new Set(floats.map(f => f.id));
      setTimeout(() => this.floats.update(f => f.filter(x => !ids.has(x.id))), 900);
    }
  }
}
