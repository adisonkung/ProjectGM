import { BuildingSkin, IslandThemeDefinition, PlaceholderShape, PlaceholderStageStyle } from '../models/island';

/**
 * Island THEMES and building SKINS — cosmetic only. Nothing here is read by unlocks, navigation, collision or saves.
 * Today every skin is a PLACEHOLDER (simple geometry). Final pixel art = add a `kind: 'SPRITE'` skin and point the
 * theme at it; building definitions / plots / nav graph stay untouched.
 */

const ph = (shape: PlaceholderShape, fill: string, stroke: string, scale: number, icon: string, glow?: string): PlaceholderStageStyle =>
  ({ shape, fill, stroke, scale, icon, glow });
const RUIN = (icon: string) => ph('RUIN', '#3b3446', '#6b5f7e', 0.8, icon);

/** fallback skins (used when a theme has no entry for a building) — the Patch 1 placeholder look */
export const DEFAULT_BUILDING_SKINS: Record<string, BuildingSkin> = {
  tower: {
    id: 'default_tower', kind: 'PLACEHOLDER', stages: {
      0: ph('PILLAR', '#55506a', '#7d7896', 0.72, 'lock'),
      1: ph('PILLAR', '#5e5a78', '#b9a4ff', 0.8, 'tower', '#9b6bff55'),
      2: ph('PILLAR', '#676284', '#c9adff', 0.9, 'tower', '#9b6bff77'),
      3: ph('PILLAR', '#5b3f8a', '#d7c2ff', 0.95, 'bolt', '#b07cf0aa'),
      4: ph('PILLAR', '#4a2f78', '#f6dfa0', 1, 'crown', '#f0b54a99'),
      5: ph('PILLAR', '#8a6a2e', '#fff1c2', 1, 'crown', '#f6dfa0cc'),
    },
  },
  training_ground: {
    id: 'default_training', kind: 'PLACEHOLDER', stages: {
      0: RUIN('shield'), 1: ph('ROUNDED_RECT', '#2f6b3f', '#7fe0a0', 0.75, 'shield'),
      2: ph('ROUNDED_RECT', '#338048', '#9ff0b8', 0.9, 'shield'), 3: ph('ROUNDED_RECT', '#2a8a4a', '#d6ffe0', 1, 'shield', '#56c07a66'),
    },
  },
  hero_hall: {
    id: 'default_hall', kind: 'PLACEHOLDER', stages: {
      0: RUIN('heroes'), 1: ph('RECT', '#6b4a2e', '#d6a26e', 0.8, 'heroes'), 2: ph('RECT', '#7a5433', '#f0c890', 1, 'heroes', '#d9b46455'),
    },
  },
  ascension_shrine: {
    id: 'default_ascension', kind: 'PLACEHOLDER', stages: {
      0: RUIN('crown'), 1: ph('HEX', '#5a3a8a', '#c9adff', 0.8, 'crown', '#9b6bff55'), 2: ph('HEX', '#6a44a8', '#e6d6ff', 1, 'crown', '#b07cf0aa'),
    },
  },
  equipment_workshop: {
    id: 'default_workshop', kind: 'PLACEHOLDER', stages: {
      0: RUIN('armory'), 1: ph('RECT', '#8a4a1e', '#f0a060', 0.7, 'armory'),
      2: ph('RECT', '#9a5220', '#ffbf80', 0.88, 'flame', '#e0643a55'), 3: ph('RECT', '#7a3a8a', '#ffc8a0', 1, 'flame', '#e0643aaa'),
    },
  },
  skill_shrine: {
    id: 'default_skill', kind: 'PLACEHOLDER', stages: {
      0: RUIN('book'), 1: ph('CIRCLE', '#2a4f8a', '#8fc0ff', 0.8, 'book', '#4f9be855'), 2: ph('CIRCLE', '#2f5ea8', '#cfe4ff', 1, 'book', '#4f9be8aa'),
    },
  },
  challenge_board: {
    id: 'default_board', kind: 'PLACEHOLDER', stages: { 0: RUIN('scroll'), 1: ph('RECT', '#6a5a2a', '#f0d890', 0.85, 'scroll', '#d9b46444') },
  },
  endgame_facility: {
    id: 'default_memorial', kind: 'PLACEHOLDER', stages: { 0: ph('RUIN', '#2e2a3a', '#4a4458', 0.7, 'lock'), 1: ph('HEX', '#3a3050', '#f6dfa0', 0.95, 'skull', '#f0b54a66') },
  },
  expedition_dock: {
    id: 'default_dock', kind: 'PLACEHOLDER', stages: { 0: ph('LONG_RECT', '#3a2f28', '#6e5a48', 0.85, 'lock'), 1: ph('LONG_RECT', '#5a4432', '#d6b48a', 1, 'arrow', '#5ec8e044') },
  },
};

/** Patch 1 default theme — free, matches the Normal Forest tower biome */
export const DEFAULT_THEME_ID = 'ancient_forest';

export const ISLAND_THEMES: Record<string, IslandThemeDefinition> = {
  ancient_forest: {
    id: 'ancient_forest',
    name: 'Ancient Forest Island',
    free: true,
    terrainAsset: { kind: 'PLACEHOLDER', ground: '#2f4a2c', cliff: '#3b2e25', path: '#7a6a4e', plaza: '#6d6452', plot: '#3c5236' },
    backgroundAsset: { kind: 'PLACEHOLDER', skyTop: '#130f24', skyBottom: '#1f2d3a', water: '#10263a' },
    towerSkin: DEFAULT_BUILDING_SKINS['tower'],
    buildingSkins: {}, // every building falls back to DEFAULT_BUILDING_SKINS until forest art exists
    vegetationSet: { kind: 'PLACEHOLDER', colors: ['#2d6a3a', '#3d7f44', '#265a33', '#4a8a4a'] },
    ambientVfx: 'FIREFLIES',
    weatherPreset: 'MIST',
    lightingPreset: 'DUSK',
    bgmId: null,
  },
};

/** individual skins sold / granted later (building skin overrides) — empty in Patch 1 */
export const BUILDING_SKIN_LIBRARY: Record<string, BuildingSkin> = {};

export const themeOf = (id: string | undefined, themes = ISLAND_THEMES): IslandThemeDefinition => (id && themes[id]) || themes[DEFAULT_THEME_ID] || ISLAND_THEMES[DEFAULT_THEME_ID];

/**
 * skin priority: individual building skin override → theme building skin → default building skin.
 * (tower: override → theme.towerSkin → default)
 */
export function resolveBuildingSkin(
  buildingId: string,
  theme: IslandThemeDefinition,
  overrides: Record<string, string> = {},
  library: Record<string, BuildingSkin> = BUILDING_SKIN_LIBRARY,
): BuildingSkin {
  const o = overrides[buildingId];
  if (o && library[o]) return library[o];
  if (buildingId === 'tower') return theme.towerSkin ?? DEFAULT_BUILDING_SKINS['tower'];
  return theme.buildingSkins[buildingId] ?? DEFAULT_BUILDING_SKINS[buildingId];
}

/** a skin's style for a stage (falls back to the highest defined stage ≤ requested) */
export function skinStage<T>(stages: Record<number, T>, stage: number): T {
  for (let s = stage; s >= 0; s--) if (stages[s]) return stages[s];
  return stages[Object.keys(stages).map(Number).sort((a, b) => a - b)[0]];
}
