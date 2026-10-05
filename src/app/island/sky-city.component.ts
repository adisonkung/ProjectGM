import {
  AfterViewInit, ChangeDetectionStrategy, Component, computed, effect, ElementRef, HostListener, inject, input, NgZone, OnDestroy, output, signal, untracked, viewChild,
} from '@angular/core';
import { BUILDING_BY_ID } from '../core/data/island-layout';
import { PreloadService } from '../core/services/preload.service';
import { SKY_ZOOM, SKY_BASE, SKY_FX, SKY_HERO_SCALE, SKY_LAYERS, SKY_MASKS, SKY_NODES, SKY_PAD, SKY_PLOTS, SKY_SPAWN, SKY_SPIRE, SKY_WORLD } from '../core/data/sky-city';
import { IslandBuildingState, Vec2 } from '../core/models/island';
import { unlockFloorOf } from '../core/rules/island';
import { IslandHeroComponent, IslandHeroView } from './island-hero.component';

/** spire look per tower visual stage (0 sealed … 5 conquered) — CSS filter on the spire overlay + which FX run */
const SPIRE_STAGE = [
  { filter: 'brightness(.42) saturate(.2) contrast(1.15)', ring: false, glow: 0, aura: 0 },
  { filter: 'brightness(.6) saturate(.45) contrast(1.1)', ring: false, glow: 0.35, aura: 0 },
  { filter: 'brightness(.8) saturate(.75)', ring: true, glow: 0.55, aura: 0.25 },
  { filter: 'none', ring: true, glow: 0.8, aura: 0.45 },
  { filter: 'brightness(1.06) saturate(1.15)', ring: true, glow: 1, aura: 0.7 },
  { filter: 'brightness(1.12) saturate(1.2) sepia(.38) hue-rotate(-12deg)', ring: true, glow: 1, aura: 1 },
];

/** a few drifting motes / sparkles (deterministic layout) */
const MOTES = Array.from({ length: 26 }, (_, i) => ({
  x: (i * 977) % SKY_WORLD.w, y: 120 + ((i * 613) % (SKY_WORLD.h - 300)), s: 6 + (i % 4) * 3, d: 7 + (i % 5) * 2.3, delay: -(i * 1.37) % 9,
}));
const STARS = Array.from({ length: 34 }, (_, i) => ({ x: (i * 1237) % SKY_WORLD.w, y: 12 + ((i * 331) % 260), s: 2 + (i % 3), delay: -(i * 0.71) % 4 }));

/**
 * Sky City scene — the image-based home island (data: core/data/sky-city.ts).
 * Layers (world px): sky gradient · stars · far islands (parallax) · back cloud sea → [island group, gently bobbing:
 * base art (empty plots) · waterfall / water / crystal FX (masks) · spire overlay + rune ring + glow · landmarks
 * (unlocked) and heroes depth-sorted by ground line · forge smoke · fountains] → front wisps · god rays · motes →
 * tap areas + name plates. Same inputs / outputs as the classic IslandSceneComponent.
 */
@Component({
  selector: 'app-sky-city',
  imports: [IslandHeroComponent],
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
  readonly buildingTap = output<string>();
  readonly heroTap = output<number>();

  readonly W = SKY_WORLD.w;
  readonly H = SKY_WORLD.h;
  readonly PAD = SKY_PAD;
  readonly base = SKY_BASE;
  readonly spire = SKY_SPIRE;
  readonly fx = SKY_FX;
  readonly masks = SKY_MASKS;
  readonly layers = SKY_LAYERS;
  readonly motes = MOTES;
  readonly stars = STARS;
  /** a small V of birds (offsets inside the flock box, flap phase) */
  readonly flock = [
    { x: 0, y: 40, d: 0 }, { x: 90, y: 0, d: -0.21 }, { x: 95, y: 92, d: -0.4 }, { x: 185, y: -30, d: -0.13 }, { x: 200, y: 130, d: -0.55 },
  ];
  readonly heroScale = SKY_HERO_SCALE;
  readonly vp = viewChild.required<ElementRef<HTMLElement>>('vp');
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
  readonly scrollX = signal(0);
  readonly zoomMin = SKY_ZOOM.min;
  readonly zoomMax = SKY_ZOOM.max;

  readonly spireLook = computed(() => SPIRE_STAGE[Math.max(0, Math.min(5, this.towerStage()))]);
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
        future: !!def?.future, level: s?.progressionLevel ?? 0, requirement: def ? unlockFloorOf(def) : 0,
      };
    });
  });

  readonly transform = computed(() => {
    const k = this.k(), f = this.focus();
    if (!f) return `scale(${k})`;
    const z = 1.15;
    return `translate(${k * f.x * (1 - z)}px, ${k * f.y * (1 - z)}px) scale(${k * z})`;
  });

  constructor() {
    effect(() => {
      const f = this.focus();
      untracked(() => { if (f) this.panTo(f.x, f.y, true); });
    });
  }

  ngAfterViewInit(): void {
    this.preload.warmCity().then(() => this.fxAuto && this.probeFps());
    const el = this.vp().nativeElement;
    this.zone.runOutsideAngular(() => {
      this.resize = new ResizeObserver(() => this.zone.run(() => this.fit()));
      this.resize.observe(el);
      el.addEventListener('scroll', () => this.zone.run(() => this.scrollX.set(el.scrollLeft / this.k())), { passive: true });
    });
    this.fit();
    this.panTo(SKY_NODES[SKY_SPAWN].x, SKY_NODES[SKY_SPAWN].y - 120, false);
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.resize?.disconnect();
  }

  private fit(): void {
    const el = this.vp().nativeElement;
    const h = el.clientHeight || 540;
    this.fitK.set(Math.max(h / this.H, (el.clientWidth || 0) / this.W));
  }

  /** centre the camera on a world point */
  panTo(x: number, y: number, smooth: boolean): void {
    const el = this.vp()?.nativeElement;
    if (!el) return;
    const left = Math.max(0, x * this.k() - el.clientWidth / 2);
    const top = Math.max(0, y * this.k() - el.clientHeight / 2);
    if (smooth && el.scrollTo) el.scrollTo({ left, top, behavior: 'smooth' });
    else {
      el.scrollLeft = left;
      el.scrollTop = top;
    }
  }

  /** zoom around the viewport centre (buttons, ctrl/pinch wheel) */
  setZoom(z: number): void {
    const el = this.vp()?.nativeElement;
    const nz = Math.max(SKY_ZOOM.min, Math.min(SKY_ZOOM.max, z));
    if (!el || nz === this.zoom()) return;
    const k0 = this.k();
    const cx = (el.scrollLeft + el.clientWidth / 2) / k0, cy = (el.scrollTop + el.clientHeight / 2) / k0;
    this.zoom.set(nz);
    requestAnimationFrame(() => this.panTo(cx, cy, false));
  }

  // ---------------------------------------------------------------- drag / wheel pan (touch = native scroll)
  private drag: { x: number; y: number; left: number; top: number; moved: boolean } | null = null;
  suppressClick = false;

  onPointerDown(e: PointerEvent): void {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    const el = this.vp().nativeElement;
    this.drag = { x: e.clientX, y: e.clientY, left: el.scrollLeft, top: el.scrollTop, moved: false };
  }
  @HostListener('window:pointermove', ['$event'])
  onPointerMove(e: PointerEvent): void {
    if (!this.drag) return;
    const dx = e.clientX - this.drag.x, dy = e.clientY - this.drag.y;
    if (Math.hypot(dx, dy) > 5) this.drag.moved = true;
    if (this.drag.moved) {
      const el = this.vp().nativeElement;
      el.scrollLeft = this.drag.left - dx;
      el.scrollTop = this.drag.top - dy;
    }
  }
  @HostListener('window:pointerup')
  onPointerUp(): void {
    if (this.drag?.moved) {
      this.suppressClick = true;
      setTimeout(() => (this.suppressClick = false));
    }
    this.drag = null;
  }
  /** ctrl / pinch wheel = zoom; plain wheel scrolls the city in 2-D (native) */
  onWheel(e: WheelEvent): void {
    if (e.ctrlKey) {
      e.preventDefault();
      this.setZoom(this.zoom() * (e.deltaY < 0 ? 1.12 : 1 / 1.12));
    }
  }
  tapBuilding(id: string): void {
    if (!this.suppressClick) this.buildingTap.emit(id);
  }
  tapHero(uid: number): void {
    if (!this.suppressClick) this.heroTap.emit(uid);
  }
  /** a slow machine (median frame > 24 ms over ~1.5 s once the map is up) switches to lite effects by itself */
  private probeFps(): void {
    if (typeof requestAnimationFrame === 'undefined') return;
    this.zone.runOutsideAngular(() => {
      const t: number[] = [];
      let last = 0;
      const f = (now: number) => {
        if (last) t.push(now - last);
        last = now;
        if (t.length < 90 && !this.destroyed) return void requestAnimationFrame(f);
        t.sort((a, b) => a - b);
        if (!this.destroyed && this.fxAuto && t.length >= 30 && t[t.length >> 1] > 24) this.zone.run(() => this.lite.set(true));
      };
      setTimeout(() => requestAnimationFrame(f), 800);
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
  /** parallax: a layer at depth p (0 = glued to the sky, 1 = moves with the island) */
  par(p: number): string {
    return `translateX(${this.scrollX() * (1 - p)}px)`;
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
