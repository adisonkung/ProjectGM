import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { resolveBuildingSkin } from '../core/data/island-themes';
import { DECOR_POINTS, ISLAND_BUILDINGS, ISLAND_SHAPE, ISLAND_VIEW, ISLAND_WORLD, NAV_BY_ID, NAV_EDGES, PLOT_BY_ID } from '../core/data/island-layout';
import { IslandBuildingDefinition, IslandBuildingState, IslandThemeDefinition, Rect, Vec2 } from '../core/models/island';
import { unlockFloorOf } from '../core/rules/island';
import { BuildingVisualComponent } from './building-renderers';
import { IslandHeroComponent, IslandHeroView } from './island-hero.component';

/** coastline drawn slightly outside the walkable mask, with a deterministic wobble (decoration only) */
function coastPath(grow = 1.035, wobble = 10, dy = 0): string {
  const { cx, cy, rx, ry, power } = ISLAND_SHAPE;
  const pts: string[] = [];
  const N = 96;
  for (let i = 0; i < N; i++) {
    const t = (i / N) * Math.PI * 2;
    const c = Math.cos(t), s = Math.sin(t);
    const k = grow + (Math.sin(t * 7) * 0.5 + Math.sin(t * 13 + 1) * 0.3) * (wobble / Math.max(rx, ry));
    const x = cx + Math.sign(c) * Math.abs(c) ** (2 / power) * rx * k;
    const y = cy + Math.sign(s) * Math.abs(s) ** (2 / power) * ry * k + dy;
    pts.push(`${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`);
  }
  return pts.join(' ') + ' Z';
}
const COAST = coastPath();
const CLIFF = coastPath(1.035, 10, 22);
/** roads = nav edges between path / social / front nodes (idle spots are trodden grass, not roads) */
const ROADS = NAV_EDGES.filter(([a, b]) => NAV_BY_ID[a].kind !== 'IDLE' && NAV_BY_ID[b].kind !== 'IDLE')
  .map(([a, b]) => `M${NAV_BY_ID[a].pos.x} ${NAV_BY_ID[a].pos.y} L${NAV_BY_ID[b].pos.x} ${NAV_BY_ID[b].pos.y}`).join(' ');
const FIREFLIES = Array.from({ length: 14 }, (_, i) => ({ x: 60 + ((i * 137) % 480), y: 120 + ((i * 263) % 700), d: 3 + (i % 5), delay: (i * 0.7) % 4 }));

type Drawable =
  | { kind: 'B'; y: number; def: IslandBuildingDefinition; state: IslandBuildingState; bounds: Rect }
  | { kind: 'H'; y: number; hero: IslandHeroView };

/**
 * Island SCENE — draws any island from (theme, building states, heroes). Same component for the owner and, later, a
 * visitor (`readonly`). Layout / collision come from island-layout.ts; looks come from the resolved skins.
 */
@Component({
  selector: 'app-island-scene',
  imports: [BuildingVisualComponent, IslandHeroComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './island-scene.component.html',
  styleUrl: './island-scene.component.scss',
})
export class IslandSceneComponent {
  readonly theme = input.required<IslandThemeDefinition>();
  readonly buildings = input.required<Record<string, IslandBuildingState>>();
  readonly skinOverrides = input<Record<string, string>>({});
  readonly heroes = input<IslandHeroView[]>([]);
  /** camera focus (event presentation) — null = whole island */
  readonly focus = input<Vec2 | null>(null);
  /** building currently playing its construction / upgrade FX */
  readonly fxBuilding = input<string | null>(null);
  readonly selected = input<string | null>(null);
  readonly readonly = input(false);
  readonly buildingTap = output<string>();
  readonly heroTap = output<number>();

  readonly world = ISLAND_WORLD;
  readonly view = ISLAND_VIEW;
  readonly coast = COAST;
  readonly cliff = CLIFF;
  readonly roads = ROADS;
  readonly fireflies = FIREFLIES;
  readonly plaza = NAV_BY_ID['plaza'].pos;
  readonly homeSpot = NAV_BY_ID['home'].pos;
  readonly plots = Object.values(PLOT_BY_ID);

  readonly terrain = computed(() => {
    const t = this.theme().terrainAsset;
    return t.kind === 'PLACEHOLDER' ? t : { ground: '#2f4a2c', cliff: '#3b2e25', path: '#7a6a4e', plaza: '#6d6452', plot: '#3c5236' };
  });
  readonly sky = computed(() => {
    const b = this.theme().backgroundAsset;
    return b.kind === 'PLACEHOLDER' ? b : { skyTop: '#130f24', skyBottom: '#1f2d3a', water: '#10263a' };
  });
  readonly trees = computed(() => {
    const v = this.theme().vegetationSet;
    const colors = v.kind === 'PLACEHOLDER' ? v.colors : ['#2d6a3a'];
    return DECOR_POINTS.map((p, i) => ({ ...p, r: 13 + (i % 3) * 4, c: colors[i % colors.length] }));
  });

  /** buildings + heroes sorted by their ground line (painter's order) */
  readonly drawables = computed<Drawable[]>(() => {
    const st = this.buildings();
    const out: Drawable[] = ISLAND_BUILDINGS.map(def => {
      const bounds = PLOT_BY_ID[def.plotId].buildingBounds;
      return { kind: 'B' as const, y: bounds.y + bounds.h, def, state: st[def.id], bounds };
    });
    for (const h of this.heroes()) out.push({ kind: 'H', y: h.y, hero: h });
    return out.sort((a, b) => a.y - b.y);
  });

  skinFor(id: string) {
    return resolveBuildingSkin(id, this.theme(), this.skinOverrides());
  }
  requirement(def: IslandBuildingDefinition) {
    return `ชั้น ${unlockFloorOf(def)}`;
  }
  /** CSS camera: zoom ×1.6 around the focus point */
  readonly camera = computed(() => {
    const f = this.focus();
    if (!f) return 'translate(0px, 0px) scale(1)';
    const s = 1.6, v = this.view;
    const cx = v.x + v.w / 2, cy = v.y + v.h / 2;
    const x = Math.max(v.x + v.w / (2 * s), Math.min(v.x + v.w - v.w / (2 * s), f.x));
    const y = Math.max(v.y + v.h / (2 * s), Math.min(v.y + v.h - v.h / (2 * s), f.y));
    return `translate(${cx - x * s}px, ${cy - y * s}px) scale(${s})`;
  });
  trackD = (_: number, d: Drawable) => (d.kind === 'B' ? 'b:' + d.def.id : 'h:' + d.hero.uid);
}
