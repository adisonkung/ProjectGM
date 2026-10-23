import {
  AfterViewInit, ChangeDetectionStrategy, Component, computed, effect, ElementRef, HostListener, inject, input, NgZone, OnDestroy, output, signal, untracked, viewChild,
} from '@angular/core';
import { BUILDING_BY_ID } from '../core/data/island-layout';
import { CitadelFrameComponent } from '../shared/citadel-frame.component';
import { CitadelIconComponent } from '../shared/citadel-icon.component';
import { PreloadService } from '../core/services/preload.service';
import { SKY_ZOOM, SKY_BASE, SKY_FX, SKY_HERO_SCALE, SKY_MASKS, SKY_NODES, SKY_PAD, SKY_PLOTS, SKY_SPAWN, SKY_SPIRE, SKY_WORLD } from '../core/data/sky-city';
import { IslandBuildingState, Vec2 } from '../core/models/island';
import { unlockFloorOf } from '../core/rules/island';
import { IslandHeroComponent, IslandHeroView } from './island-hero.component';
import { SkyCamera, SkyCanvasRenderer } from './sky-canvas';
import { IconComponent } from '../shared/icon.component';

/** spire look per tower visual stage (0 sealed … 5 conquered) — CSS filter on the spire overlay + which FX run */
const SPIRE_STAGE = [
  { filter: 'brightness(.42) saturate(.2) contrast(1.15)', ring: false, glow: 0, aura: 0 },
  { filter: 'brightness(.6) saturate(.45) contrast(1.1)', ring: false, glow: 0.35, aura: 0 },
  { filter: 'brightness(.8) saturate(.75)', ring: true, glow: 0.55, aura: 0.25 },
  { filter: 'none', ring: true, glow: 0.8, aura: 0.45 },
  { filter: 'brightness(1.06) saturate(1.15)', ring: true, glow: 1, aura: 0.7 },
  { filter: 'brightness(1.12) saturate(1.2) sepia(.38) hue-rotate(-12deg)', ring: true, glow: 1, aura: 1 },
];

/**
 * Sky City scene — the image-based home island (data: core/data/sky-city.ts).
 * Layers (world px): sky gradient · stars · far islands (parallax) · back cloud sea → [island group, gently bobbing:
 * base art (empty plots) · waterfall / water / crystal FX (masks) · spire overlay + rune ring + glow · landmarks
 * (unlocked) and heroes depth-sorted by ground line · forge smoke · fountains] → front wisps · god rays · motes →
 * tap areas + name plates. Core inputs / outputs match the classic scene; City also accepts a cosmetic gate cue.
 */
@Component({
  selector: 'app-sky-city',
  imports: [IslandHeroComponent, IconComponent, CitadelFrameComponent, CitadelIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sky-city.component.html',
  styleUrl: './sky-city.component.scss',
})
export class SkyCityComponent implements AfterViewInit, OnDestroy {
  readonly buildings = input.required<Record<string, IslandBuildingState>>();
  readonly usable = input<string[]>([]);
  readonly heroes = input<IslandHeroView[]>([]);
  readonly focus = input<Vec2 | null>(null);
  readonly fxBuilding = input<string | null>(null);
  readonly selected = input<string | null>(null);
  readonly towerStage = input(0);
  readonly enteringTower = input(false);
  readonly referenceLook = input(false);
  readonly buildingTap = output<string>();
  readonly heroTap = output<number>();

  readonly W = SKY_WORLD.w;
  readonly H = SKY_WORLD.h;
  readonly PAD = SKY_PAD;
  readonly base = SKY_BASE;
  readonly spire = SKY_SPIRE;
  readonly fx = SKY_FX;
  readonly towerPlot = SKY_PLOTS['tower'];
  readonly masks = SKY_MASKS;
  readonly heroScale = SKY_HERO_SCALE;
  readonly vp = viewChild.required<ElementRef<HTMLElement>>('vp');
  private readonly backCv = viewChild.required<ElementRef<HTMLCanvasElement>>('back');
  private readonly frontCv = viewChild.required<ElementRef<HTMLCanvasElement>>('front');
  private readonly worldEl = viewChild.required<ElementRef<HTMLElement>>('world');
  private readonly uiWorldEl = viewChild.required<ElementRef<HTMLElement>>('uiWorld');
  private readonly isleEl = viewChild.required<ElementRef<HTMLElement>>('isle');
  private readonly isleUiEl = viewChild.required<ElementRef<HTMLElement>>('isleUi');
  private readonly zone = inject(NgZone);
  private resize?: ResizeObserver;
  private readonly preload = inject(PreloadService);
  /** all city art decoded → the map fades in (a loading card shows until then) */
  readonly ready = this.preload.ready;
  readonly progress = computed(() => Math.round(this.preload.progress() * 100));
  /** effects quality: 'lite' drops the extra sky life (dragon, birds, motes, god rays, front mist) for slow GPUs */
  readonly lite = signal(readFxPref() === 'lite');
  private fxAuto = readFxPref() === null;

  /** fit-to-height scale × player zoom (the city is big: default zoom shows a district, pan in 2-D) */
  readonly fitK = signal(0.4);
  readonly zoom = signal(SKY_ZOOM.start);
  readonly k = computed(() => this.fitK() * this.zoom());
  readonly zoomMin = SKY_ZOOM.min;
  readonly zoomMax = SKY_ZOOM.max;

  readonly spireLook = computed(() => {
    const stage = Math.max(0, Math.min(5, this.towerStage()));
    const look = SPIRE_STAGE[stage];
    // The sealed spire stays sealed; the daytime palette lifts its dark stone without enabling FX.
    return this.referenceLook() && stage < 2 ? { ...look, filter: stage === 0 ? 'brightness(.8) saturate(.65)' : 'brightness(.9) saturate(.8)' } : look;
  });
  readonly gold = computed(() => this.towerStage() >= 5);

  /** landmarks to draw (unlocked ones; the one being revealed rises) */
  readonly landmarks = computed(() => {
    const st = this.buildings();
    return Object.values(SKY_PLOTS).filter(p => p.art && st[p.id]?.isUnlocked).map(p => ({ id: p.id, ...p.art! }));
  });
  /** empty plots that will host a landmark: a faint summoning circle (brighter when the feature is already usable) */
  readonly circles = computed(() => {
    const st = this.buildings(), use = new Set(this.usable());
    return Object.values(SKY_PLOTS).filter(p => p.art && !st[p.id]?.isUnlocked).map(p => ({
      id: p.id, x: p.art!.x + p.art!.w / 2, y: p.art!.z - Math.min(90, p.art!.h * 0.22), r: Math.min(p.art!.w * 0.36, 240), live: use.has(p.id),
    }));
  });
  readonly forgeOn = computed(() => !!this.buildings()['equipment_workshop']?.isUnlocked);
  readonly templeOn = computed(() => !!this.buildings()['ascension_shrine']?.isUnlocked);

  readonly plates = computed(() => {
    const st = this.buildings(), use = new Set(this.usable());
    return Object.values(SKY_PLOTS).map(p => {
      const def = BUILDING_BY_ID[p.id];
      const s = st[p.id];
      const locked = !s?.isUnlocked;
      return {
        id: p.id, name: def?.name ?? p.id, hit: p.hit, plate: p.plate, locked, usable: locked && use.has(p.id),
        future: !!def?.future, level: s?.progressionLevel ?? 0, requirement: def ? unlockFloorOf(def) : 0, icon: def?.actions[0]?.icon ?? 'lock',
      };
    });
  });

  /** camera: our own pan (screen px) — no native scrolling, so the parallax layers move in the very same frame as the
   *  world (native scroll moved the world on the compositor first and the layers a frame later → shaking / tearing) */
  readonly panX = signal(0);
  readonly panY = signal(0);
  private readonly vpW = signal(800);
  private readonly vpH = signal(450);
  constructor() {
    effect(() => {
      const f = this.focus();
      untracked(() => { if (f) this.panTo(f.x, f.y, true); });
    });
  }

  ngAfterViewInit(): void {
    this.preload.warmCity().then(() => this.fxAuto && this.probeFps());
    this.renderer = new SkyCanvasRenderer(src => this.preload.image(src), this.referenceLook());
    if (typeof requestAnimationFrame !== 'undefined') this.zone.runOutsideAngular(() => (this.raf = requestAnimationFrame(t => this.frame(t))));
    const el = this.vp().nativeElement;
    this.zone.runOutsideAngular(() => {
      this.resize = new ResizeObserver(() => this.zone.run(() => this.fit()));
      this.resize.observe(el);
      el.addEventListener('wheel', e => this.onWheel(e), { passive: false });
    });
    this.fit();
    this.panTo(SKY_NODES[SKY_SPAWN].x, SKY_NODES[SKY_SPAWN].y - 120, false);
    // start with the whole sky under the app bar (top of the world just below it)
    this.setPan(this.panX(), -this.topInset);
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.resize?.disconnect();
    cancelAnimationFrame(this.tween);
    cancelAnimationFrame(this.raf);
  }

  private fit(): void {
    const el = this.vp().nativeElement;
    const h = el.clientHeight || 540, w = el.clientWidth || 800;
    // the floating app bar covers the top of the screen: fit the city below it (the sky canvas still fills behind the bar)
    const top = typeof getComputedStyle === 'function' ? parseFloat(getComputedStyle(el).getPropertyValue('--ui-top')) || 0 : 0;
    const cx = (this.panX() + this.vpW() / 2) / this.k(), cy = (this.panY() + this.vpH() / 2) / this.k();
    const first = !this.fitted;
    this.fitted = true;
    this.vpW.set(w);
    this.vpH.set(h);
    this.topInset = Math.min(top, h * 0.3);
    const sceneHeight = (h - this.topInset) * (this.referenceLook() && w <= 720 ? .68 : 1);
    this.fitK.set(Math.max(sceneHeight / this.H, w / this.W));
    if (!first) this.panTo(cx, cy, false);
  }
  private topInset = 0;
  private fitted = false;

  private clampPan(x: number, y: number): [number, number] {
    const k = this.k();
    const y0 = -this.topInset;
    return [Math.max(0, Math.min(this.W * k - this.vpW(), x)), Math.max(y0, Math.min(Math.max(y0, this.H * k - this.vpH()), y))];
  }
  private setPan(x: number, y: number): void {
    const [cx, cy] = this.clampPan(x, y);
    this.panX.set(cx);
    this.panY.set(cy);
  }

  private tween = 0;
  /** centre the camera on a world point */
  panTo(x: number, y: number, smooth: boolean): void {
    cancelAnimationFrame(this.tween);
    const [tx, ty] = this.clampPan(x * this.k() - this.vpW() / 2, y * this.k() - this.vpH() / 2);
    if (!smooth || typeof requestAnimationFrame === 'undefined') return this.setPan(tx, ty);
    const fx = this.panX(), fy = this.panY(), t0 = performance.now(), dur = 600;
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - t, 3);
      this.setPan(fx + (tx - fx) * e, fy + (ty - fy) * e);
      if (t < 1) this.tween = requestAnimationFrame(step);
    };
    this.tween = requestAnimationFrame(step);
  }

  /** zoom around the viewport centre (buttons, ctrl/pinch wheel) — only when SKY_ZOOM allows a range */
  setZoom(z: number): void {
    const nz = Math.max(SKY_ZOOM.min, Math.min(SKY_ZOOM.max, z));
    if (nz === this.zoom()) return;
    const k0 = this.k();
    const cx = (this.panX() + this.vpW() / 2) / k0, cy = (this.panY() + this.vpH() / 2) / k0;
    this.zoom.set(nz);
    this.panTo(cx, cy, false);
  }

  // ---------------------------------------------------------------- drag (mouse + touch) / wheel pan
  private drag: { id: number; x: number; y: number; px: number; py: number; moved: boolean } | null = null;
  suppressClick = false;

  onPointerDown(e: PointerEvent): void {
    if (this.drag || (e.pointerType === 'mouse' && e.button !== 0)) return;
    cancelAnimationFrame(this.tween);
    this.drag = { id: e.pointerId, x: e.clientX, y: e.clientY, px: this.panX(), py: this.panY(), moved: false };
  }
  @HostListener('window:pointermove', ['$event'])
  onPointerMove(e: PointerEvent): void {
    const d = this.drag;
    if (!d) {
      const el = this.vp().nativeElement;
      if (!this.still && !this.lite() && e.pointerType === 'mouse' && e.target instanceof Node && el.contains(e.target)) {
        const r = el.getBoundingClientRect();
        this.depthTarget = Math.max(-6, Math.min(6, ((e.clientX - r.left) / r.width - 0.5) * 12));
      } else this.depthTarget = 0;
      return;
    }
    this.depthTarget = 0;
    if (e.pointerId !== d.id) return;
    const dx = e.clientX - d.x, dy = e.clientY - d.y;
    if (!d.moved && Math.hypot(dx, dy) > 6) d.moved = true;
    if (d.moved) this.setPan(d.px - dx, d.py - dy);
  }
  @HostListener('window:pointerup', ['$event'])
  @HostListener('window:pointercancel', ['$event'])
  onPointerUp(e?: PointerEvent): void {
    if (!this.drag || (e && e.pointerId !== this.drag.id)) return;
    if (this.drag.moved) {
      this.suppressClick = true;
      setTimeout(() => (this.suppressClick = false));
    }
    this.drag = null;
  }
  /** wheel / trackpad pans the city (ctrl / pinch = zoom when enabled); the page itself never scrolls */
  onWheel(e: WheelEvent): void {
    e.preventDefault();
    this.zone.run(() => {
      if (e.ctrlKey) return this.setZoom(this.zoom() * (e.deltaY < 0 ? 1.12 : 1 / 1.12));
      const dx = e.shiftKey && !e.deltaX ? e.deltaY : e.deltaX;
      const dy = e.shiftKey && !e.deltaX ? 0 : e.deltaY;
      cancelAnimationFrame(this.tween);
      this.setPan(this.panX() + dx, this.panY() + dy);
    });
  }
  tapBuilding(id: string): void {
    if (!this.suppressClick) this.buildingTap.emit(id);
  }
  tapHero(uid: number): void {
    if (!this.suppressClick) this.heroTap.emit(uid);
  }
  /** a slow machine (median frame > 30 ms over ~2 s, measured 3.5 s after the map is up) switches to lite effects by itself */
  private probeFps(): void {
    if (typeof requestAnimationFrame === 'undefined') return;
    this.zone.runOutsideAngular(() => {
      const t: number[] = [];
      let last = 0;
      const f = (now: number) => {
        if (last) t.push(now - last);
        last = now;
        if (t.length < 120 && !this.destroyed) return void requestAnimationFrame(f);
        t.sort((a, b) => a - b);
        if (!this.destroyed && this.fxAuto && t.length >= 60 && t[t.length >> 1] > 30) this.zone.run(() => this.lite.set(true));
      };
      // measure after the start-up work (decode, first canvas draws, hero sprites) has settled
      setTimeout(() => requestAnimationFrame(f), 3500);
    });
  }
  private destroyed = false;

  toggleFx(): void {
    this.fxAuto = false;
    this.lite.update(v => !v);
    writeFxPref(this.lite() ? 'lite' : 'full');
  }

  /** depth by ground line (z-index must be an integer or the browser drops it) */
  zi(y: number): number {
    return 10 + Math.round(y);
  }
  // ---------------------------------------------------------------- render loop (one rAF drives everything that moves)
  private renderer?: SkyCanvasRenderer;
  private raf = 0;
  private t0 = 0;
  private lastT = 0;
  /** focus zoom (1 → 1.15) and the world point it zooms around, eased toward the `focus` input */
  private fz = 1;
  private fp = { x: 0, y: 0 };
  private lastWorldTf = '';
  private lastBobTf = '';
  readonly still = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  private depthTarget = 0;
  private depth = 0;

  private frame(now: number): void {
    if (this.destroyed) return;
    this.raf = requestAnimationFrame(x => this.frame(x));
    if (!this.t0) this.t0 = now;
    const dt = Math.min(0.1, Math.max(0, (now - (this.lastT || now)) / 1000));
    this.lastT = now;
    const t = this.still ? 0 : (now - this.t0) / 1000;

    // camera: pan (signals, set by drag / wheel / panTo) × fit scale × eased focus zoom
    const f = this.focus();
    if (f) this.fp = f;
    this.fz += ((f ? 1.15 : 1) - this.fz) * (1 - Math.exp(-dt * 4.5));
    if (Math.abs(this.fz - (f ? 1.15 : 1)) < 0.0005) this.fz = f ? 1.15 : 1;
    const k = this.k(), s = k * this.fz;
    const tx = -this.panX() + k * this.fp.x * (1 - this.fz), ty = -this.panY() + k * this.fp.y * (1 - this.fz);
    const worldTf = `translate3d(${tx.toFixed(2)}px, ${ty.toFixed(2)}px, 0) scale(${s.toFixed(5)})`;
    if (worldTf !== this.lastWorldTf) {
      this.lastWorldTf = worldTf;
      this.worldEl().nativeElement.style.transform = worldTf;
      this.uiWorldEl().nativeElement.style.transform = worldTf;
      // Keep labels at readable CSS-pixel size across map fit/focus scales.
      this.uiWorldEl().nativeElement.style.setProperty('--label-scale', (1 / s).toFixed(5));
    }
    // the island bobs as one piece (driven here so the canvas FX on it stay glued)
    const bob = this.still ? 0 : -7 * (1 - Math.cos((2 * Math.PI * t) / 9));
    const bobTf = `translate3d(0, ${bob.toFixed(2)}px, 0)`;
    if (bobTf !== this.lastBobTf) {
      this.lastBobTf = bobTf;
      this.isleEl().nativeElement.style.transform = bobTf;
      this.isleUiEl().nativeElement.style.transform = bobTf;
    }
    if (!this.ready() || !this.renderer) return;
    const back = this.backCv().nativeElement, front = this.frontCv().nativeElement;
    const vw = this.vpW(), vh = this.vpH();
    const dpr = this.lite() ? 1 : Math.min(2, (typeof devicePixelRatio === 'number' ? devicePixelRatio : 1) || 1);
    const cw = Math.round(vw * dpr), ch = Math.round(vh * dpr);
    for (const c of [back, front]) if (c.width !== cw || c.height !== ch) { c.width = cw; c.height = ch; }
    const cam: SkyCamera = { s, tx, ty, panX: this.panX(), k, vw, vh, dpr };
    const bctx = back.getContext('2d'), fctx = front.getContext('2d');
    if (!bctx || !fctx) return;
    this.depth += ((this.still || this.lite() ? 0 : this.depthTarget) - this.depth) * (1 - Math.exp(-dt * 5));
    // Background only: world art, front effects, hit targets and labels remain aligned.
    this.renderer.drawBack(bctx, { ...cam, panX: cam.panX + this.depth }, t, this.lite());
    this.renderer.drawFront(fctx, cam, t, bob, this.lite());
  }
}

const FX_KEY = 'projectgm-city-fx';
/** per-device effects preference (browser storage can be missing / blocked — then it is just not remembered) */
function readFxPref(): 'lite' | 'full' | null {
  try {
    const v = localStorage.getItem(FX_KEY);
    return v === 'lite' || v === 'full' ? v : null;
  } catch {
    return null;
  }
}
function writeFxPref(v: 'lite' | 'full'): void {
  try {
    localStorage.setItem(FX_KEY, v);
  } catch {
    /* not remembered */
  }
}
