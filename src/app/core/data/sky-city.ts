import LAYOUT_JSON from './island/sky-city-layout.json';
import { SKY_CITY_ART } from './sky-city.generated';

/**
 * Sky City — the image-based home island (the player's default map; the procedural forest island stays selectable
 * as "classic"). Art comes from the user's AI paintings, cut by tools/island/sky_city/build.py:
 *   base.webp = city with EMPTY plots · b_<buildingId>.webp = each landmark (shown once unlocked, rises on reveal) ·
 *   spire.webp = upper spire (tinted per tower stage) · m_*.png = masks for code FX (waterfalls, crystals, water).
 * Layout (hit areas, plates, camera focus, hero walking graph, FX anchors): island/sky-city-layout.json
 * (preview: python3 tools/island/sky_city/preview_layout.py).
 */

type XY = [number, number];
interface LayoutJson {
  world: { w: number; h: number };
  spawn: string;
  plots: Record<string, { hit: [number, number, number, number]; plate: XY; focus: XY; front: string }>;
  nodes: Record<string, XY>;
  edges: [string, string][];
  fx: {
    spireTip: XY; spireRing: [number, number, number, number]; spireAura: XY; spireBox: [number, number, number, number];
    fountains: XY[]; forgeSmoke: XY[]; forgeFire: XY; templeHalo: XY;
  };
}
const L = LAYOUT_JSON as unknown as LayoutJson;

export const SKY_CITY_DIR = 'island/sky_city';
/** world = art pixels + sky margin above (HUD) and below (cloud sea) */
export const SKY_PAD = { top: 110, bottom: 150 };
export const SKY_WORLD = { w: L.world.w, h: L.world.h + SKY_PAD.top + SKY_PAD.bottom };

export interface SkyArtLayer { src: string; x: number; y: number; w: number; h: number }
export interface SkyCityPlot {
  id: string;
  hit: { x: number; y: number; w: number; h: number };
  plate: { x: number; y: number };
  focus: { x: number; y: number };
  front: string;
  /** landmark art (absent for the tower: it is part of the base art) */
  art: (SkyArtLayer & { z: number }) | null;
}

const y = (v: number) => v + SKY_PAD.top;
const art = SKY_CITY_ART.buildings as unknown as Record<string, SkyArtLayer & { box: number[] }>;

export const SKY_PLOTS: Record<string, SkyCityPlot> = Object.fromEntries(Object.entries(L.plots).map(([id, p]) => {
  const a = art[id];
  return [id, {
    id,
    hit: { x: p.hit[0], y: y(p.hit[1]), w: p.hit[2], h: p.hit[3] },
    plate: { x: p.plate[0], y: y(p.plate[1]) },
    focus: { x: p.focus[0], y: y(p.focus[1]) },
    front: p.front,
    // depth = the landmark's ground line (bottom of its plot box)
    art: a ? { src: a.src, x: a.x, y: y(a.y), w: a.w, h: a.h, z: y(a.box[3]) } : null,
  }];
}));

export const SKY_BASE: SkyArtLayer = { src: `${SKY_CITY_DIR}/base.webp`, x: 0, y: y(0), w: L.world.w, h: L.world.h };
export const SKY_SPIRE: SkyArtLayer = (() => {
  const s = (SKY_CITY_ART as unknown as { spire: SkyArtLayer }).spire;
  return { ...s, y: y(s.y) };
})();

export const SKY_NODES: Record<string, { x: number; y: number }> = Object.fromEntries(
  Object.entries(L.nodes).map(([id, [nx, ny]]) => [id, { x: nx, y: y(ny) }]),
);
export const SKY_EDGES = L.edges;
export const SKY_SPAWN = L.spawn;

const pt = ([px, py]: XY) => ({ x: px, y: y(py) });
export const SKY_FX = {
  spireTip: pt(L.fx.spireTip),
  spireRing: { x: L.fx.spireRing[0], y: y(L.fx.spireRing[1]), rx: L.fx.spireRing[2], ry: L.fx.spireRing[3] },
  spireAura: pt(L.fx.spireAura),
  fountains: L.fx.fountains.map(pt),
  forgeSmoke: L.fx.forgeSmoke.map(pt),
  forgeFire: pt(L.fx.forgeFire),
  templeHalo: pt(L.fx.templeHalo),
};

/** masks for code FX (half resolution, cropped to where the effect is; world px box) */
export interface SkyMask { src: string; x: number; y: number; w: number; h: number }
export const SKY_MASKS: Record<'falls' | 'crystals' | 'water', SkyMask> = (() => {
  const m = (SKY_CITY_ART as unknown as { masks: Record<'falls' | 'crystals' | 'water', SkyMask> }).masks;
  const at = (k: keyof typeof m) => ({ ...m[k], y: y(m[k].y) });
  return { falls: at('falls'), crystals: at('crystals'), water: at('water') };
})();
/** painted sky layers (user art via tools/island/sky_city/bg_layers.py); clouds/wisps/far = procedural fallbacks */
export const SKY_LAYERS = {
  sky: `${SKY_CITY_DIR}/bg_sky_dusk.webp`, bank: `${SKY_CITY_DIR}/bg_cloud_bank.webp`, sea: `${SKY_CITY_DIR}/bg_cloud_sea.webp`,
  mist: `${SKY_CITY_DIR}/fg_cloud_wisps.webp`, whale: `${SKY_CITY_DIR}/sprite_sky_whale.webp`,
  farIslands: `${SKY_CITY_DIR}/bg_far_islands.webp`, rays: `${SKY_CITY_DIR}/bg_god_rays.webp`, birds: `${SKY_CITY_DIR}/sheet_birds.webp`,
  dragonBody: `${SKY_CITY_DIR}/dragon_body.webp`,
  whaleBody: `${SKY_CITY_DIR}/whale_body.webp`, whaleTail: `${SKY_CITY_DIR}/whale_tail.webp`, whaleFinFront: `${SKY_CITY_DIR}/whale_fin_front.webp`,
  whaleFinBack: `${SKY_CITY_DIR}/whale_fin_back.webp`, whaleShards: `${SKY_CITY_DIR}/whale_shards.webp`, dragonWing: `${SKY_CITY_DIR}/dragon_wing.webp`,
  clouds: `${SKY_CITY_DIR}/clouds.webp`, wisps: `${SKY_CITY_DIR}/wisps.webp`, far: `${SKY_CITY_DIR}/far_islands.webp`,
};
/** island heroes are drawn smaller here (the city is painted at a smaller scale than the battle sprites) */
export const SKY_HERO_SCALE = 0.62;
/** camera zoom over fit-to-height. Fixed at 1: the whole city fills a big screen (zooming in made the GPU
 *  re-rasterize the huge layers at 2–3× and stutter); kept as a knob — min < max shows the +/− buttons again */
export const SKY_ZOOM = { min: 1, start: 1, max: 1 };

/** every image the city paints (preloaded + decoded at app start by PreloadService) */
export const SKY_CITY_ASSETS: readonly string[] = [
  SKY_BASE.src, SKY_SPIRE.src,
  ...Object.values(SKY_PLOTS).flatMap(p => (p.art ? [p.art.src] : [])),
  ...Object.values(SKY_MASKS).map(m => m.src),
  ...(['sky', 'farIslands', 'bank', 'sea', 'mist', 'rays', 'birds', 'dragonBody', 'dragonWing',
    'whaleBody', 'whaleTail', 'whaleFinFront', 'whaleFinBack', 'whaleShards'] as const).map(k => SKY_LAYERS[k]),
];
