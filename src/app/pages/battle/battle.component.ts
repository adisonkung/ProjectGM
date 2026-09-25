import { BACKGROUNDS } from '../../core/data/backgrounds';
import { Component, computed, effect, HostListener, inject, isDevMode, OnDestroy, signal, untracked } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ENEMIES } from '../../core/data/enemies';
import { STAGES } from '../../core/data/stages';
import { power } from '../../core/rules/stats';
import { TeamService } from '../../core/services/team.service';
import { AnimState, BoardComponent, FloatText, FxView, ProjectileView, UnitView } from '../../battle/board/board.component';
import { projectileLife } from '../../battle/projectile/projectile.component';
import { SCENERY_ROWS } from '../../battle/engine/grid';
import { PartyBarComponent } from '../../battle/party-bar/party-bar.component';
import { canInterrupt, SKILL_CD } from '../../core/data/classes';
import { PlacementComponent } from '../../battle/placement/placement.component';
import { fxDuration } from '../../battle/fx-sprite/fx-sprite.component';
import { CLASS_PROJECTILE, FX, SHEETS, SkillKind } from '../../core/data/sprites';
import { BattleEngine, BattleEvent, BattleResult, BattleUnit } from '../../battle/engine/battle-engine';
import { monsterSnapshot } from '../../battle/engine/monster-controller';
import { MONSTERS } from '../../core/data/monsters';

const TICK = 0.05;

/**
 * ห้องทดลองต่อสู้: เลือกชั้น จัดตำแหน่งบนกระดาน แล้วดูทีมปัจจุบันสู้กับศัตรูบนกระดาน 8x7
 * ผลการต่อสู้ไม่มีผลกับเซฟ (แต่การจัดตำแหน่งบันทึกลงทีม) ใช้ทดสอบเอนจินและปรับสมดุล
 */
@Component({
  selector: 'app-battle',
  imports: [BoardComponent, PlacementComponent, PartyBarComponent],
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
  readonly projectiles = signal<ProjectileView[]>([]);
  readonly anims = signal<Record<number, AnimState>>({});
  readonly simReport = signal<string | null>(null);
  /** เวฟปัจจุบัน (เริ่ม 0) / ทั้งหมด */
  readonly round = signal(0);
  readonly totalRounds = signal(1);
  /** ระยะที่ฉากเลื่อนไปแล้ว (1 = 1 จอ) และเวลาเลื่อน (ms, 0 = ไม่ได้เดินอยู่) */
  readonly scroll = signal(0);
  readonly marchMs = signal(0);
  /** ป้ายกลางจอ เช่น "เวฟ 2/3" */
  readonly banner = signal<string | null>(null);
  /** ฝั่งเราร่ายท่าไม้ตายเองเมื่อเกจเต็ม */
  readonly autoUlt = signal(false);
  /** combat debug overlay (dev builds only): ?debug=1 or key D */
  readonly debug = signal(false);
  /** running cast FX per unit (removed on fxStop) */
  private castFx = new Map<number, number>();
  /** ฮีโร่ของเรา เรียงตามทีม (ซ้าย→ขวาในแถบด้านล่าง) */
  readonly party = computed(() => this.views().filter(v => v.side === 'ally'));
  /** STEP 9: ศัตรูที่แตะเลือกไว้ และเป้าโฟกัสของทีม */
  readonly selectedId = signal<number | null>(null);
  readonly focusId = signal<number | null>(null);
  /** การ์ดข้อมูลศัตรู: เป้าโฟกัส หรือตัวที่เลือกอยู่ */
  readonly focusCard = computed(() => {
    const id = this.selectedId() ?? this.focusId();
    const v = this.views().find(x => x.id === id && x.alive && x.side === 'enemy');
    return v ? { ...v, isFocus: v.id === this.focusId() } : null;
  });
  /** ฮีโร่ที่ตีเป้าโฟกัสอยู่ / ทั้งหมด */
  readonly focusCount = computed(() => {
    const p = this.party().filter(v => v.alive);
    return { on: p.filter(v => v.onFocus).length, total: p.length };
  });
  /** ศัตรูที่กำลังร่ายสกิล (แสดงแถบเตือนเหนือสนาม) */
  readonly casts = computed(() => this.views().filter(v => v.alive && v.cast));
  /** มีสกิลร่ายที่ตัดได้อยู่ตอนนี้ → ไฮไลต์ฮีโร่ที่ท่าไม้ตายตัดได้ */
  readonly cuttable = computed(() => this.casts().some(v => v.cast!.interruptible));

  readonly stage = computed(() => STAGES[this.floor() - 1]);
  readonly background = computed(() => BACKGROUNDS[this.stage().background ?? ''] ?? null);
  /** ก่อนกดเริ่ม: แสดงกระดานจัดตำแหน่ง */
  readonly placing = computed(() => !this.running() && !this.result());
  readonly teamPower = computed(() => this.team.units().reduce((a, u) => a + power(u.stats), 0));
  readonly timeLeft = computed(() => Math.max(0, Math.ceil(this.stage().timeLimit - this.time())));

  private engine!: BattleEngine;
  private timer?: ReturnType<typeof setInterval>;
  private floatId = 0;
  /** ทิศที่แต่ละตัวหันอยู่ (true = ซ้าย) คงไว้เมื่อเป้าอยู่คอลัมน์เดียวกัน */
  private facing = new Map<number, boolean>();
  /** ตัวที่เพิ่งวาร์ป: ปิดการเลื่อนตัวบนจอชั่วครู่ (เวลาเอนจินที่หมดผล) */
  private blinkUntil = new Map<number, number>();
  private animKey = 0;
  private walkTick = 0;
  private bannerTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    const qp = inject(ActivatedRoute).snapshot.queryParamMap;
    const q = Number(qp.get('floor'));
    if (isDevMode() && qp.get('debug') === '1') this.debug.set(true);
    if (q >= 1 && q <= STAGES.length) this.floor.set(q);
    // จัดทีมใหม่ระหว่างรอเริ่ม: สร้างการต่อสู้ใหม่ให้ตรงกับตำแหน่งล่าสุด
    effect(() => {
      this.team.units();
      untracked(() => {
        if (!this.running()) this.prepare();
      });
    });
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
    this.projectiles.set([]);
    this.anims.set({});
    this.engine = new BattleEngine({
      allies: this.team.units(),
      stage: this.stage(),
      enemyTemplates: ENEMIES,
      autoUlt: this.autoUlt(),
    });
    this.time.set(0);
    this.round.set(0);
    this.totalRounds.set(this.engine.totalRounds);
    this.scroll.set(0);
    this.marchMs.set(0);
    this.banner.set(null);
    this.selectedId.set(null);
    this.focusId.set(null);
    this.facing.clear();
    this.blinkUntil.clear();
    this.snapshot();
  }

  start(): void {
    if (this.running()) return;
    if (this.result()) this.prepare();
    if (!this.engine.alive('ally').length) return;
    this.running.set(true);
    this.timer = setInterval(() => this.tick(), TICK * 1000);
  }

  /** แตะรูปตัวละคร (หรือกดปุ่ม 1–5): ใช้ท่าไม้ตายเมื่อเกจเต็ม */
  useUlt(id: number): void {
    if (this.running() && this.engine.requestUlt(id)) this.snapshot();
  }

  /** แตะศัตรู: ครั้งแรก = เลือก (ขึ้นการ์ด) · แตะซ้ำ = 🎯 โฟกัส · แตะเป้าโฟกัส = ยกเลิก */
  pickEnemy(id: number): void {
    if (!this.running()) return;
    if (id === this.focusId()) return this.cancelFocus();
    if (id === this.selectedId()) return this.setFocus(id);
    this.selectedId.set(id);
  }

  setFocus(id: number | null): void {
    if (!this.engine || id == null) return this.cancelFocus();
    if (id !== this.engine.focusTargetId) this.engine.setFocus(id);
    this.selectedId.set(null);
    this.focusId.set(this.engine.focusTargetId);
    this.snapshot();
  }

  cancelFocus(): void {
    if (this.engine?.focusTargetId != null) this.engine.setFocus(this.engine.focusTargetId);
    this.selectedId.set(null);
    this.focusId.set(null);
    this.snapshot();
  }

  @HostListener('document:keydown', ['$event'])
  onKey(e: KeyboardEvent): void {
    if (e.key === 'Escape') return this.cancelFocus();
    if ((e.key === 'd' || e.key === 'D') && isDevMode()) {
      this.debug.update(v => !v);
      return this.snapshot();
    }
    if ((e.key === 'f' || e.key === 'F') && this.selectedId() != null) return this.setFocus(this.selectedId());
    const n = Number(e.key);
    if (!this.running() || !Number.isInteger(n) || n < 1) return;
    const u = this.party()[n - 1];
    if (u) this.useUlt(u.id);
  }

  toggleAuto(): void {
    this.autoUlt.update(v => !v);
    if (this.engine) this.engine.autoUlt = this.autoUlt();
  }

  setSpeed(v: number): void {
    this.speed.set(v);
  }

  /** จำลอง 100 รอบแบบไม่แสดงผล เพื่อดูอัตราชนะ */
  simulate(runs = 100): void {
    let wins = 0;
    let t = 0;
    for (let seed = 1; seed <= runs; seed++) {
      const e = new BattleEngine({ allies: this.team.units(), stage: this.stage(), enemyTemplates: ENEMIES, seed, autoUlt: true });
      if (e.run() === 'win') wins++;
      t += e.time;
    }
    this.simReport.set(`จำลอง ${runs} รอบ: ชนะ ${Math.round((wins / runs) * 100)}% · เฉลี่ย ${(t / runs).toFixed(1)} วินาที`);
  }

  private tick(): void {
    for (let i = 0; i < this.speed() && !this.engine.result; i++) this.engine.step(TICK);
    this.handleEvents(this.engine.drainEvents());
    this.time.set(this.engine.fightTime);
    // ระหว่างเดินไปเวฟถัดไป: เล่นท่าเดินต่อเนื่อง
    if (this.engine.advancing > 0 && ++this.walkTick % 8 === 0) this.marchAnim();
    this.snapshot();
    if (this.engine.result) {
      clearInterval(this.timer);
      this.running.set(false);
      this.result.set(this.engine.result);
    }
  }

  private snapshot(): void {
    const e = this.engine;
    const byId = new Map(e.units.map(u => [u.id, u]));
    for (const u of e.units) {
      const t = u.targetId != null ? byId.get(u.targetId) : undefined;
      if (e.advancing > 0 && u.side === 'ally') this.facing.set(u.id, false);
      else if (t && t.pos.c !== u.pos.c) this.facing.set(u.id, t.pos.c < u.pos.c);
      else if (!this.facing.has(u.id)) this.facing.set(u.id, u.side === 'enemy');
    }
    this.views.set(
      // ศัตรูที่ล้มในเวฟก่อน ๆ ถูกทิ้งไว้ข้างหลังแล้ว ไม่ต้องแสดง
      e.units.filter(u => u.alive || u.side === 'ally' || u.round === e.round).map(u => ({
        id: u.id,
        side: u.side,
        name: u.name,
        cls: u.cls,
        r: u.pos.r,
        c: u.pos.c,
        hpPct: (u.hp / u.maxHp) * 100,
        manaPct: u.maxMana > 0 ? (u.mana / u.maxMana) * 100 : 0,
        shieldPct: (u.shield / u.maxHp) * 100,
        alive: u.alive,
        taunt: u.taunt > 0,
        star: u.star,
        level: u.level,
        sprite: u.sprite,
        boss: u.boss,
        flip: this.facing.get(u.id),
        blink: (this.blinkUntil.get(u.id) ?? 0) > this.engine.time,
        enter: u.side === 'enemy' && u.round > 0,
        queued: u.ultQueued,
        focused: u.id === e.focusTargetId,
        selected: u.id === this.selectedId(),
        intent: u.side === 'ally' ? u.intent : undefined,
        heroId: u.heroId,
        cd1: Math.max(0, u.cd1),
        cd2: Math.max(0, u.cd2),
        cd1Max: SKILL_CD[u.cls][0],
        cd2Max: SKILL_CD[u.cls][1],
        onFocus: u.side === 'ally' && e.focusTargetId != null && u.targetId === e.focusTargetId,
        elite: u.elite,
        moveSec: u.monster ? Math.min(0.6, 1 / u.moveSpeed) : undefined,
        buffed: u.buffs.length > 0,
        icon: u.monster ? MONSTERS[u.monster.definitionId]?.animation.tokenIcon : undefined,
        debug: this.debug() && u.monster ? this.debugLines(u, byId) : undefined,
        targetId: u.targetId,
        line: u.line,
        interrupter: u.side === 'ally' && canInterrupt(u.cls, 'ult'),
        cast: u.casting
          ? {
              label: u.casting.def.label,
              name: u.casting.def.name,
              pct: (1 - u.casting.left / u.casting.def.castTime) * 100,
              left: Math.max(0, u.casting.left),
              interruptible: u.casting.def.interruptible,
            }
          : undefined,
      })),
    );
  }

  /** debug overlay text for a monster: name, state, target, HP, cooldowns, skill / cast */
  private debugLines(u: BattleUnit, byId: Map<number, BattleUnit>): string[] {
    const m = monsterSnapshot(u)!;
    const t = m.currentTargetId != null ? byId.get(m.currentTargetId) : undefined;
    const lines = [
      `${u.name} · ${m.state}`,
      `→ ${t ? t.name : '-'} · HP ${Math.ceil(u.hp)}/${u.maxHp}`,
      `atkCD ${m.attackCooldownRemaining.toFixed(1)}`,
    ];
    for (const [id, cd] of Object.entries(m.skillCooldowns)) {
      const casting = u.casting?.def.id === id;
      const tag = casting ? `CASTING ${m.castTimer.toFixed(1)}s` : m.state === 'RECOVERING' && cd > 0 && this.interrupted.has(u.id) ? `INTERRUPTED ${cd.toFixed(1)}` : cd > 0 ? `COOLDOWN ${cd.toFixed(1)}` : 'READY';
      lines.push(`${id}: ${tag}`);
    }
    if (u.buffs.length) lines.push(u.buffs.map(b => `${b.def.id} ${b.remaining.toFixed(1)}s`).join(', '));
    return lines;
  }

  /** units whose last cast was interrupted (debug label) */
  private interrupted = new Set<number>();

  private marchAnim(): void {
    const anims = { ...this.anims() };
    for (const u of this.engine.alive('ally')) anims[u.id] = { anim: 'walk', key: ++this.animKey };
    this.anims.set(anims);
  }

  private showBanner(text: string, ms: number): void {
    clearTimeout(this.bannerTimer);
    this.banner.set(text);
    this.bannerTimer = setTimeout(() => this.banner.set(null), ms / this.speed());
  }

  private handleEvents(events: BattleEvent[]): void {
    if (!events.length) return;
    const anims = { ...this.anims() };
    const floats: FloatText[] = [];
    const fx: FxView[] = [];
    const unitOf = (id: number) => this.engine.units.find(u => u.id === id)!;
    const posOf = (id: number) => unitOf(id).pos;
    const set = (id: number, anim: AnimState['anim'], extra: Partial<AnimState> = {}) => (anims[id] = { anim, key: ++this.animKey, ...extra });
    /** เอฟเฟกต์ของสกิลนี้ เล่นตอนเริ่มท่าหรือตอนโดน ตามที่ตั้งไว้ใน FX */
    const addFx = (src: number, dst: number | undefined, kind: SkillKind, when: 'cast' | 'impact') => {
      const name = SHEETS[unitOf(src).sprite ?? '']?.fx?.[kind];
      const def = name ? FX[name] : undefined;
      if (!name || !def || (def.on ?? 'impact') !== when) return;
      const p = posOf(src);
      const q = def.at === 'target' && dst != null ? posOf(dst) : p;
      const rotate = q !== p && def.orient !== 'flip';
      const angle = rotate ? (Math.atan2(q.r - p.r, q.c - p.c) * 180) / Math.PI : 0;
      // หันตามผู้ใช้ (หรือตามทิศไปหาเป้าหมาย ถ้าเป้าไม่ได้อยู่คอลัมน์เดียวกัน)
      const flip = rotate ? false : q.c !== p.c ? q.c < p.c : !!this.facing.get(src);
      fx.push({ id: ++this.floatId, r: q.r, c: q.c, name, angle, flip });
    };

    for (const e of events) {
      switch (e.type) {
        case 'advance':
          this.round.set(e.round);
          this.marchMs.set((e.duration * 1000) / this.speed());
          this.scroll.update(s => s + 1);
          this.fx.set([]);
          this.floats.set([]);
          this.projectiles.set([]);
          this.showBanner(`เคลียร์! เดินหน้าไปเวฟ ${e.round + 1}/${this.totalRounds()}`, e.duration * 1000);
          for (const u of this.engine.alive('ally')) set(u.id, 'walk');
          break;
        case 'round':
          this.marchMs.set(0);
          this.showBanner(`เวฟ ${e.round + 1}/${this.totalRounds()} ศัตรูบุก!`, 1200);
          break;
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
          addFx(e.src, e.dst, e.kind, 'cast');
          break;
        }
        case 'impact':
          addFx(e.src, e.dst, e.kind, 'impact');
          break;
        case 'blink':
          // วาร์ป: ย้ายทันที + ค่อย ๆ ปรากฏ (ไม่ไถลข้ามสนาม)
          this.blinkUntil.set(e.src, this.engine.time + 0.3);
          break;
        case 'damage': {
          if (!e.poison && e.hurt !== false && anims[e.dst]?.anim !== 'die') set(e.dst, 'hurt');
          const p = posOf(e.dst);
          const text = e.amount > 0 ? `-${e.amount}` : 'บล็อก';
          floats.push({ id: ++this.floatId, r: p.r, c: p.c, text, kind: e.poison ? 'poison' : e.crit ? 'crit' : 'dmg' });
          break;
        }
        case 'shield': {
          const p = posOf(e.dst);
          floats.push({ id: ++this.floatId, r: p.r, c: p.c, text: `+โล่ ${e.amount}`, kind: 'shield' });
          // ตัวผู้ให้มีเอฟเฟกต์ท่าไม้ตายอยู่แล้ว ส่วนเพื่อนได้โดมโล่เล็ก
          const ward = SHEETS[unitOf(e.src).sprite ?? '']?.shieldFx;
          if (e.src !== e.dst && ward && FX[ward]) fx.push({ id: ++this.floatId, r: p.r, c: p.c, name: ward, angle: 0 });
          break;
        }
        case 'projectile': {
          const src = unitOf(e.src);
          const name = SHEETS[src.sprite ?? '']?.projectile?.[e.kind] ?? CLASS_PROJECTILE[src.cls];
          if (!name || !FX[name]) break;
          const p = src.pos, q = posOf(e.dst);
          const to = { x: q.c, y: q.r + SCENERY_ROWS };
          // ตกจากฟ้า: เริ่มเหนือเป้า 3 ช่อง เยื้องมาทางฝั่งผู้ยิง
          const dir = src.side === 'ally' ? -1 : 1;
          const from = e.sky ? { x: to.x + dir * 1.2, y: to.y - 3.2 } : { x: p.c, y: p.r + SCENERY_ROWS };
          const pv: ProjectileView = { id: ++this.floatId, name, from, to, flight: e.flight * 1000 };
          const sp = this.speed();
          this.projectiles.update(l => [...l, pv]);
          setTimeout(() => this.projectiles.update(l => l.filter(x => x.id !== pv.id)), projectileLife(pv.flight, sp));
          const hit = FX[name].hitFx;
          if (hit && FX[hit]) {
            setTimeout(() => {
              const f: FxView = { id: ++this.floatId, r: q.r, c: q.c, name: hit, angle: 0 };
              this.fx.update(l => [...l, f]);
              setTimeout(() => this.fx.update(l => l.filter(x => x.id !== f.id)), fxDuration(hit, sp) + 50);
            }, pv.flight / sp);
          }
          break;
        }
        case 'revive': {
          set(e.dst, 'idle');
          const p = posOf(e.dst);
          floats.push({ id: ++this.floatId, r: p.r, c: p.c, text: `คืนชีพ! +${e.amount}`, kind: 'revive' });
          break;
        }
        case 'heal': {
          const p = posOf(e.dst);
          floats.push({ id: ++this.floatId, r: p.r, c: p.c, text: `+${e.amount}`, kind: 'heal' });
          // เอฟเฟกต์ฮีลของผู้รักษา (ถ้าแผ่นกำหนดไว้)
          const hf = e.src != null ? SHEETS[unitOf(e.src).sprite ?? '']?.healFx : undefined;
          if (hf && FX[hf]) fx.push({ id: ++this.floatId, r: p.r, c: p.c, name: hf, angle: 0 });
          break;
        }
        case 'focus':
          this.focusId.set(e.dst);
          if (e.dst == null && e.reason === 'dead') this.showBanner('🎯 เป้าโฟกัสล้มแล้ว — ทีมกลับไปใช้ AI ปกติ', 1400);
          break;
        case 'castStart': {
          // monster cast clip (e.g. Alpha Howl): frames stretched over the cast time; sheets without one fall back
          if (SHEETS[unitOf(e.src).sprite ?? '']?.anims.cast) set(e.src, 'cast', { castTime: e.castTime });
          const p = posOf(e.src);
          floats.push({ id: ++this.floatId, r: p.r, c: p.c, text: e.skill, kind: 'skill' });
          break;
        }
        case 'fx': {
          // cast FX (e.g. Alpha Howl) — started by the engine so its activation frame lands on SKILL_ACTIVATE
          const p = posOf(e.src);
          const f: FxView = { id: ++this.floatId, r: p.r, c: p.c, name: e.name, angle: 0, flip: !!this.facing.get(e.src) };
          this.castFx.set(e.src, f.id);
          fx.push(f);
          break;
        }
        case 'fxStop': {
          const id = this.castFx.get(e.src);
          if (id != null) this.fx.update(l => l.filter(x => x.id !== id));
          this.castFx.delete(e.src);
          break;
        }
        case 'skillActivated': {
          const p = posOf(e.src);
          floats.push({ id: ++this.floatId, r: p.r, c: p.c, text: e.name + '!', kind: 'skill' });
          this.castFx.delete(e.src);
          this.interrupted.delete(e.src);
          break;
        }
        case 'buff': {
          const p = posOf(e.dst);
          floats.push({ id: ++this.floatId, r: p.r, c: p.c, text: e.refreshed ? 'ATK↑ ต่อเวลา' : 'ATK +25%', kind: 'buff' });
          break;
        }
        case 'miss': {
          const p = posOf(e.src);
          floats.push({ id: ++this.floatId, r: p.r, c: p.c, text: 'MISS', kind: 'miss' });
          break;
        }
        case 'interrupt': {
          this.interrupted.add(e.dst);
          const p = posOf(e.dst);
          floats.push({ id: ++this.floatId, r: p.r, c: p.c, text: 'INTERRUPTED!', kind: 'interrupt' });
          set(e.dst, 'hurt', { force: true });
          break;
        }
        case 'immune': {
          const p = posOf(e.dst);
          floats.push({ id: ++this.floatId, r: p.r, c: p.c, text: 'UNINTERRUPTIBLE', kind: 'immune' });
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
