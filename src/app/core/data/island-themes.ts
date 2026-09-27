import {
  BuildingSkin, IslandAsset, IslandThemeDefinition, PlaceholderShape, PlaceholderStageStyle, SkinLayer,
} from '../models/island';
import { DEFAULT_FOREST_ASSETS } from './island/default-forest.assets';
import { FROZEN_KINGDOM_ASSETS } from './island/frozen-kingdom.assets';

/**
 * Island THEMES and building SKINS — cosmetic only. Nothing here is read by unlocks, navigation, collision or saves.
 *
 * Gameplay code only knows SEMANTIC SLOTS ('building.forge.base', 'building.forge.fx.smoke', 'tree.largeA' …).
 * A theme fills slots with assets; anything a theme lacks falls back to the Default Forest asset, and a building whose
 * base art is missing everywhere falls back to its placeholder shape — never a crash, never a hidden building.
 */

// ------------------------------------------------------------------ placeholder skins (final fallback)

const ph = (shape: PlaceholderShape, fill: string, stroke: string, scale: number, icon: string, glow?: string): PlaceholderStageStyle =>
  ({ shape, fill, stroke, scale, icon, glow });
const RUIN = (icon: string) => ph('RUIN', '#3b3446', '#6b5f7e', 0.8, icon);

export const PLACEHOLDER_SKINS: Record<string, BuildingSkin> = {
  tower: {
    id: 'placeholder_tower', kind: 'PLACEHOLDER', stages: {
      0: ph('PILLAR', '#55506a', '#7d7896', 0.72, 'lock'), 1: ph('PILLAR', '#5e5a78', '#b9a4ff', 0.8, 'tower', '#9b6bff55'),
      2: ph('PILLAR', '#676284', '#c9adff', 0.9, 'tower', '#9b6bff77'), 3: ph('PILLAR', '#5b3f8a', '#d7c2ff', 0.95, 'bolt', '#b07cf0aa'),
      4: ph('PILLAR', '#4a2f78', '#f6dfa0', 1, 'crown', '#f0b54a99'), 5: ph('PILLAR', '#8a6a2e', '#fff1c2', 1, 'crown', '#f6dfa0cc'),
    },
  },
  training_ground: {
    id: 'placeholder_training', kind: 'PLACEHOLDER', stages: {
      0: RUIN('shield'), 1: ph('ROUNDED_RECT', '#2f6b3f', '#7fe0a0', 0.75, 'shield'),
      2: ph('ROUNDED_RECT', '#338048', '#9ff0b8', 0.9, 'shield'), 3: ph('ROUNDED_RECT', '#2a8a4a', '#d6ffe0', 1, 'shield', '#56c07a66'),
    },
  },
  hero_hall: { id: 'placeholder_hall', kind: 'PLACEHOLDER', stages: { 0: RUIN('heroes'), 1: ph('RECT', '#6b4a2e', '#d6a26e', 0.8, 'heroes'), 2: ph('RECT', '#7a5433', '#f0c890', 1, 'heroes', '#d9b46455') } },
  ascension_shrine: { id: 'placeholder_ascension', kind: 'PLACEHOLDER', stages: { 0: RUIN('crown'), 1: ph('HEX', '#5a3a8a', '#c9adff', 0.8, 'crown', '#9b6bff55'), 2: ph('HEX', '#6a44a8', '#e6d6ff', 1, 'crown', '#b07cf0aa') } },
  equipment_workshop: {
    id: 'placeholder_workshop', kind: 'PLACEHOLDER', stages: {
      0: RUIN('armory'), 1: ph('RECT', '#8a4a1e', '#f0a060', 0.7, 'armory'), 2: ph('RECT', '#9a5220', '#ffbf80', 0.88, 'flame', '#e0643a55'), 3: ph('RECT', '#7a3a8a', '#ffc8a0', 1, 'flame', '#e0643aaa'),
    },
  },
  skill_shrine: { id: 'placeholder_skill', kind: 'PLACEHOLDER', stages: { 0: RUIN('book'), 1: ph('CIRCLE', '#2a4f8a', '#8fc0ff', 0.8, 'book', '#4f9be855'), 2: ph('CIRCLE', '#2f5ea8', '#cfe4ff', 1, 'book', '#4f9be8aa') } },
  challenge_board: { id: 'placeholder_board', kind: 'PLACEHOLDER', stages: { 0: RUIN('scroll'), 1: ph('RECT', '#6a5a2a', '#f0d890', 0.85, 'scroll', '#d9b46444') } },
  endgame_facility: { id: 'placeholder_memorial', kind: 'PLACEHOLDER', stages: { 0: ph('RUIN', '#2e2a3a', '#4a4458', 0.7, 'lock'), 1: ph('HEX', '#3a3050', '#f6dfa0', 0.95, 'skull', '#f0b54a66') } },
  expedition_dock: { id: 'placeholder_dock', kind: 'PLACEHOLDER', stages: { 0: ph('LONG_RECT', '#3a2f28', '#6e5a48', 0.85, 'lock'), 1: ph('LONG_RECT', '#5a4432', '#d6b48a', 1, 'arrow', '#5ec8e044') } },
};
/** @deprecated name kept for older imports — the placeholder skins */
export const DEFAULT_BUILDING_SKINS = PLACEHOLDER_SKINS;

// ------------------------------------------------------------------ Default Forest layered skins

const L = (slot: string, role: SkinLayer['role'], extra: Partial<SkinLayer> = {}): SkinLayer => ({ slot, role, ...extra });
const at = (anchor: string, extra: Partial<SkinLayer> = {}) => ({ at: anchor, ...extra });

const towerStage = (base: string, runes: string | null, glow: string | null, crystal: string | null, aura: string | null, particles: string | null, pulse: string | null): SkinLayer[] => [
  L('building.tower.shadow', 'SHADOW', { dy: 6 }),
  ...(aura ? [L(`building.tower.fx.aura.${aura}`, 'BACK', at('auraAnchor', { glow: true }))] : []),
  L(`building.tower.base.${base}`, 'BASE'),
  ...(runes ? [L(`building.tower.runes.${runes}`, 'OVERLAY', { motion: 'pulse', glow: true })] : []),
  ...(glow ? [L(`building.tower.glow.${glow}`, 'LIGHT', { motion: 'flicker', glow: true })] : []),
  ...(crystal ? [L(`building.tower.crystal.${crystal}`, 'FX', at('crystalAnchor', { motion: 'bob' }))] : []),
  ...(particles ? [L(`building.tower.fx.particles.${particles}`, 'FX', at('particleAnchor', { glow: true }))] : []),
  ...(pulse ? [L(`building.tower.fx.pulse.${pulse}`, 'FX', at('pulseAnchor', { glow: true }))] : []),
];

const trainingParts = (n: number): SkinLayer[] => {
  if (n === 0) return [
    L('building.ruin.small', 'BASE', { dx: 10, dy: -20 }), L('training.fenceBroken', 'PART', { dx: -86, dy: -52 }),
    L('training.fenceBroken', 'PART', { dx: 70, dy: -58, flip: true }), L('veg.tallGrass', 'PART', { dx: -30, dy: 4 }),
  ];
  const out: SkinLayer[] = [
    L('training.mat', 'BASE', { dy: 12 }), L('training.fence', 'PART', { dx: -92, dy: -56 }), L('training.fence', 'PART', { dx: 44, dy: -62 }),
    L('training.dummy', 'PART', { dx: -46, dy: -8 }), L('training.dummy', 'PART', { dx: 28, dy: -22 }), L('training.banner', 'FX', at('bannerAnchor')),
  ];
  if (n >= 2) out.push(L('training.target', 'PART', { dx: 96, dy: -30 }), L('training.rack', 'PART', { dx: -118, dy: -18 }), L('prop.crate', 'PART', { dx: 124, dy: 14 }));
  if (n >= 3) out.push(L('training.target', 'PART', { dx: 66, dy: 18 }), L('prop.bannerBlue', 'FX', { dx: 150, dy: -40 }), L('training.dummy', 'PART', { dx: -6, dy: 22 }));
  return out;
};

export const DEFAULT_FOREST_SKINS: Record<string, BuildingSkin> = {
  tower: {
    id: 'default_forest_tower', kind: 'LAYERED', stages: {
      0: towerStage('sealed', null, null, null, null, null, null),
      1: towerStage('awakened', 'emerald', null, 'emerald', null, 'emerald', null),
      2: towerStage('active', 'emerald', 'cyan', 'emerald', 'emerald', 'emerald', null),
      3: towerStage('corrupted', 'violet', 'cyan', 'violet', 'violet', 'violet', null),
      4: towerStage('corrupted', 'violet', 'cyan', 'violet', 'violet', 'violet', 'violet'),
      5: towerStage('ascended', 'gold', 'gold', 'gold', 'gold', 'gold', 'gold'),
    },
  },
  training_ground: { id: 'default_forest_training', kind: 'LAYERED', stages: { 0: trainingParts(0), 1: trainingParts(1), 2: trainingParts(2), 3: trainingParts(3) } },
  hero_hall: {
    id: 'default_forest_hall', kind: 'LAYERED', stages: {
      0: [L('building.ruin.large', 'BASE')],
      1: [L('building.tavern.base', 'BASE'), L('building.tavern.light', 'LIGHT', { motion: 'flicker', glow: true }), L('fx.lantern', 'FX', at('lanternAnchor', { glow: true })),
          L('fx.smoke', 'FX', at('chimneySmokeAnchor')), L('prop.table', 'PART', { dx: 150, dy: 30 })],
      2: [L('building.hall.base', 'BASE'), L('building.tavern.light', 'LIGHT', { motion: 'flicker', glow: true }), L('fx.lantern', 'FX', at('lanternAnchor', { glow: true })),
          L('fx.smoke', 'FX', at('chimneySmokeAnchor')), L('prop.bannerBlue', 'FX', at('bannerAnchor')), L('prop.table', 'PART', { dx: 150, dy: 30 })],
    },
  },
  ascension_shrine: {
    id: 'default_forest_ascension', kind: 'LAYERED', stages: {
      0: [L('building.ascension.base.s0', 'BASE')],
      1: [L('building.ascension.fx.runeCircle', 'BACK', at('runeAnchor', { glow: true })), L('building.ascension.base.s1', 'BASE'),
          L('building.ascension.crystal', 'FX', at('crystalAnchor', { motion: 'bob' })), L('fx.particlesViolet', 'FX', at('particleAnchor', { glow: true }))],
      2: [L('building.ascension.fx.runeCircle', 'BACK', at('runeAnchor', { glow: true })), L('building.ascension.base.s2', 'BASE'),
          L('building.ascension.crystal', 'FX', at('crystalAnchor', { motion: 'bob' })), L('fx.particlesViolet', 'FX', at('particleAnchor', { glow: true })),
          L('fx.particlesGold', 'FX', at('particleAnchor', { glow: true, dx: 24 }))],
    },
  },
  equipment_workshop: {
    id: 'default_forest_workshop', kind: 'LAYERED', stages: {
      0: [L('building.ruin.medium', 'BASE')],
      1: [L('building.workshop.base', 'BASE'), L('building.forge.light', 'LIGHT', { motion: 'flicker', glow: true }),
          L('building.forge.fx.fire', 'FX', at('forgeFireAnchor', { glow: true })), L('building.forge.fx.smoke', 'FX', at('chimneySmokeAnchor'))],
      2: [L('building.forge.base', 'BASE'), L('building.forge.light', 'LIGHT', { motion: 'flicker', glow: true }),
          L('building.forge.fx.fire', 'FX', at('forgeFireAnchor', { glow: true })), L('building.forge.fx.smoke', 'FX', at('chimneySmokeAnchor')),
          L('building.forge.fx.sparks', 'FX', at('sparkAnchor', { glow: true }))],
      3: [L('building.forge.arcane', 'BASE'), L('building.forge.light', 'LIGHT', { motion: 'flicker', glow: true }),
          L('building.forge.fx.fire', 'FX', at('forgeFireAnchor', { glow: true })), L('building.forge.fx.smoke', 'FX', at('chimneySmokeAnchor')),
          L('building.forge.fx.sparks', 'FX', at('sparkAnchor', { glow: true })), L('fx.particlesViolet', 'FX', at('chimneySmokeAnchor', { glow: true, dy: 60 }))],
    },
  },
  skill_shrine: {
    id: 'default_forest_skill', kind: 'LAYERED', stages: {
      0: [L('building.skill.base.s0', 'BASE')],
      1: [L('building.skill.base.s1', 'BASE'), L('building.skill.runes.s1', 'OVERLAY', { motion: 'pulse', glow: true }),
          L('building.skill.crystal', 'FX', at('crystalAnchor', { motion: 'bob' })), L('fx.particlesCyan', 'FX', at('particleAnchor', { glow: true }))],
      2: [L('building.skill.base.s2', 'BASE'), L('building.skill.runes.s2', 'OVERLAY', { motion: 'pulse', glow: true }),
          L('building.skill.crystal', 'FX', at('crystalAnchor', { motion: 'bob' })), L('fx.particlesCyan', 'FX', at('particleAnchor', { glow: true }))],
    },
  },
  challenge_board: {
    id: 'default_forest_board', kind: 'LAYERED', stages: {
      0: [L('building.board.base.s0', 'BASE')], 1: [L('building.board.base.s1', 'BASE'), L('training.banner', 'FX', at('bannerAnchor'))],
    },
  },
  endgame_facility: {
    id: 'default_forest_memorial', kind: 'LAYERED', stages: {
      0: [L('building.memorial.base.s0', 'BASE')], 1: [L('building.memorial.base.s1', 'BASE'), L('fx.particlesGold', 'FX', at('auraAnchor', { glow: true }))],
    },
  },
  expedition_dock: {
    id: 'default_forest_dock', kind: 'LAYERED', stages: {
      0: [L('building.dock.base.s0', 'BASE')], 1: [L('building.dock.base.s1', 'BASE'), L('fx.lantern', 'FX', at('lanternAnchor', { glow: true }))],
    },
  },
};

// ------------------------------------------------------------------ themes

/** Patch 1 default theme — free, matches the Normal Forest tower biome */
export const DEFAULT_THEME_ID = 'default_forest';
/** older saves used this id for the same theme */
export const THEME_ALIASES: Record<string, string> = { ancient_forest: DEFAULT_THEME_ID };

export const DEFAULT_FOREST_THEME: IslandThemeDefinition = {
  id: DEFAULT_THEME_ID,
  name: 'Ancient Forest Island',
  free: true,
  assets: DEFAULT_FOREST_ASSETS,
  terrainSet: { ground: 'terrain.ground', water: 'terrain.streamWater', waterfall: 'terrain.waterfall' },
  roadSet: { layer: 'road.layer', bridge: 'road.bridge' },
  backgroundSet: {
    sky: 'bg.sky',
    far: [{ slot: 'bg.mountains', y: 114, parallax: 0.25 }, { slot: 'bg.forestFar', y: 180, parallax: 0.5 }],
    clouds: ['bg.cloud1', 'bg.cloud2', 'bg.cloud3'],
    floatingRocks: ['bg.floatingRock1', 'bg.floatingRock2'],
    mist: 'bg.mist',
  },
  buildingSkins: DEFAULT_FOREST_SKINS,
  treeSet: ['tree.largeA', 'tree.largeB', 'tree.mediumA', 'tree.mediumB', 'tree.small', 'tree.dead', 'tree.blossom'],
  vegetationSet: ['veg.bushA', 'veg.bushB', 'veg.fern', 'veg.tallGrass', 'veg.flowers', 'veg.mushrooms', 'veg.moss'],
  propSet: ['prop.barrel', 'prop.crate', 'prop.lanternPost', 'prop.signpost', 'prop.bench', 'prop.table', 'prop.cart', 'prop.firewood', 'prop.fountain', 'prop.campfire', 'prop.bannerBlue'],
  ambientFxSet: { fireflies: 'fx.fireflies', foregroundBranches: ['fore.branchLeft', 'fore.branchRight'] },
  lightingPreset: {
    id: 'DUSK',
    ambient: 'rgba(12, 8, 34, 0.30)',
    lights: [
      { building: 'tower', at: 'auraAnchor', color: 'rgba(80, 220, 170, 0.30)', radius: 360, minStage: 1, maxStage: 2 },
      { building: 'tower', at: 'auraAnchor', color: 'rgba(160, 110, 255, 0.34)', radius: 380, minStage: 3, maxStage: 4 },
      { building: 'tower', at: 'auraAnchor', color: 'rgba(250, 210, 120, 0.36)', radius: 420, minStage: 5 },
      { building: 'equipment_workshop', at: 'forgeFireAnchor', color: 'rgba(255, 140, 60, 0.42)', radius: 230, minStage: 1, flicker: true },
      { building: 'hero_hall', at: 'windowLightAnchor', color: 'rgba(255, 200, 110, 0.32)', radius: 250, minStage: 1 },
      { building: 'hero_hall', at: 'lanternAnchor', color: 'rgba(255, 190, 100, 0.35)', radius: 90, minStage: 1, flicker: true },
      { building: 'skill_shrine', at: 'runeAnchor', color: 'rgba(80, 210, 240, 0.34)', radius: 230, minStage: 1 },
      { building: 'ascension_shrine', at: 'crystalAnchor', color: 'rgba(170, 120, 255, 0.34)', radius: 210, minStage: 1 },
      { building: 'endgame_facility', at: 'auraAnchor', color: 'rgba(250, 210, 120, 0.3)', radius: 150, minStage: 1 },
      { building: 'expedition_dock', at: 'lanternAnchor', color: 'rgba(255, 190, 100, 0.3)', radius: 100, minStage: 1, flicker: true },
    ],
    decorLights: {
      'prop.lanternPost': { color: 'rgba(255, 196, 110, 0.32)', radius: 80, dy: -84, flicker: true },
      'prop.campfire': { color: 'rgba(255, 150, 70, 0.4)', radius: 150, dy: -12, flicker: true },
      'magic.runeStone': { color: 'rgba(170, 120, 255, 0.25)', radius: 60, dy: -36 },
      'magic.crystalCluster': { color: 'rgba(170, 120, 255, 0.28)', radius: 70, dy: -30 },
      'magic.glowMushrooms': { color: 'rgba(90, 220, 230, 0.25)', radius: 50, dy: -10 },
      'prop.fountain': { color: 'rgba(120, 170, 255, 0.14)', radius: 120, dy: -40 },
    },
  },
  decorFx: {
    'prop.lanternPost': [{ slot: 'fx.lantern', dx: 9, dy: -84, glow: true }],
    'prop.campfire': [{ slot: 'fx.fire', dx: 0, dy: -6, glow: true }, { slot: 'fx.smoke', dx: 0, dy: -36 }],
    'prop.fountain': [{ slot: 'prop.fountainWater', dx: 0, dy: -30 }],
  },
  weatherPreset: 'MIST',
  bgmId: null,
};

// ------------------------------------------------------------------ Frozen Kingdom (cosmetic theme #2)

/**
 * a theme's layered skins = the Default Forest layer structure (same slots → the theme's own art, same FX anchors,
 * same footprints) with a new id per building, plus per-stage tweaks (extra / swapped layers). Never touches plots.
 */
function reskin(prefix: string, tweak: (building: string, stage: number, layers: SkinLayer[]) => SkinLayer[] = (_b, _s, l) => l): Record<string, BuildingSkin> {
  const out: Record<string, BuildingSkin> = {};
  for (const [id, skin] of Object.entries(DEFAULT_FOREST_SKINS)) {
    if (skin.kind !== 'LAYERED') continue;
    const stages: Record<number, SkinLayer[]> = {};
    for (const [st, layers] of Object.entries(skin.stages)) stages[+st] = tweak(id, +st, layers.map(x => ({ ...x })));
    out[id] = { id: skin.id.replace('default_forest', prefix), kind: 'LAYERED', stages };
  }
  return out;
}

export const FROZEN_KINGDOM_ID = 'frozen_kingdom';

export const FROZEN_KINGDOM_SKINS = reskin(FROZEN_KINGDOM_ID, (b, st, layers) => {
  if (b === 'equipment_workshop' && st >= 2) {
    // blue forge crystal hovering over the cold forge; arcane stage vents ice motes instead of violet sparks
    layers = layers.map(x => (x.slot === 'fx.particlesViolet' ? { ...x, slot: 'fx.particlesCyan' } : x));
    layers.push(L('building.forge.crystal', 'FX', at('forgeFireAnchor', { dy: -54, motion: 'bob', glow: true })));
  }
  if (b === 'expedition_dock' && st >= 1) layers.push(L('fx.particlesCyan', 'FX', at('lanternAnchor', { glow: true, dy: 20 })));
  return layers;
});

export const FROZEN_KINGDOM_THEME: IslandThemeDefinition = {
  id: FROZEN_KINGDOM_ID,
  name: 'Frozen Kingdom',
  free: true,
  assets: FROZEN_KINGDOM_ASSETS,
  terrainSet: { ground: 'terrain.ground', water: 'terrain.streamWater', waterfall: 'terrain.waterfall' },
  roadSet: { layer: 'road.layer', bridge: 'road.bridge' },
  backgroundSet: {
    sky: 'bg.sky',
    far: [{ slot: 'bg.mountains', y: 110, parallax: 0.25 }, { slot: 'bg.forestFar', y: 180, parallax: 0.5 }],
    clouds: ['bg.cloud1', 'bg.cloud2', 'bg.cloud3'],
    floatingRocks: ['bg.floatingRock1', 'bg.floatingRock2'],
    mist: 'bg.mist',
  },
  buildingSkins: FROZEN_KINGDOM_SKINS,
  treeSet: ['tree.largeA', 'tree.largeB', 'tree.mediumA', 'tree.mediumB', 'tree.small', 'tree.dead', 'tree.blossom'],
  vegetationSet: ['veg.bushA', 'veg.bushB', 'veg.fern', 'veg.tallGrass', 'veg.flowers', 'veg.mushrooms', 'veg.moss'],
  propSet: ['prop.barrel', 'prop.crate', 'prop.lanternPost', 'prop.signpost', 'prop.bench', 'prop.table', 'prop.cart', 'prop.firewood', 'prop.fountain', 'prop.campfire', 'prop.bannerBlue'],
  ambientFxSet: {
    fireflies: 'fx.fireflies', // ice glints
    foregroundBranches: ['fore.branchLeft', 'fore.branchRight'],
    weather: [
      { slot: 'weather.snowFar', seconds: 26, drift: 60, opacity: 0.7 },
      { slot: 'weather.snowNear', seconds: 14, drift: 140, opacity: 0.9 },
    ],
  },
  lightingPreset: {
    id: 'NIGHT',
    ambient: 'rgba(8, 20, 52, 0.26)',
    lights: [
      { building: 'tower', at: 'auraAnchor', color: 'rgba(120, 220, 255, 0.32)', radius: 380, minStage: 1, maxStage: 2 },
      { building: 'tower', at: 'auraAnchor', color: 'rgba(160, 120, 255, 0.34)', radius: 390, minStage: 3, maxStage: 4 },
      { building: 'tower', at: 'auraAnchor', color: 'rgba(250, 220, 150, 0.34)', radius: 430, minStage: 5 },
      { building: 'equipment_workshop', at: 'forgeFireAnchor', color: 'rgba(90, 170, 255, 0.46)', radius: 240, minStage: 1, flicker: true },
      { building: 'hero_hall', at: 'windowLightAnchor', color: 'rgba(255, 196, 120, 0.30)', radius: 250, minStage: 1 },
      { building: 'hero_hall', at: 'lanternAnchor', color: 'rgba(255, 200, 120, 0.32)', radius: 90, minStage: 1, flicker: true },
      { building: 'skill_shrine', at: 'runeAnchor', color: 'rgba(90, 220, 250, 0.36)', radius: 240, minStage: 1 },
      { building: 'ascension_shrine', at: 'crystalAnchor', color: 'rgba(180, 130, 255, 0.34)', radius: 210, minStage: 1 },
      { building: 'endgame_facility', at: 'auraAnchor', color: 'rgba(210, 230, 255, 0.28)', radius: 150, minStage: 1 },
      { building: 'expedition_dock', at: 'lanternAnchor', color: 'rgba(140, 210, 255, 0.30)', radius: 110, minStage: 1, flicker: true },
    ],
    decorLights: {
      'prop.lanternPost': { color: 'rgba(255, 206, 130, 0.30)', radius: 80, dy: -84, flicker: true },
      'prop.campfire': { color: 'rgba(90, 170, 255, 0.40)', radius: 150, dy: -12, flicker: true },
      'magic.runeStone': { color: 'rgba(170, 120, 255, 0.25)', radius: 60, dy: -36 },
      'magic.crystalCluster': { color: 'rgba(130, 210, 255, 0.30)', radius: 76, dy: -30 },
      'magic.glowMushrooms': { color: 'rgba(90, 220, 240, 0.25)', radius: 50, dy: -10 },
      'prop.fountain': { color: 'rgba(150, 210, 255, 0.18)', radius: 130, dy: -40 },
      'tree.blossom': { color: 'rgba(140, 215, 255, 0.28)', radius: 110, dy: -140 },
    },
  },
  decorFx: DEFAULT_FOREST_THEME.decorFx,
  weatherPreset: 'SNOW',
  bgmId: null,
};

export const ISLAND_THEMES: Record<string, IslandThemeDefinition> = { [DEFAULT_THEME_ID]: DEFAULT_FOREST_THEME, [FROZEN_KINGDOM_ID]: FROZEN_KINGDOM_THEME };

/** individual skins sold / granted later (building skin overrides) — empty in Patch 1 */
export const BUILDING_SKIN_LIBRARY: Record<string, BuildingSkin> = {};

export const themeOf = (id: string | undefined, themes = ISLAND_THEMES): IslandThemeDefinition => {
  const key = id ? THEME_ALIASES[id] ?? id : DEFAULT_THEME_ID;
  return themes[key] ?? themes[DEFAULT_THEME_ID] ?? DEFAULT_FOREST_THEME;
};

/** asset for a slot: the theme's, else the Default Forest one, else null (caller decides: skip decor / placeholder building) */
export function resolveAsset(theme: IslandThemeDefinition, slot: string): IslandAsset | null {
  return theme.assets[slot] ?? DEFAULT_FOREST_THEME.assets[slot] ?? null;
}

/**
 * skin priority: individual building skin override → theme building skin → Default Forest skin → placeholder.
 */
export function resolveBuildingSkin(
  buildingId: string,
  theme: IslandThemeDefinition,
  overrides: Record<string, string> = {},
  library: Record<string, BuildingSkin> = BUILDING_SKIN_LIBRARY,
): BuildingSkin {
  const o = overrides[buildingId];
  if (o && library[o]) return library[o];
  return theme.buildingSkins[buildingId] ?? DEFAULT_FOREST_SKINS[buildingId] ?? PLACEHOLDER_SKINS[buildingId];
}

/** a skin's entry for a stage (falls back to the highest defined stage ≤ requested) */
export function skinStage<T>(stages: Record<number, T>, stage: number): T {
  for (let s = stage; s >= 0; s--) if (stages[s]) return stages[s];
  return stages[Object.keys(stages).map(Number).sort((a, b) => a - b)[0]];
}

/**
 * the layers to draw for a building stage — or null when the layered skin's BASE art can't be resolved anywhere,
 * in which case the caller draws the placeholder (so a broken theme never hides a building)
 */
export function layersFor(skin: BuildingSkin, stage: number, theme: IslandThemeDefinition): { layer: SkinLayer; asset: IslandAsset }[] | null {
  if (skin.kind !== 'LAYERED') return null;
  const layers = skinStage(skin.stages, stage);
  const out: { layer: SkinLayer; asset: IslandAsset }[] = [];
  for (const layer of layers) {
    const asset = resolveAsset(theme, layer.slot);
    if (!asset) {
      if (layer.role === 'BASE') return null;
      continue; // optional animation / FX / light missing → static art still works
    }
    out.push({ layer, asset });
  }
  const order: SkinLayer['role'][] = ['SHADOW', 'BACK', 'BASE', 'PART', 'OVERLAY', 'LIGHT', 'FX'];
  return out.sort((a, b) => order.indexOf(a.layer.role) - order.indexOf(b.layer.role));
}
