import { HeroClass } from '../models/hero';
import { IslandBuildingDefinition, IslandDecor, IslandPlotDefinition, IslandRoad, NavEdge, NavNode, PlotId, Vec2 } from '../models/island';

import LAYOUT_JSON from './island/default-layout.json';

/** shape of `island/default-layout.json` */
export interface IslandLayoutFile {
  world: { w: number; h: number };
  pixelScale: number;
  camera: { minX: number; maxX: number; minY: number; maxY: number; spawnX: number };
  ground: number[][];
  plateau: number[][];
  stream: { points: number[][]; width: number };
  plazas: { id: string; points: number[][] }[];
  nodes: { id: string; x: number; y: number; kind: string; area?: string; tag?: string }[];
  roads: { id: string; kind: string; width: number; nodes: string[]; stairs?: string[][]; bridges?: string[][] }[];
  connectors: string[][];
  plots: { plotId: string; anchor: number[]; bounds: number[]; front: string; idle: string[]; visualOffset: number[]; fx: Record<string, number[]> }[];
  decor?: IslandDecor[];
  ambient?: { slot: string; x: number; y: number }[];
  foreground?: { branches: { slot: string; x: number; y: number }[] };
}
export const LAYOUT = LAYOUT_JSON as unknown as IslandLayoutFile;

/**
 * Home Island LAYOUT — shared by every player and every theme (never saved per account). Source of truth:
 * `island/default-layout.json` (also read by tools/island/generate.py to bake the default ground / road layers).
 *
 *     [H] Challenge                 TOWER (plateau, stairs)      (stream)      D Skill Shrine
 *              E Tavern / Hall        [F] Memorial                   ┆            B Ascension
 *     A Training ~~~~~~~ MAIN PLAZA ~~~~~~~ east road ~~~~ bridge ~~~ mystic court
 *                                                                           C Workshop   G Dock (edge)
 *
 * Wide 2400 × 1080 world (20:9), horizontally pannable; organic spline roads through nav nodes.
 */
export const ISLAND_WORLD = { w: LAYOUT.world.w, h: LAYOUT.world.h };
/** art is authored at native resolution: 1 px = PIXEL_SCALE world units */
export const PIXEL_SCALE = LAYOUT.pixelScale;
export const ISLAND_CAMERA = LAYOUT.camera;

const pts = (a: number[][]): Vec2[] => a.map(([x, y]) => ({ x, y }));
export const GROUND_POLY: Vec2[] = pts(LAYOUT.ground);
export const PLATEAU_POLY: Vec2[] = pts(LAYOUT.plateau);
export const STREAM = { points: pts(LAYOUT.stream.points), width: LAYOUT.stream.width };
export const PLAZAS = LAYOUT.plazas.map(p => ({ id: p.id, points: pts(p.points) }));

export function pointInPoly(p: Vec2, poly: Vec2[]): boolean {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) c = !c;
  }
  return c;
}
export function segDist(p: Vec2, a: Vec2, b: Vec2): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}
export const distToPoly = (p: Vec2, poly: Vec2[]) => Math.min(...poly.map((a, i) => segDist(p, a, poly[(i + 1) % poly.length])));
/** walkable = on the island, not in the stream (bridges excepted — heroes only walk nav edges anyway) */
export const insideIsland = (p: Vec2, margin = 0) => pointInPoly(p, GROUND_POLY) && (margin <= 0 || distToPoly(p, GROUND_POLY) >= margin);
/** nav nodes keep at least this distance to the coast */
export const COAST_MARGIN = 24;

// ------------------------------------------------------------------ navigation graph (roads + idle connectors)

export const NAV_NODES: NavNode[] = LAYOUT.nodes.map(n => ({
  id: n.id, pos: { x: n.x, y: n.y }, kind: n.kind as NavNode['kind'], ...(n.area ? { area: n.area as NavNode['area'] } : {}), ...(n.tag ? { tag: n.tag } : {}),
}));
export const ISLAND_ROADS: IslandRoad[] = LAYOUT.roads.map(r => ({
  id: r.id, kind: r.kind as IslandRoad['kind'], width: r.width, nodes: r.nodes,
  ...(r.stairs ? { stairs: r.stairs as [string, string][] } : {}), ...(r.bridges ? { bridges: r.bridges as [string, string][] } : {}),
}));
export const NAV_EDGES: NavEdge[] = [
  ...ISLAND_ROADS.flatMap(r => r.nodes.slice(1).map((b, i) => [r.nodes[i], b] as NavEdge)),
  ...LAYOUT.connectors.map(([a, b]) => [a, b] as NavEdge),
];
export const NAV_BY_ID: Record<string, NavNode> = Object.fromEntries(NAV_NODES.map(x => [x.id, x]));

// ------------------------------------------------------------------ plots (fixed functional slots)

export const ISLAND_PLOTS: IslandPlotDefinition[] = LAYOUT.plots.map(p => ({
  plotId: p.plotId as PlotId,
  position: { x: p.anchor[0], y: p.anchor[1] },
  walkInteractionPosition: p.front,
  buildingBounds: { x: p.bounds[0], y: p.bounds[1], w: p.bounds[2], h: p.bounds[3] },
  heroIdlePoints: p.idle,
  navigationLinks: [p.front],
  visualOffset: { x: p.visualOffset[0], y: p.visualOffset[1] },
  fxAnchors: Object.fromEntries(Object.entries(p.fx).map(([k, v]) => [k, { x: v[0], y: v[1] }])),
}));
export const PLOT_BY_ID = Object.fromEntries(ISLAND_PLOTS.map(p => [p.plotId, p])) as Record<PlotId, IslandPlotDefinition>;

/** decoration spots (semantic slots; the theme decides the art) */
export const ISLAND_DECOR: IslandDecor[] = LAYOUT.decor ?? [];

// ------------------------------------------------------------------ buildings (gameplay config — no art here)

const st = (stage: number, minFloor: number, label: string, level: number) => ({ stage, minFloor, label, level });

export const ISLAND_BUILDINGS: IslandBuildingDefinition[] = [
  {
    id: 'tower', plotId: 'PLOT_TOWER', buildingType: 'TOWER', name: 'หอคอยอัญเชิญ', interactionType: 'TOWER',
    description: 'หัวใจของเกาะ ยิ่งพิชิตชั้นสูง เกาะยิ่งฟื้นคืน',
    unlockRequirement: { type: 'ALWAYS' }, navigationTarget: 'tower_gate', availableThemeSkins: ['forest_tower'],
    visualStages: [
      st(0, 0, 'หอคอยถูกผนึก', 1), st(1, 3, 'ประตูหอคอยตื่น', 2), st(2, 5, 'โครงหอคอยปรากฏ', 3),
      st(3, 7, 'เวทมนตร์ไหลเวียน', 4), st(4, 9, 'ออร่าแห่งจุดสูงสุด', 5), st(5, 10, 'หอคอยถูกพิชิต', 6),
    ],
    actions: [{ label: 'ดูชั้นหอคอย', route: '/tower', icon: 'tower' }, { label: 'ท้าชิงชั้นถัดไป', route: '/battle', query: { mode: 'tower' }, icon: 'sword' }],
  },
  {
    id: 'training_ground', plotId: 'PLOT_A', buildingType: 'TRAINING_GROUND', name: 'ลานฝึก', interactionType: 'TRAINING',
    description: 'ฝึกฮีโร่รับ EXP และยา — Training Ground',
    unlockRequirement: { type: 'TOWER_FLOOR', floor: 3 }, navigationTarget: 'a_front', availableThemeSkins: ['forest_training'],
    visualStages: [st(0, 0, 'ลานรกร้าง', 0), st(1, 3, 'ลานฝึก', 1), st(2, 6, 'สนามฝึก', 2), st(3, 9, 'ค่ายฝึกรบ', 3)],
    actions: [{ label: 'Training Ground', route: '/dungeons/training', icon: 'shield' }],
  },
  {
    id: 'hero_hall', plotId: 'PLOT_E', buildingType: 'HERO_HALL', name: 'โรงเตี๊ยม', interactionType: 'HERO_HALL',
    description: 'ที่พักของเหล่าฮีโร่ — จัดการฮีโร่ จัดทัพ และ (อนาคต) รับสมัคร',
    unlockRequirement: { type: 'TOWER_FLOOR', floor: 4 }, navigationTarget: 'e_front', availableThemeSkins: ['forest_hall'],
    visualStages: [st(0, 0, 'ซากอาคาร', 0), st(1, 4, 'โรงเตี๊ยม', 1), st(2, 8, 'หอวีรชน', 2)],
    actions: [{ label: 'ฮีโร่', route: '/heroes', icon: 'heroes' }, { label: 'จัดทัพ', route: '/team', icon: 'team' }, { label: 'อัญเชิญ', route: '/gacha', icon: 'summon' }],
  },
  {
    id: 'ascension_shrine', plotId: 'PLOT_B', buildingType: 'ASCENSION_SHRINE', name: 'ศาลเสด็จขึ้น', interactionType: 'ASCENSION',
    description: 'ดวลผู้พิทักษ์เพื่อหิน Breakthrough — Ascension Trial',
    unlockRequirement: { type: 'TOWER_FLOOR', floor: 5 }, navigationTarget: 'b_front', availableThemeSkins: ['forest_ascension'],
    visualStages: [st(0, 0, 'ศาลที่ถูกผนึก', 0), st(1, 5, 'ศาลเสด็จขึ้น', 1), st(2, 8, 'ศาลเรืองรอง', 2)],
    actions: [{ label: 'Ascension Trial', route: '/dungeons/ascension', icon: 'crown' }],
  },
  {
    id: 'equipment_workshop', plotId: 'PLOT_C', buildingType: 'EQUIPMENT_WORKSHOP', name: 'โรงช่าง', interactionType: 'WORKSHOP',
    description: 'อุปกรณ์ โรงตีเหล็ก และการล่าอุปกรณ์ — Equipment Hunt',
    unlockRequirement: { type: 'TOWER_FLOOR', floor: 6 }, navigationTarget: 'c_front', availableThemeSkins: ['forest_workshop'],
    visualStages: [st(0, 0, 'ฐานรากพังทลาย', 0), st(1, 6, 'โรงช่างเล็ก', 1), st(2, 8, 'โรงหลอมเต็มรูป', 2), st(3, 10, 'โรงหลอมเวทมนตร์', 3)],
    actions: [
      { label: 'คลังอุปกรณ์', route: '/armory', icon: 'armory' }, { label: 'โรงตีเหล็ก', route: '/forge', icon: 'flame' },
      { label: 'Equipment Hunt', route: '/dungeons/hunt', icon: 'coin' },
    ],
  },
  {
    id: 'skill_shrine', plotId: 'PLOT_D', buildingType: 'SKILL_SHRINE', name: 'ศาลวิชา', interactionType: 'SKILL',
    description: 'อัปแรงก์สกิลของฮีโร่ และ Skill Trial',
    unlockRequirement: { type: 'TOWER_FLOOR', floor: 7 }, navigationTarget: 'd_front', availableThemeSkins: ['forest_skill'],
    visualStages: [st(0, 0, 'ศาลปิดตาย', 0), st(1, 7, 'ศาลวิชา', 1), st(2, 9, 'ศาลปราชญ์', 2)],
    actions: [{ label: 'อัปสกิล (ฮีโร่)', route: '/heroes', icon: 'book' }, { label: 'Skill Trial', route: '/dungeons/trial', icon: 'scroll' }],
  },
  {
    id: 'challenge_board', plotId: 'PLOT_H', buildingType: 'CHALLENGE_BOARD', name: 'กระดานท้าทาย', interactionType: 'CHALLENGE',
    description: 'เตรียมทัพก่อนชั้นท้าย ๆ — (อนาคต) ภารกิจท้าทาย',
    unlockRequirement: { type: 'TOWER_FLOOR', floor: 9 }, navigationTarget: 'h_front', availableThemeSkins: ['forest_board'],
    visualStages: [st(0, 0, 'ป้ายหักโค่น', 0), st(1, 9, 'กระดานท้าทาย', 1)],
    actions: [{ label: 'จัดทัพ', route: '/team', icon: 'team' }, { label: 'สนามซ้อม', route: '/lab', icon: 'lab' }],
  },
  {
    id: 'endgame_facility', plotId: 'PLOT_F', buildingType: 'ENDGAME_FACILITY', name: 'อนุสรณ์ผู้พิชิต', interactionType: 'FUTURE', future: true,
    description: 'สิ่งก่อสร้างหลังพิชิตหอคอย — โหมดท้าทายขั้นสูงจะเปิดในอนาคต',
    unlockRequirement: { type: 'TOWER_FLOOR', floor: 10 }, navigationTarget: 'f_front', availableThemeSkins: ['forest_memorial'],
    visualStages: [st(0, 0, 'ลานว่างเปล่า', 0), st(1, 10, 'อนุสรณ์ผู้พิชิต', 1)],
    actions: [],
  },
  {
    id: 'expedition_dock', plotId: 'PLOT_G', buildingType: 'EXPEDITION_DOCK', name: 'ท่าเรือเหาะ', interactionType: 'FUTURE', future: true,
    description: 'เรือเหาะที่พังอยู่ริมเกาะ — ซ่อมใน Patch 1.1 แล้วใช้เดินทางสู่เกาะใหม่ใน Patch 2',
    unlockRequirement: { type: 'TOWER_FLOOR', floor: 10 }, navigationTarget: 'g_front', availableThemeSkins: ['forest_dock'],
    visualStages: [st(0, 0, 'ซากเรือเหาะ', 0), st(1, 10, 'จุดซ่อมเรือเหาะ', 1)],
    actions: [],
  },
];
export const BUILDING_BY_ID: Record<string, IslandBuildingDefinition> = Object.fromEntries(ISLAND_BUILDINGS.map(b => [b.id, b]));

/** island development stages (what the whole island "reads" as) */
export const ISLAND_STAGES = [
  { stage: 0, minFloor: 0, name: 'ดินแดนรกร้าง', extraRoamers: 1 },
  { stage: 1, minFloor: 3, name: 'ด่านหน้า', extraRoamers: 2 },
  { stage: 2, minFloor: 5, name: 'หมู่บ้าน', extraRoamers: 3 },
  { stage: 3, minFloor: 7, name: 'นิคม', extraRoamers: 4 },
  { stage: 4, minFloor: 9, name: 'ป้อมปราการ', extraRoamers: 5 },
  { stage: 5, minFloor: 10, name: 'เกาะผู้พิชิต', extraRoamers: 5 },
];
/** hard cap on roaming heroes besides the main hero (mobile budget) */
export const MAX_EXTRA_ROAMERS = 5;

/** idle flavour only (no combat effect): where each class likes to hang out */
export const CLASS_HANGOUTS: Record<HeroClass, string[]> = {
  tank: ['equipment_workshop', 'training_ground'],
  fighter: ['training_ground'],
  assassin: ['PLAZA_EDGE', 'challenge_board', 'tower'],
  archer: ['training_ground'],
  mage: ['skill_shrine'],
  healer: ['ascension_shrine', 'skill_shrine'],
};
