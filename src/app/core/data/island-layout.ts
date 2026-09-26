import { HeroClass } from '../models/hero';
import { IslandBuildingDefinition, IslandPlotDefinition, NavEdge, NavNode, PlotId, Vec2 } from '../models/island';

/**
 * Home Island LAYOUT — shared by every player (never saved per account, never theme-dependent).
 *
 *                 [H]      TOWER
 *            A (Training)          B (Ascension)
 *                        PLAZA
 *            C (Workshop)          D (Skill Shrine)
 *                      HOME AREA
 *            E (Hero Hall)         F (Endgame)
 *                   G (Expedition Dock)
 *
 * World = 600 × 900 portrait canvas (fits a phone screen, one screen, no scrolling).
 */
export const ISLAND_WORLD = { w: 600, h: 900 };
/** what the camera shows: the world plus a ring of sea around it */
export const ISLAND_VIEW = { x: -40, y: -30, w: 680, h: 960 };

/** walkable island mask: superellipse |dx/rx|^4 + |dy/ry|^4 ≤ 1 (the drawn coastline is decoration only) */
export const ISLAND_SHAPE = { cx: 300, cy: 460, rx: 290, ry: 430, power: 4 };
/** nav nodes / footprints must satisfy mask ≤ this (keeps a beach margin) */
export const ISLAND_SAFE = 0.92;
export const islandMask = (p: Vec2) =>
  Math.abs((p.x - ISLAND_SHAPE.cx) / ISLAND_SHAPE.rx) ** ISLAND_SHAPE.power + Math.abs((p.y - ISLAND_SHAPE.cy) / ISLAND_SHAPE.ry) ** ISLAND_SHAPE.power;
export const insideIsland = (p: Vec2, limit = 1) => islandMask(p) <= limit;

// ------------------------------------------------------------------ navigation graph

const n = (id: string, x: number, y: number, kind: NavNode['kind'] = 'PATH', area?: NavNode['area']): NavNode => ({ id, pos: { x, y }, kind, area });

export const NAV_NODES: NavNode[] = [
  // spine
  n('tower_gate', 300, 255),
  n('plaza', 300, 440, 'SOCIAL', 'PLAZA'),
  n('home', 300, 640, 'SOCIAL', 'HOME'),
  n('south', 300, 785),
  // tower
  n('tower_l', 250, 258, 'IDLE'), n('tower_r', 350, 258, 'IDLE'),
  // plaza / home social spots
  n('plaza_w', 255, 452, 'SOCIAL', 'PLAZA'), n('plaza_e', 345, 452, 'SOCIAL', 'PLAZA'), n('plaza_s', 300, 488, 'SOCIAL', 'PLAZA'),
  n('home_w', 248, 655, 'SOCIAL', 'HOME'), n('home_e', 352, 655, 'SOCIAL', 'HOME'),
  // plot fronts + idle points
  n('a_front', 150, 390, 'FRONT'), n('a_idle1', 95, 393, 'IDLE'), n('a_idle2', 205, 393, 'IDLE'),
  n('b_front', 450, 402, 'FRONT'), n('b_idle1', 400, 404, 'IDLE'), n('b_idle2', 500, 404, 'IDLE'),
  n('c_front', 150, 595, 'FRONT'), n('c_idle1', 100, 597, 'IDLE'), n('c_idle2', 200, 597, 'IDLE'),
  n('d_front', 450, 598, 'FRONT'), n('d_idle1', 402, 600, 'IDLE'), n('d_idle2', 498, 600, 'IDLE'),
  n('e_front', 150, 772, 'FRONT'), n('e_idle1', 95, 774, 'IDLE'), n('e_idle2', 205, 774, 'IDLE'),
  n('f_front', 450, 775, 'FRONT'), n('f_idle1', 400, 777, 'IDLE'), n('f_idle2', 500, 777, 'IDLE'),
  n('h_front', 110, 232, 'FRONT'), n('h_idle1', 62, 236, 'IDLE'), n('h_idle2', 165, 240, 'IDLE'),
  n('dock_w', 240, 790, 'IDLE'), n('dock_e', 360, 790, 'IDLE'),
];

export const NAV_EDGES: NavEdge[] = [
  ['tower_gate', 'plaza'], ['plaza', 'plaza_s'], ['plaza_s', 'home'], ['home', 'south'],
  ['tower_gate', 'tower_l'], ['tower_gate', 'tower_r'], ['tower_gate', 'h_front'],
  ['plaza', 'plaza_w'], ['plaza', 'plaza_e'], ['home', 'home_w'], ['home', 'home_e'],
  ['plaza', 'a_front'], ['plaza', 'b_front'], ['home', 'c_front'], ['home', 'd_front'], ['south', 'e_front'], ['south', 'f_front'],
  ['a_front', 'a_idle1'], ['a_front', 'a_idle2'], ['b_front', 'b_idle1'], ['b_front', 'b_idle2'],
  ['c_front', 'c_idle1'], ['c_front', 'c_idle2'], ['d_front', 'd_idle1'], ['d_front', 'd_idle2'],
  ['e_front', 'e_idle1'], ['e_front', 'e_idle2'], ['f_front', 'f_idle1'], ['f_front', 'f_idle2'],
  ['h_front', 'h_idle1'], ['h_front', 'h_idle2'], ['south', 'dock_w'], ['south', 'dock_e'],
];

export const NAV_BY_ID: Record<string, NavNode> = Object.fromEntries(NAV_NODES.map(x => [x.id, x]));

// ------------------------------------------------------------------ plots (fixed functional slots)

const plot = (plotId: PlotId, x: number, y: number, w: number, h: number, front: string, idle: string[], links: string[]): IslandPlotDefinition => ({
  plotId, position: { x, y }, walkInteractionPosition: front, buildingBounds: { x: x - w / 2, y: y - h, w, h }, heroIdlePoints: idle, navigationLinks: links,
});

export const ISLAND_PLOTS: IslandPlotDefinition[] = [
  plot('PLOT_TOWER', 300, 220, 90, 160, 'tower_gate', ['tower_l', 'tower_r'], ['plaza', 'h_front']),
  plot('PLOT_A', 150, 355, 140, 70, 'a_front', ['a_idle1', 'a_idle2'], ['plaza']),
  plot('PLOT_B', 450, 370, 110, 100, 'b_front', ['b_idle1', 'b_idle2'], ['plaza']),
  plot('PLOT_C', 150, 560, 110, 80, 'c_front', ['c_idle1', 'c_idle2'], ['home']),
  plot('PLOT_D', 450, 565, 100, 90, 'd_front', ['d_idle1', 'd_idle2'], ['home']),
  plot('PLOT_E', 150, 740, 140, 80, 'e_front', ['e_idle1', 'e_idle2'], ['south']),
  plot('PLOT_F', 450, 745, 120, 90, 'f_front', ['f_idle1', 'f_idle2'], ['south']),
  plot('PLOT_G', 300, 858, 200, 50, 'south', ['dock_w', 'dock_e'], ['home']),
  plot('PLOT_H', 110, 200, 80, 60, 'h_front', ['h_idle1', 'h_idle2'], ['tower_gate']),
];
export const PLOT_BY_ID = Object.fromEntries(ISLAND_PLOTS.map(p => [p.plotId, p])) as Record<PlotId, IslandPlotDefinition>;

/** decoration spots (trees / rocks) — visual only, no collision; the theme decides what grows there */
export const DECOR_POINTS: Vec2[] = [
  { x: 60, y: 300 }, { x: 540, y: 250 }, { x: 555, y: 470 }, { x: 45, y: 480 }, { x: 540, y: 660 }, { x: 55, y: 650 },
  { x: 205, y: 150 }, { x: 395, y: 150 }, { x: 250, y: 520 }, { x: 355, y: 540 }, { x: 110, y: 840 }, { x: 490, y: 845 },
  { x: 365, y: 330 }, { x: 235, y: 330 }, { x: 250, y: 720 }, { x: 350, y: 720 },
];

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
    unlockRequirement: { type: 'TOWER_FLOOR', floor: 10 }, navigationTarget: 'south', availableThemeSkins: ['forest_dock'],
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
  assassin: ['PLAZA_EDGE', 'challenge_board'],
  archer: ['training_ground'],
  mage: ['skill_shrine'],
  healer: ['ascension_shrine', 'skill_shrine'],
};
