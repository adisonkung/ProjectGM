import { FxTrack } from '../../core/models/fx';
import { FxAnchors } from '../render/fx-anchor';
import { MockVisual } from '../../core/data/visuals';
import { BackgroundDef } from '../../core/data/backgrounds';
import { afterNextRender, Component, computed, DestroyRef, effect, ElementRef, inject, Injector, input, NgZone, output, untracked, viewChildren } from '@angular/core';
import { HeroClass } from '../../core/models/hero';
import { Side } from '../../core/models/unit';
import { BOARD_COLS, BOARD_ROWS, SCENERY_ROWS } from '../engine/grid';
import { CastBarComponent, CastView } from '../cast-bar/cast-bar.component';
import { FieldComponent } from '../field/field.component';
import { FocusMarkComponent } from '../focus-mark/focus-mark.component';
import { FxSpriteComponent } from '../fx-sprite/fx-sprite.component';
import { ProjectileComponent } from '../projectile/projectile.component';
import { SpriteAnim, UnitSpriteComponent } from '../unit-sprite/unit-sprite.component';
import { SHEETS } from '../../core/data/sprites';
import type { PixiBolt, PixiFx, PixiUnit, PixiUnitLayer } from '../render/pixi-units';
import { unitLook } from '../render/unit-look';

/** ข้อมูลยูนิตสำหรับแสดงผล (สแนปช็อตจากเอนจินในแต่ละเฟรม) */
export interface UnitView {
  id: number;
  side: Side;
  name: string;
  cls: HeroClass;
  /** screen position in cells (continuous): r = lane, c = column inside the camera window */
  r: number;
  c: number;
  hpPct: number;
  manaPct: number;
  /** โล่เทียบกับเลือดสูงสุด (%) */
  shieldPct: number;
  alive: boolean;
  /** resurrection materialising (visible, untargetable) */
  reviving?: boolean;
  taunt: boolean;
  star?: number;
  level?: number;
  sprite?: string;
  boss?: boolean;
  /** หันซ้าย */
  flip?: boolean;
  /** เพิ่งวาร์ป: ย้ายทันทีไม่ต้องเลื่อน แล้วค่อย ๆ ปรากฏ */
  blink?: boolean;
  /** false = the clip fades the unit itself (AnimDef.opacity): no blink-in fade from the board */
  blinkFade?: boolean;
  /** ผู้เล่นกดท่าไม้ตายแล้ว รอจังหวะร่าย */
  queued?: boolean;
  /** ศัตรูกำลังร่ายสกิล (แถบร่าย) */
  cast?: CastView;
  /** ฮีโร่: ท่าไม้ตายตัดการร่ายได้ */
  interrupter?: boolean;
  /** แนวรบตามฟอร์เมชัน */
  line?: 'front' | 'back';
  /** STEP 9: เป็นเป้าโฟกัส / ถูกเลือกอยู่ (ศัตรู) · เหตุผลการเลือกเป้า (ฮีโร่) */
  focused?: boolean;
  selected?: boolean;
  intent?: string;
  /** ฮีโร่: กำลังตีเป้าโฟกัสอยู่ */
  onFocus?: boolean;
  /** ฮีโร่: id ต้นแบบ (ภาพ) + คูลดาวน์ที่เหลือ/เต็ม ของสกิล 1 และ 2 (วิ) */
  heroId?: string;
  cd1?: number;
  cd2?: number;
  cd1Max?: number;
  cd2Max?: number;
  /** monster: elite rank / seconds per step (movement tween) / buffed / token icon */
  elite?: boolean;
  moveSec?: number;
  /** walking right now (battle: from the position change per tick) — drives the looping walk cycle; unset = legacy one-shot walk */
  moving?: boolean;
  /** ground speed while walking (cells / game s) — scales the walk cycle (AnimDef.pace) */
  pace?: number;
  /** hits taken so far (battle) — the Pixi renderer flashes the unit white when it changes */
  hit?: number;
  buffed?: boolean;
  icon?: string;
  /** hero AI use modes per slot (party bar chips) */
  modes?: Partial<Record<'skill' | 'skill2' | 'ult', string>>;
  /** BOSS / FINAL_BOSS (boss bar) */
  bossRank?: string;
  /** placeholder art for monsters without a sheet (+ name / HP% label under it) */
  mock?: MockVisual;
  /** status icons over the head */
  statuses?: { id: string; icon: string; left: number }[];
  /** mist form / boss seal: can't be targeted (drawn faded) */
  untargetable?: boolean;
  /** BROKEN by a Break (boss) */
  broken?: boolean;
  /** enraged boss phase (red aura) */
  enraged?: boolean;
  /** combat debug lines (dev builds only) + current target id for the target line */
  debug?: string[];
  targetId?: number | null;
}

/** mock FX: a telegraphed / flashing area on the board (screen cells) */
export interface ZoneView {
  id: number;
  r: number;
  c: number;
  w: number;
  h: number;
  color: string;
  /** telegraph = growing outline during the cast · flash = activation burst */
  kind: 'telegraph' | 'flash';
  /** telegraph length (game s) */
  sec?: number;
}

export interface FloatText {
  id: number;
  r: number;
  c: number;
  text: string;
  kind: 'dmg' | 'crit' | 'heal' | 'skill' | 'poison' | 'shield' | 'revive' | 'interrupt' | 'immune' | 'buff' | 'miss' | 'break';
}

/** เอฟเฟกต์สกิลที่กำลังเล่นบนกระดาน */
export interface FxView {
  /** Requested outward vector in cells; resolved against visible bounds at the attack's actual start. */
  outward?: [number, number];
  track?: FxTrack;
  additive?: boolean;
  /** Stop following after this many visible ms; the frozen anchor then moves only with the camera. */
  lockAfterMs?: number;
  role?: string;
  /** Per-cast presentation overrides, independent of the shared FX definition. */
  delayMs?: number;
  scale?: number;
  owner?: number;
  id: number;
  r: number;
  c: number;
  name: string;
  angle: number;
  flip?: boolean;
  /** resolved [dx, dy] on the owner's anchor (`fxOffset`) */
  offset?: [number, number];
  /** drawn below the units (FxDef.layer 'under') */
  under?: boolean;
  /** unit id this FX rides on (an attached aura): the frame loop moves it with that unit's drawn position */
  follow?: number;
  /** Optional independent vertical ground reference (e.g. target X, caster feet Y). */
  followY?: number;
  /** Runtime-owned field visuals stop immediately when removed; loops run until their owner ends them. */
  managed?: boolean;
  loop?: boolean;
}

/** กระสุนที่กำลังบิน: ตำแหน่งเป็นจำนวนช่องบนจอ (รวมแถวฉากแล้ว) */
export interface ProjectileView {
  id: number;
  name: string;
  from: { x: number; y: number };
  to: { x: number; y: number };
  /** ms ที่ความเร็ว x1 */
  flight: number;
}

/** debug world overlay (dev builds): formation anchors, zones, advance target, regroup radius — screen cells */
export interface WorldDebug {
  anchors: { x: number; y: number; team: 'ally' | 'enemy'; label: string; empty: boolean }[];
  neutral: { x0: number; x1: number };
  advanceTarget: number | null;
  regroupRadius: number;
}

export interface AnimState {
  anim: SpriteAnim;
  key: number;
  /** anim 'cast': cast time in game seconds */
  castTime?: number;
  /** anim 'cast': the skill's clip (sheets with several cast rows) */
  castClip?: string;
  /** play over a running attack/cast (interrupt → hurt) */
  force?: boolean;
}

@Component({
  selector: 'app-board',
  imports: [UnitSpriteComponent, FxSpriteComponent, FieldComponent, ProjectileComponent, CastBarComponent, FocusMarkComponent],
  templateUrl: './board.component.html',
  styleUrl: './board.component.scss',
})
export class BoardComponent {
  readonly units = input<UnitView[]>([]);
  readonly floats = input<FloatText[]>([]);
  readonly fx = input<FxView[]>([]);
  readonly zones = input<ZoneView[]>([]);
  readonly projectiles = input<ProjectileView[]>([]);
  readonly anims = input<Partial<Record<number, AnimState>>>({});
  readonly speed = input(1);
  /** แตะศัตรู (เลือกเพื่อโฟกัส) */
  readonly pick = output<number>();
  readonly finishedFx = output<number[]>();
  private readonly zone = inject(NgZone);
  /** camera x in cells (background parallax follows it continuously) */
  readonly scroll = input(0);
  /** ภาพพื้นหลังของด่าน */
  readonly background = input<BackgroundDef | null | undefined>(null);
  /** combat debug overlay (states, targets) */
  readonly debug = input(false);
  /** debug: formation anchors / zones / regroup radius */
  readonly world = input<WorldDebug | null>(null);
  /** real ms between two snapshots (positions tween linearly over it) */
  readonly tickMs = input(50);
  /**
   * who draws the units: 'dom' (app-unit-sprite, a Web Animation per clip) or 'pixi' (one WebGL canvas, every frame
   * from one game clock — render/pixi-units.ts). With 'pixi' the skill FX are drawn on the same canvas and clock
   * (phase 3) and so are the projectiles (phase 4); bars / cast bars / numbers stay DOM either way.
   */
  readonly renderer = input<'dom' | 'pixi'>('dom');
  /** battle: the game clock is frozen (paused / hit-stop) — the Pixi units hold their frame */
  readonly frozen = input<(() => boolean) | undefined>(undefined);
  /** debug: lines from each monster to its target (board cell coordinates incl. scenery rows) */
  readonly targetLines = computed(() => {
    if (!this.debug()) return [];
    const byId = new Map(this.units().map(u => [u.id, u]));
    return this.units()
      .filter(u => u.alive && u.debug && u.targetId != null && byId.get(u.targetId!)?.alive)
      .map(u => {
        const t = byId.get(u.targetId!)!;
        return { id: u.id, x1: u.c + 0.5, y1: u.r + SCENERY_ROWS + 0.5, x2: t.c + 0.5, y2: t.r + SCENERY_ROWS + 0.5 };
      });
  });

  readonly rows = BOARD_ROWS + SCENERY_ROWS;
  readonly cols = BOARD_COLS;

  /**
   * ตัวที่ยืนช่องเดียวกัน: เลื่อนให้เหลื่อมกันเป็นชั้น ๆ (ซ้าย-ขวา และสูง-ต่ำสลับกัน)
   * คืน [dx%, dy%, ลำดับชั้น, ลำดับในกอง (ยกหลอดเลือดขึ้นทีละชั้นไม่ให้ทับกัน)] ตาม id
   */
  readonly spread = computed(() => {
    const groups = new Map<number, UnitView[]>();
    for (const u of this.units()) {
      if (!u.alive) continue;
      const k = Math.round(u.r) * 1000 + Math.round(u.c);
      groups.set(k, [...(groups.get(k) ?? []), u]);
    }
    const out = new Map<number, [number, number, number, number]>();
    for (const list of groups.values()) {
      const n = list.length;
      list.forEach((u, i) => {
        if (n === 1) {
          out.set(u.id, [0, 0, 0, 0]);
          return;
        }
        const dx = (i - (n - 1) / 2) * (56 / n);
        const dy = i % 2 ? -10 : 6;
        out.set(u.id, [dx, dy, dy > 0 ? 2 : 1, i]);
      });
    }
    return out;
  });

  // ---------------------------------------------------------------- smooth unit motion
  /** battle: engine step counter (a new snapshot pair) — with `alpha`, positions are interpolated by game time */
  readonly tick = input<number | undefined>(undefined);
  /** battle: how far the display is between the last two engine steps (0–1), read every frame */
  readonly alpha = input<(() => number) | undefined>(undefined);
  /**
   * Units (and the camera) are moved by a requestAnimationFrame loop, never by a CSS transition per snapshot.
   * Battle (tick + alpha given): fixed-timestep interpolation — previous step → last step at alpha, i.e. exactly where
   * the game is at this display frame, independent of when change detection ran — then a short exponential follow
   * (τ 55 ms) that irons out the engine's own unevenness (a step ending mid-tick, re-targets). Elsewhere (sprite lab):
   * tween from the drawn position to the new one over the measured snapshot interval.
   * Positions are in % of a cell (the same numbers as `pos()`).
   */
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  /** per unit: last two snapshot positions (prev → cur), the drawn position, and the tween start (no-alpha mode) */
  private readonly st = new Map<number, { prev: [number, number]; cur: [number, number]; draw: [number, number]; t0: number; from: [number, number] }>();
  /** stacking offset on a shared cell (spread): eased separately toward its target, so re-stacking never jerks the walk */
  private readonly off = new Map<number, { cur: [number, number]; to: [number, number] }>();
  private readonly drawn = new Map<number, string>();
  /** first position of each unit (static template binding → no flash at 0,0 before the loop writes it) */
  private readonly spawnAt = new Map<number, string>();
  /** camera (scroll) the same way: prev → cur by alpha, followed */
  private cam = { prev: 0, cur: 0, draw: 0, init: false };
  private lastTick?: number;
  private lastSnap = 0;
  private lastFrame = 0;
  /** measured ms between snapshots (EMA) — the tween length without alpha */
  private gap = 50;
  private raf = 0;
  /** ONE visual game clock (s): advances × battle speed, stands still while frozen · idle breath clock (real s) */
  private vclock = 0;
  private readonly fxSprites = viewChildren(FxSpriteComponent);
  private readonly fxAnchors = new FxAnchors(SCENERY_ROWS);
  private idleClock = 0;
  private pixi: PixiUnitLayer | null = null;
  private pixiPending = false;
  private pixiHost?: HTMLElement;
  private resizeObs?: ResizeObserver;
  private pxOn = new Set<number>();
  private fxPxOn = new Set<number>();
  private boltPxOn = new Set<number>();

  constructor() {
    effect(() => {
      const us = this.units();
      const sp = this.spread();
      const tk = this.tick();
      const sc = this.scroll();
      untracked(() => this.retarget(us, sp, tk, sc));
    });
    const zone = inject(NgZone);
    afterNextRender(() => zone.runOutsideAngular(() => (this.raf = requestAnimationFrame(this.frame))));
    inject(DestroyRef).onDestroy(() => {
      cancelAnimationFrame(this.raf);
      this.fxAnchors.clear();
      this.resizeObs?.disconnect();
      this.pixi?.destroy();
      this.pixi = null;
    });
    // the Pixi renderer: created lazily (its own chunk) when switched on, torn down when switched off
    effect(() => {
      const want = this.renderer() === 'pixi';
      untracked(() => (want ? this.startPixi() : this.stopPixi()));
    });
  }

  private boardEl(): HTMLElement | null {
    return this.host.nativeElement.querySelector<HTMLElement>('.board');
  }

  private startPixi(): void {
    if (this.pixi || this.pixiPending || typeof window === 'undefined') return;
    const board = this.boardEl();
    if (!board) {
      afterNextRender(() => this.startPixi(), { injector: this.injector });
      return;
    }
    this.pixiPending = true;
    const host = document.createElement('div');
    host.className = 'pixi-host';
    // created at runtime (no encapsulation attribute): inline styles · above the 'under' FX (z 5), below DOM FX / bars
    host.style.cssText = 'position:absolute;inset:0;z-index:6;pointer-events:none;';
    (board.querySelector<HTMLElement>(':scope > .cam') ?? board).appendChild(host);
    this.pixiHost = host;
    // chunk load failure (offline / stale deploy) = stay DOM, like a device without WebGL
    import('../render/pixi-units').then(m => m.PixiUnitLayer.create(host, board.clientWidth, board.clientHeight)).catch(() => null).then(layer => {
      this.pixiPending = false;
      if (!layer || this.renderer() !== 'pixi') {
        layer?.destroy();
        host.remove();
        return;
      }
      this.pixi = layer;
      this.resizeObs = new ResizeObserver(() => this.pixi?.resize(board.clientWidth, board.clientHeight));
      this.resizeObs.observe(board);
    });
  }

  private stopPixi(): void {
    this.resizeObs?.disconnect();
    this.pixi?.destroy();
    this.pixi = null;
    this.pixiHost?.remove();
    this.pixiHost = undefined;
    for (const id of this.pxOn) this.host.nativeElement.querySelector(`.unit[data-uid="${id}"]`)?.classList.remove('px');
    this.pxOn.clear();
    for (const id of this.fxPxOn) this.host.nativeElement.querySelector(`.fx-wrap[data-fx="${id}"]`)?.classList.remove('px');
    this.fxPxOn.clear();
    for (const id of this.boltPxOn) this.host.nativeElement.querySelector(`app-projectile[data-proj="${id}"]`)?.classList.remove('px');
    this.boltPxOn.clear();
  }

  /** this frame's units for the Pixi layer (same interpolated positions as the DOM units) */
  private drawPixi(els: HTMLElement[]): void {
    const board = this.boardEl();
    if (!this.pixi || !board) return;
    const cell = board.clientWidth / this.cols;
    const byId = new Map(this.units().map(u => [u.id, u]));
    const anims = this.anims();
    const list: PixiUnit[] = [];
    const elOf = new Map<number, HTMLElement>();
    for (const el of els) {
      const id = Number(el.dataset['uid']);
      const u = byId.get(id);
      const s = this.st.get(id);
      if (!u || !s || !u.sprite || !SHEETS[u.sprite]) continue;
      elOf.set(id, el);
      const o = this.off.get(id);
      const a = anims[id] ?? { anim: 'idle' as SpriteAnim, key: 0 };
      list.push({
        id,
        sheet: u.sprite,
        x: ((s.draw[0] + (o?.cur[0] ?? 0)) / 100) * cell,
        y: ((s.draw[1] + (o?.cur[1] ?? 0)) / 100) * cell,
        flip: !!u.flip,
        z: this.unitZ(u),
        alpha: Number(getComputedStyle(el).opacity) || 0,
        req: { anim: a.anim, castTime: a.castTime, castClip: a.castClip, force: a.force },
        key: a.key,
        moving: u.moving === undefined ? undefined : !!u.moving && u.alive,
        pace: u.pace,
        look: unitLook(u),
        hit: u.hit,
      });
    }
    // skill FX: the cell they were placed on, or (attached auras) their unit's drawn cell this frame
    const fx: PixiFx[] = this.fx().map(f => {
      const anchor = this.fxAnchors.at(f.id);
      const s = f.follow != null ? this.st.get(f.follow) : undefined;
      const o = f.follow != null ? this.off.get(f.follow) : undefined;
      return {
        id: f.id,
        name: f.name,
        x: anchor && (f.lockAfterMs != null || f.followY != null) ? anchor.x / 100 * cell : s ? ((s.draw[0] + (o?.cur[0] ?? 0)) / 100) * cell : f.c * cell,
        y: anchor && (f.lockAfterMs != null || f.followY != null) ? anchor.y / 100 * cell : s ? ((s.draw[1] + (o?.cur[1] ?? 0)) / 100) * cell : (f.r + SCENERY_ROWS) * cell,
        angle: anchor?.outward && f.role === 'trail' ? anchor.outward.angle : f.angle,
        flip: anchor?.outward && f.role !== 'trail' ? anchor.outward.flip : !!f.flip,
        motionY: anchor?.outward?.dySign,
        offset: f.offset, delayMs: f.delayMs, scale: f.scale, track: f.track, additive: f.additive,
        under: !!f.under,
        managed: !!f.managed,
        loop: !!f.loop,
      };
    });
    const bolts: PixiBolt[] = this.projectiles().map(p => ({ id: p.id, name: p.name, from: p.from, to: p.to, flight: p.flight }));
    const out = this.pixi.draw(list, cell, this.vclock, this.idleClock, fx, bolts);
    const drawn = out.units;
    this.hideDrawn(out.fx, this.fxPxOn, id => `.fx-wrap[data-fx="${id}"]`);
    this.hideDrawn(out.bolts, this.boltPxOn, id => `app-projectile[data-proj="${id}"]`);
    // the DOM sheet of a unit Pixi draws is hidden (bars, cast bar, focus mark … stay DOM)
    for (const [id, el] of elOf) {
      const on = drawn.has(id);
      if (on !== this.pxOn.has(id)) {
        el.classList.toggle('px', on);
        if (on) this.pxOn.add(id);
        else this.pxOn.delete(id);
      }
    }
  }

  /** the DOM copy of what Pixi drew this frame gets `.px` (hidden) — once per id */
  private hideDrawn(ids: Set<number>, on: Set<number>, sel: (id: number) => string): void {
    for (const id of ids) {
      if (on.has(id)) continue;
      const el = this.host.nativeElement.querySelector(sel(id));
      if (el) (el.classList.add('px'), on.add(id));
    }
    for (const id of on) if (!ids.has(id)) on.delete(id);
  }

  /** cell position in % of a cell (what `pos()` writes) */
  private base(u: UnitView): [number, number] {
    return [u.c * 100, (u.r + SCENERY_ROWS) * 100];
  }

  private retarget(us: UnitView[], sp: Map<number, [number, number, number, number]>, tk: number | undefined, scroll: number): void {
    const now = performance.now();
    const dt = now - this.lastSnap;
    if (dt > 25 && dt < 200) this.gap = Math.min(110, Math.max(this.tickMs(), this.gap * 0.8 + dt * 0.2));
    this.lastSnap = now;
    // a new engine step: what was "current" becomes "previous" (extra snapshots inside a step only update current)
    const stepped = tk !== undefined && tk !== this.lastTick;
    this.lastTick = tk;
    if (stepped) {
      for (const s of this.st.values()) s.prev = s.cur;
      this.cam.prev = this.cam.cur;
    }
    if (!this.cam.init) this.cam = { prev: scroll, cur: scroll, draw: scroll, init: true };
    this.cam.cur = scroll;
    if (Math.abs(this.cam.cur - this.cam.draw) > 3) this.cam = { prev: scroll, cur: scroll, draw: scroll, init: true };
    const live = new Set<number>();
    for (const u of us) {
      live.add(u.id);
      const t = this.base(u);
      const [ox, oy] = sp.get(u.id) ?? [0, 0];
      const o = this.off.get(u.id);
      if (o) o.to = [ox, oy];
      else this.off.set(u.id, { cur: [ox, oy], to: [ox, oy] });
      if (!this.spawnAt.has(u.id)) this.spawnAt.set(u.id, `translate(${t[0] + ox}%, ${t[1] + oy}%)`);
      const s = this.st.get(u.id);
      // blink / teleport / first sight: jump
      if (!s || u.blink || Math.abs(t[0] - s.draw[0]) > 250 || Math.abs(t[1] - s.draw[1]) > 250) {
        this.st.set(u.id, { prev: t, cur: t, draw: t, t0: now, from: t });
        this.off.get(u.id)!.cur = [ox, oy];
        continue;
      }
      if (s.cur[0] !== t[0] || s.cur[1] !== t[1]) {
        s.from = [...s.draw];
        s.t0 = now;
      }
      s.cur = t;
    }
    for (const id of [...this.st.keys()]) if (!live.has(id)) (this.st.delete(id), this.off.delete(id), this.drawn.delete(id));
  }

  private readonly frame = (): void => {
    const now = performance.now();
    const dt = Math.min(100, now - (this.lastFrame || now));
    this.lastFrame = now;
    const alphaFn = this.alpha();
    const a = alphaFn ? alphaFn() : 0;
    const follow = 1 - Math.exp(-dt / 55);
    if (!this.frozen()?.()) {
      this.vclock += (dt / 1000) * this.speed();
      this.idleClock += dt / 1000;
    }
    const ease = 1 - Math.exp(-dt / 90);
    const els = this.host.nativeElement.querySelectorAll<HTMLElement>('.unit[data-uid]');
    for (const el of Array.from(els)) {
      const id = Number(el.dataset['uid']);
      const s = this.st.get(id);
      if (!s) continue;
      if (alphaFn) {
        const tx = s.prev[0] + (s.cur[0] - s.prev[0]) * a;
        const ty = s.prev[1] + (s.cur[1] - s.prev[1]) * a;
        s.draw = [s.draw[0] + (tx - s.draw[0]) * follow, s.draw[1] + (ty - s.draw[1]) * follow];
      } else {
        const k = Math.min(1, Math.max(0, (now - s.t0) / this.gap));
        s.draw = [s.from[0] + (s.cur[0] - s.from[0]) * k, s.from[1] + (s.cur[1] - s.from[1]) * k];
      }
      const o = this.off.get(id);
      if (o) o.cur = [o.cur[0] + (o.to[0] - o.cur[0]) * ease, o.cur[1] + (o.to[1] - o.cur[1]) * ease];
      const tf = `translate(${(s.draw[0] + (o?.cur[0] ?? 0)).toFixed(2)}%, ${(s.draw[1] + (o?.cur[1] ?? 0)).toFixed(2)}%)`;
      if (this.drawn.get(id) !== tf || el.style.transform !== tf) {
        el.style.transform = tf;
        this.drawn.set(id, tf);
      }
    }
    this.fxAnchors.sync(this.fx(), this.vclock, this.cam.draw * 100, id => {
      const s = this.st.get(id), o = this.off.get(id);
      return s ? { x: s.draw[0] + (o?.cur[0] ?? 0), y: s.draw[1] + (o?.cur[1] ?? 0) } : undefined;
    });
    if (this.pixi) this.drawPixi(Array.from(els));
    let completed: number[] | undefined;
    for (const sprite of this.fxSprites()) {
      if (!sprite.track()) continue;
      const anchor = this.fxAnchors.at(sprite.instanceId());
      if (anchor) {
        const elapsed = (this.vclock - anchor.born) * 1000;
        sprite.drawTrack(elapsed, anchor.outward);
        if (elapsed >= sprite.delayMs() + sprite.track()!.durationMs && this.fxAnchors.complete(sprite.instanceId())) {
          (completed ??= []).push(sprite.instanceId());
        }
      }
    }
    if (completed) this.zone.run(() => this.finishedFx.emit(completed!));
    // attached FX (auras / guards / fields) ride on their unit: same drawn transform as the unit this frame
    const riders = this.host.nativeElement.querySelectorAll<HTMLElement>('.fx-wrap[data-fx]');
    for (const el of Array.from(riders)) {
      const anchor = this.fxAnchors.at(Number(el.dataset['fx']));
      const tf = anchor && (anchor.freezes || anchor.axis) ? `translate(${anchor.x.toFixed(2)}%, ${anchor.y.toFixed(2)}%)`
        : anchor?.follow != null ? this.drawn.get(anchor.follow) : undefined;
      if (tf && el.style.transform !== tf) el.style.transform = tf;
    }
    // camera: background parallax reads --shift from the board (FieldComponent [live])
    if (alphaFn) {
      const c = this.cam.prev + (this.cam.cur - this.cam.prev) * a;
      this.cam.draw += (c - this.cam.draw) * follow;
      const v = this.cam.draw.toFixed(4);
      if (this.host.nativeElement.style.getPropertyValue('--shift') !== v) this.host.nativeElement.style.setProperty('--shift', v);
    }
    this.raf = requestAnimationFrame(this.frame);
  };

  /** template: the position a unit first appeared at (afterwards the frame loop owns `transform`) */
  spawnPos(u: UnitView): string {
    return this.spawnAt.get(u.id) ?? this.unitPos(u);
  }

  pos(r: number, c: number, dx = 0, dy = 0): string {
    return `translate(${c * 100 + dx}%, ${(r + SCENERY_ROWS) * 100 + dy}%)`;
  }

  unitPos(u: UnitView): string {
    const [dx, dy] = this.spread().get(u.id) ?? [0, 0];
    return this.pos(u.r, u.c, dx, dy);
  }

  /** caster standing in the outer columns: its cast bar hugs the inside of the field */
  edgeOf(u: UnitView): 'l' | 'r' | '' {
    return u.c < 1 ? 'l' : u.c > this.cols - 2 ? 'r' : '';
  }

  /** ตัวที่อยู่ต่ำกว่า (ใกล้จอ) วาดทับตัวที่อยู่สูงกว่า */
  unitZ(u: UnitView): number {
    return (u.r + SCENERY_ROWS) * 10 + (this.spread().get(u.id)?.[2] ?? 0) + (u.alive ? 3 : 0);
  }
}
