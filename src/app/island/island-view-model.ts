import { layersFor, PLACEHOLDER_SKINS, resolveAsset, resolveBuildingSkin, skinStage } from '../core/data/island-themes';
import { ISLAND_BUILDINGS, ISLAND_DECOR, PIXEL_SCALE, PLOT_BY_ID } from '../core/data/island-layout';
import {
  BuildingSkin, IslandAsset, IslandBuildingDefinition, IslandBuildingState, IslandDecor, IslandThemeDefinition, LayerMotion, PlaceholderStageStyle, Rect, Vec2,
} from '../core/models/island';

/**
 * Pure "what to draw" for the island scene (no Angular): every sprite / sheet / light as a positioned box in WORLD units.
 * Positions come from the layout (plots, FX anchors, decor spots); looks come from the theme's resolved assets.
 */

export interface SpriteVM {
  key: string;
  src: string;
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;
  flip?: boolean;
  motion?: LayerMotion;
  glow?: boolean;
  /** sprite sheet */
  frames?: number;
  duration?: number;
  rare?: boolean;
  delay?: number;
}

export interface PlaceholderVM {
  key: string;
  building: string;
  bounds: Rect;
  style: PlaceholderStageStyle;
  z: number;
}

export interface BuildingHitVM {
  id: string;
  name: string;
  locked: boolean;
  future: boolean;
  level: number;
  requirement: number;
  /** tap area + name plate (world) */
  hit: Rect;
  plate: Vec2;
}

export interface LightVM {
  key: string;
  x: number;
  y: number;
  r: number;
  color: string;
  flicker?: boolean;
}

const Z_FAR = 0;
const Z_MID = 100000;
const Z_FORE = 900000;
const ROLE_Z: Record<string, number> = { SHADOW: 0, BACK: 1, BASE: 2, PART: 3, OVERLAY: 4, LIGHT: 5, FX: 6 };

/** world box of an asset whose anchor sits on (x, y) */
export function place(a: IslandAsset, x: number, y: number) {
  return { x: x - a.ax * PIXEL_SCALE, y: y - a.ay * PIXEL_SCALE, w: a.w * PIXEL_SCALE, h: a.h * PIXEL_SCALE };
}

function sprite(key: string, a: IslandAsset, x: number, y: number, z: number, extra: Partial<SpriteVM> = {}): SpriteVM {
  return {
    key, src: a.src, ...place(a, x, y), z,
    ...(a.frames && a.frames > 1 ? { frames: a.frames, duration: a.frames / (a.fps ?? 8), rare: a.loop === 'rare' } : {}),
    ...extra,
  };
}

export interface BuildingDraw {
  sprites: SpriteVM[];
  placeholders: PlaceholderVM[];
  hits: BuildingHitVM[];
}

/** all building layers for the current display states */
export function buildingDraw(theme: IslandThemeDefinition, states: Record<string, IslandBuildingState>, overrides: Record<string, string>, requirement: (b: IslandBuildingDefinition) => number): BuildingDraw {
  const sprites: SpriteVM[] = [];
  const placeholders: PlaceholderVM[] = [];
  const hits: BuildingHitVM[] = [];
  for (const def of ISLAND_BUILDINGS) {
    const plot = PLOT_BY_ID[def.plotId];
    const st = states[def.id];
    const stage = st?.visualStage ?? 0;
    const ax = plot.position.x + plot.visualOffset.x, ay = plot.position.y + plot.visualOffset.y;
    const zBase = Z_MID + plot.position.y * 10;
    const skin = resolveBuildingSkin(def.id, theme, overrides);
    const layers = layersFor(skin, stage, theme);
    let top = plot.buildingBounds.y, left = plot.buildingBounds.x, right = plot.buildingBounds.x + plot.buildingBounds.w;
    if (layers) {
      layers.forEach(({ layer, asset }, i) => {
        const anchor = layer.at ? plot.fxAnchors[layer.at] ?? { x: 0, y: 0 } : { x: 0, y: 0 };
        const x = (layer.at ? plot.position.x : ax) + anchor.x + (layer.dx ?? 0);
        const y = (layer.at ? plot.position.y : ay) + anchor.y + (layer.dy ?? 0);
        const s = sprite(`${def.id}:${i}:${layer.slot}`, asset, x, y, zBase + ROLE_Z[layer.role], {
          flip: layer.flip, motion: layer.motion, glow: layer.glow, delay: (i * 0.37) % 1.3,
        });
        sprites.push(s);
        if (layer.role === 'BASE' || layer.role === 'PART') {
          top = Math.min(top, s.y); left = Math.min(left, s.x); right = Math.max(right, s.x + s.w);
        }
      });
    } else if (skin.kind === 'SPRITE') {
      const sp = skinStage(skin.stages, stage);
      const b = plot.buildingBounds;
      const w = sp.w ?? b.w, h = sp.h ?? b.h;
      sprites.push({ key: `${def.id}:sprite`, src: sp.src, x: ax - w / 2, y: ay - h, w, h, z: zBase + 2 });
      top = Math.min(top, ay - h);
    } else {
      // placeholder fallback (no base art anywhere, or the skin itself is a placeholder)
      const ph = (skin.kind === 'PLACEHOLDER' ? skin : PLACEHOLDER_SKINS[def.id]) as Extract<BuildingSkin, { kind: 'PLACEHOLDER' }>;
      placeholders.push({ key: `${def.id}:ph`, building: def.id, bounds: plot.buildingBounds, style: skinStage(ph.stages, stage), z: zBase + 2 });
    }
    const locked = !st?.isUnlocked;
    hits.push({
      id: def.id, name: def.name, locked, future: !!def.future, level: st?.progressionLevel ?? 0, requirement: requirement(def),
      hit: { x: left, y: top, w: right - left, h: plot.position.y - top + 20 },
      plate: { x: plot.position.x + plot.visualOffset.x, y: plot.position.y + 14 },
    });
  }
  return { sprites, placeholders, hits };
}

/** decorations: layout spots × theme art (missing art → the spot is simply skipped) */
export function decorDraw(theme: IslandThemeDefinition, decor: IslandDecor[] = ISLAND_DECOR): SpriteVM[] {
  const out: SpriteVM[] = [];
  decor.forEach((d, i) => {
    const a = resolveAsset(theme, d.slot);
    if (!a) return;
    const z = d.layer === 'far' ? Z_FAR + d.y : d.layer === 'fore' ? Z_FORE + d.y : Z_MID + d.y * 10 + 1;
    out.push(sprite(`decor:${i}:${d.slot}`, a, d.x, d.y, z, { flip: d.flip, motion: d.sway ? 'sway' : undefined, delay: (i * 0.53) % 3 }));
    for (const [j, fx] of (theme.decorFx[d.slot] ?? []).entries()) {
      const fa = resolveAsset(theme, fx.slot);
      if (fa) out.push(sprite(`decor:${i}:fx${j}`, fa, d.x + fx.dx, d.y + fx.dy, z + 1, { glow: fx.glow, delay: (i * 0.29) % 1 }));
    }
  });
  return out;
}

/** localized light pools for the current states */
export function lightsDraw(theme: IslandThemeDefinition, states: Record<string, IslandBuildingState>, decor: IslandDecor[] = ISLAND_DECOR): LightVM[] {
  const out: LightVM[] = [];
  theme.lightingPreset.lights.forEach((l, i) => {
    const st = states[l.building];
    if (!st || !st.isUnlocked) return;
    if (l.minStage != null && st.visualStage < l.minStage) return;
    if (l.maxStage != null && st.visualStage > l.maxStage) return;
    const def = ISLAND_BUILDINGS.find(b => b.id === l.building)!;
    const plot = PLOT_BY_ID[def.plotId];
    const a = l.at ? plot.fxAnchors[l.at] ?? { x: 0, y: 0 } : { x: 0, y: 0 };
    out.push({ key: `L${i}`, x: plot.position.x + a.x + (l.dx ?? 0), y: plot.position.y + a.y + (l.dy ?? 0), r: l.radius, color: l.color, flicker: l.flicker });
  });
  decor.forEach((d, i) => {
    const l = theme.lightingPreset.decorLights[d.slot];
    if (l) out.push({ key: `D${i}`, x: d.x, y: d.y + (l.dy ?? 0), r: l.radius, color: l.color, flicker: l.flicker });
  });
  return out;
}
