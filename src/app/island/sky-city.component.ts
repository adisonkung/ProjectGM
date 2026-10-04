import {
  AfterViewInit, ChangeDetectionStrategy, Component, computed, effect, ElementRef, HostListener, inject, input, NgZone, OnDestroy, output, signal, untracked, viewChild,
} from '@angular/core';
import { BUILDING_BY_ID } from '../core/data/island-layout';
import { SKY_BASE, SKY_FX, SKY_HERO_SCALE, SKY_LAYERS, SKY_MASKS, SKY_NODES, SKY_PAD, SKY_PLOTS, SKY_SPAWN, SKY_SPIRE, SKY_WORLD } from '../core/data/sky-city';
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
  readonly heroScale = SKY_HERO_SCALE;
  readonly vp = viewChild.required<ElementRef<HTMLElement>>('vp');
  private readonly zone = inject(NgZone);
  private resize?: ResizeObserver;

  readonly k = signal(0.4);
  readonly scrollX = signal(0);

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
    const z = 1.3;
    return `translate(${k * f.x * (1 - z)}px, ${k * f.y * (1 - z)}px) scale(${k * z})`;
  });

  constructor() {
    effect(() => {
      const f = this.focus();
      untracked(() => { if (f) this.panTo(f.x, true); });
    });
  }

  ngAfterViewInit(): void {
    const el = this.vp().nativeElement;
    this.zone.runOutsideAngular(() => {
      this.resize = new ResizeObserver(() => this.zone.run(() => this.fit()));
      this.resize.observe(el);
      el.addEventListener('scroll', () => this.zone.run(() => this.scrollX.set(el.scrollLeft / this.k())), { passive: true });
    });
    this.fit();
    this.panTo(SKY_NODES[SKY_SPAWN].x, false);
  }

  ngOnDestroy(): void {
    this.resize?.disconnect();
  }

  private fit(): void {
    const el = this.vp().nativeElement;
    const h = el.clientHeight || 540;
    this.k.set(Math.max(h / this.H, (el.clientWidth || 0) / this.W));
  }

  panTo(x: number, smooth: boolean): void {
    const el = this.vp()?.nativeElement;
    if (!el) return;
    const left = Math.max(0, x * this.k() - el.clientWidth / 2);
    if (smooth && el.scrollTo) el.scrollTo({ left, behavior: 'smooth' });
    else el.scrollLeft = left;
  }

  // ---------------------------------------------------------------- drag / wheel pan (touch = native scroll)
  private drag: { x: number; left: number; moved: boolean } | null = null;
  suppressClick = false;

  onPointerDown(e: PointerEvent): void {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    this.drag = { x: e.clientX, left: this.vp().nativeElement.scrollLeft, moved: false };
  }
  @HostListener('window:pointermove', ['$event'])
  onPointerMove(e: PointerEvent): void {
    if (!this.drag) return;
    const dx = e.clientX - this.drag.x;
    if (Math.abs(dx) > 5) this.drag.moved = true;
    if (this.drag.moved) this.vp().nativeElement.scrollLeft = this.drag.left - dx;
  }
  @HostListener('window:pointerup')
  onPointerUp(): void {
    if (this.drag?.moved) {
      this.suppressClick = true;
      setTimeout(() => (this.suppressClick = false));
    }
    this.drag = null;
  }
  onWheel(e: WheelEvent): void {
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      this.vp().nativeElement.scrollLeft += e.deltaY;
      e.preventDefault();
    }
  }
  tapBuilding(id: string): void {
    if (!this.suppressClick) this.buildingTap.emit(id);
  }
  tapHero(uid: number): void {
    if (!this.suppressClick) this.heroTap.emit(uid);
  }
  /** parallax: a layer at depth p (0 = glued to the sky, 1 = moves with the island) */
  par(p: number): string {
    return `translateX(${this.scrollX() * (1 - p)}px)`;
  }
}
