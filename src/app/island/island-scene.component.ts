import {
  AfterViewInit, ChangeDetectionStrategy, Component, computed, effect, ElementRef, HostListener, inject, input, NgZone, OnDestroy, output, signal, untracked, viewChild,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { resolveAsset } from '../core/data/island-themes';
import { ISLAND_CAMERA, ISLAND_WORLD, LAYOUT, PIXEL_SCALE } from '../core/data/island-layout';
import { IslandBuildingState, IslandThemeDefinition, Vec2 } from '../core/models/island';
import { unlockFloorOf } from '../core/rules/island';
import { PlaceholderBuildingRendererComponent } from './building-renderers';
import { IslandHeroComponent, IslandHeroView } from './island-hero.component';
import { buildingDraw, decorDraw, lightsDraw, place, SpriteVM } from './island-view-model';

/**
 * Island SCENE (HTML layers, world units scaled to the viewport height, horizontal pan):
 * background (sky / parallax mountains + far forest / clouds / floating rocks) → ground → water → roads →
 * depth-sorted buildings · decorations · heroes → foreground → lighting → tap areas / name plates.
 * Draws any island from (theme, building states, heroes) — the owner's today, a visitor's later (`readonly`).
 */
@Component({
  selector: 'app-island-scene',
  imports: [IslandHeroComponent, PlaceholderBuildingRendererComponent, NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './island-scene.component.html',
  styleUrl: './island-scene.component.scss',
})
export class IslandSceneComponent implements AfterViewInit, OnDestroy {
  readonly theme = input.required<IslandThemeDefinition>();
  readonly buildings = input.required<Record<string, IslandBuildingState>>();
  /** ruins whose feature is already open (tap works; the plate says so instead of a lock) */
  readonly usable = input<string[]>([]);
  readonly skinOverrides = input<Record<string, string>>({});
  readonly heroes = input<IslandHeroView[]>([]);
  /** camera focus (event presentation) — null = free pan */
  readonly focus = input<Vec2 | null>(null);
  readonly fxBuilding = input<string | null>(null);
  readonly selected = input<string | null>(null);
  readonly readonly = input(false);
  readonly buildingTap = output<string>();
  readonly heroTap = output<number>();

  readonly W = ISLAND_WORLD.w;
  readonly H = ISLAND_WORLD.h;
  readonly vp = viewChild.required<ElementRef<HTMLElement>>('vp');
  private readonly zone = inject(NgZone);
  private resize?: ResizeObserver;

  /** world → screen scale (fit the viewport height) */
  readonly k = signal(0.5);
  /** horizontal scroll in world units (drives parallax) */
  readonly scrollX = signal(0);

  // ---------------------------------------------------------------- static layers (theme)
  readonly sky = computed(() => this.full(this.theme().backgroundSet.sky));
  readonly ground = computed(() => this.full(this.theme().terrainSet.ground));
  readonly roads = computed(() => this.full(this.theme().roadSet.layer));
  readonly far = computed(() => this.theme().backgroundSet.far.map(f => {
    const a = resolveAsset(this.theme(), f.slot);
    return a ? { key: f.slot, src: a.src, x: -60, y: f.y, w: a.w * PIXEL_SCALE, h: a.h * PIXEL_SCALE, p: f.parallax } : null;
  }).filter(x => !!x));
  readonly mist = computed(() => {
    const s = this.theme().backgroundSet.mist;
    const a = s ? resolveAsset(this.theme(), s) : null;
    return a ? { src: a.src, w: a.w * PIXEL_SCALE, h: a.h * PIXEL_SCALE } : null;
  });
  readonly clouds = computed(() => this.theme().backgroundSet.clouds.flatMap((slot, i) => {
    const a = resolveAsset(this.theme(), slot);
    if (!a) return [];
    return [0, 1].map(j => ({ key: `${slot}:${j}`, src: a.src, x: 180 + i * 640 + j * 1100, y: 40 + ((i + j) % 3) * 46, w: a.w * PIXEL_SCALE, h: a.h * PIXEL_SCALE, d: 70 + i * 23 + j * 17 }));
  }));
  readonly rocks = computed(() => this.theme().backgroundSet.floatingRocks.map((slot, i) => {
    const a = resolveAsset(this.theme(), slot);
    return a ? { key: slot, src: a.src, x: [120, 2150][i % 2], y: [150, 70][i % 2], w: a.w * PIXEL_SCALE, h: a.h * PIXEL_SCALE } : null;
  }).filter(x => !!x));
  readonly water = computed(() => this.anim(this.theme().terrainSet.water, 0, 0, 'water'));
  readonly waterfall = computed(() => {
    const pts = LAYOUT.stream.points;
    const [x, y] = pts[pts.length - 1];
    return this.anim(this.theme().terrainSet.waterfall, x, y - 6, 'waterfall');
  });
  readonly bridge = computed(() => {
    const slot = this.theme().roadSet.bridge;
    const a = slot ? resolveAsset(this.theme(), slot) : null;
    const nodes = Object.fromEntries(LAYOUT.nodes.map(n => [n.id, n]));
    const bridges = LAYOUT.roads.flatMap(r => r.bridges ?? []);
    return a ? bridges.map(([p, q], i) => ({ key: `bridge${i}`, src: a.src, ...place(a, (nodes[p].x + nodes[q].x) / 2, (nodes[p].y + nodes[q].y) / 2) })) : [];
  });
  readonly fireflies = computed(() => {
    const slot = this.theme().ambientFxSet.fireflies;
    const a = slot ? resolveAsset(this.theme(), slot) : null;
    const spots = LAYOUT.ambient ?? [];
    return a ? spots.map((s, i) => this.sheet(`ff${i}`, a, s.x, s.y, i * 0.7)) : [];
  });
  readonly branches = computed(() => (LAYOUT.foreground?.branches ?? []).map(b => {
    const a = resolveAsset(this.theme(), b.slot);
    return a ? { key: b.slot, src: a.src, x: b.x, y: b.y, w: a.w * PIXEL_SCALE, h: a.h * PIXEL_SCALE } : null;
  }).filter(x => !!x));

  /** weather overlay (SNOW …): seamless tiles scrolled by CSS — cosmetic only */
  readonly weather = computed(() => (this.theme().ambientFxSet.weather ?? []).map((wl, i) => {
    const a = resolveAsset(this.theme(), wl.slot);
    return a ? { key: `${wl.slot}:${i}`, src: a.src, w: a.w * PIXEL_SCALE, h: a.h * PIXEL_SCALE, sec: wl.seconds, dx: wl.dx * a.w * PIXEL_SCALE, dy: wl.dy * a.h * PIXEL_SCALE, opacity: wl.opacity ?? 1 } : null;
  }).filter(x => !!x));

  // ---------------------------------------------------------------- dynamic (building states)
  readonly draw = computed(() => buildingDraw(this.theme(), this.buildings(), this.skinOverrides(), unlockFloorOf));
  readonly decor = computed(() => decorDraw(this.theme()));
  readonly sprites = computed<SpriteVM[]>(() => [...this.draw().sprites, ...this.decor()]);
  readonly lights = computed(() => lightsDraw(this.theme(), this.buildings()));

  /** world transform: scale to the viewport, optional zoom on the focus point */
  readonly transform = computed(() => {
    const k = this.k(), f = this.focus();
    if (!f) return `scale(${k})`;
    const z = 1.35;
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
    this.panTo(ISLAND_CAMERA.spawnX, false);
  }

  ngOnDestroy(): void {
    this.resize?.disconnect();
  }

  private fit(): void {
    const el = this.vp().nativeElement;
    const h = el.clientHeight || 540;
    const k = Math.max(h / this.H, (el.clientWidth || 0) / this.W);
    this.k.set(k);
  }

  /** centre the camera on a world x */
  panTo(x: number, smooth: boolean): void {
    const el = this.vp()?.nativeElement;
    if (!el) return;
    const left = Math.max(0, x * this.k() - el.clientWidth / 2);
    if (smooth && el.scrollTo) el.scrollTo({ left, behavior: 'smooth' });
    else el.scrollLeft = left;
  }

  // ---------------------------------------------------------------- mouse drag / wheel pan (touch uses native scrolling)
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

  // ---------------------------------------------------------------- helpers
  private full(slot: string) {
    const a = resolveAsset(this.theme(), slot);
    return a ? { src: a.src, w: a.w * PIXEL_SCALE, h: a.h * PIXEL_SCALE } : null;
  }
  private sheet(key: string, a: NonNullable<ReturnType<typeof resolveAsset>>, x: number, y: number, delay = 0): SpriteVM {
    return { key, src: a.src, ...place(a, x, y), z: 0, frames: a.frames ?? 1, duration: (a.frames ?? 1) / (a.fps ?? 8), rare: a.loop === 'rare', delay };
  }
  private anim(slot: string | undefined, x: number, y: number, key: string): SpriteVM | null {
    const a = slot ? resolveAsset(this.theme(), slot) : null;
    return a ? this.sheet(key, a, x, y) : null;
  }
  trackSprite = (_: number, s: SpriteVM) => s.key;
}
