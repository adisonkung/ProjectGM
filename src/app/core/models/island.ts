/**
 * Home Island (Patch 1) — the player's personal hub. Four strictly separated layers:
 *
 *  1. LAYOUT (shared by every player, never saved per account): island mask, plots, navigation graph
 *  2. BUILDING DEFINITIONS (gameplay config): which plot, unlock requirement, visual stage thresholds, interactions
 *  3. THEMES / SKINS (cosmetic only): how a building / terrain looks — placeholder shapes today, pixel art later
 *  4. PLAYER ISLAND (save data): theme, main hero, unlocked buildings, levels / visual stages, pending events
 *
 * Swapping art = editing layer 3 only. Positions, collision, navigation, unlocks and saves never reference assets.
 */

// ------------------------------------------------------------------ 1. layout

/** world units: the island scene is a fixed portrait canvas (see ISLAND_WORLD) */
export interface Vec2 {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type PlotId =
  | 'PLOT_TOWER' | 'PLOT_A' | 'PLOT_B' | 'PLOT_C' | 'PLOT_D' | 'PLOT_E' | 'PLOT_F' | 'PLOT_G' | 'PLOT_H';

/** a fixed functional building slot — identical for every player */
export interface IslandPlotDefinition {
  plotId: PlotId;
  /** visual anchor (bottom-centre of the building footprint) */
  position: Vec2;
  /** navigation node in front of the building (heroes walk here; future "walk to building" target) */
  walkInteractionPosition: string;
  /** collision footprint — heroes never enter it, whatever the building looks like */
  buildingBounds: Rect;
  /** navigation nodes where a hero may idle for this building */
  heroIdlePoints: string[];
  /** nav nodes this plot's front node connects to (documentation / validation) */
  navigationLinks: string[];
}

export type NavNodeKind = 'PATH' | 'FRONT' | 'IDLE' | 'SOCIAL';
export interface NavNode {
  id: string;
  pos: Vec2;
  kind: NavNodeKind;
  /** area a hero drifts back to (RETURN_TO_AREA) */
  area?: 'PLAZA' | 'HOME';
}

/** undirected edge — every edge is a straight segment that stays inside the island and outside every footprint */
export type NavEdge = [string, string];

// ------------------------------------------------------------------ 2. buildings (gameplay config)

export type IslandBuildingType =
  | 'TOWER' | 'TRAINING_GROUND' | 'ASCENSION_SHRINE' | 'EQUIPMENT_WORKSHOP' | 'SKILL_SHRINE' | 'HERO_HALL'
  | 'ENDGAME_FACILITY' | 'EXPEDITION_DOCK' | 'CHALLENGE_BOARD';

/** what tapping the building does — resolved to routes in data, not in the renderer */
export type IslandInteractionType =
  | 'TOWER' | 'TRAINING' | 'ASCENSION' | 'WORKSHOP' | 'SKILL' | 'HERO_HALL' | 'CHALLENGE' | 'FUTURE';

export type UnlockRequirement =
  | { type: 'ALWAYS' }
  | { type: 'TOWER_FLOOR'; floor: number };

/** one progression stage of a building (0 = ruin / sealed / not built yet) */
export interface BuildingStageDefinition {
  stage: number;
  /** reached when the tower has this many floors cleared (stage 0 = always) */
  minFloor: number;
  label: string;
  /** functional level shown on the building (0 = inactive) */
  level: number;
}

export interface BuildingAction {
  label: string;
  route: string;
  query?: Record<string, string>;
  icon: string;
}

export interface IslandBuildingDefinition {
  id: string;
  plotId: PlotId;
  buildingType: IslandBuildingType;
  name: string;
  /** shown in the building sheet */
  description: string;
  unlockRequirement: UnlockRequirement;
  interactionType: IslandInteractionType;
  /** nav node heroes walk to (= its plot's walkInteractionPosition) */
  navigationTarget: string;
  /** ordered by stage; stage 0 = before unlock (ruin / sealed / inactive) */
  visualStages: BuildingStageDefinition[];
  /** theme skins that provide art for this building (informational — resolution goes through the theme) */
  availableThemeSkins: string[];
  actions: BuildingAction[];
  /** future hook: visible early, no gameplay yet */
  future?: boolean;
}

// ------------------------------------------------------------------ 3. themes / skins (cosmetic only)

export type PlaceholderShape = 'PILLAR' | 'ROUNDED_RECT' | 'RECT' | 'CIRCLE' | 'HEX' | 'CAPSULE' | 'RUIN' | 'LONG_RECT';

/** how one visual stage is drawn with simple geometry */
export interface PlaceholderStageStyle {
  shape: PlaceholderShape;
  fill: string;
  stroke: string;
  /** 0–1 share of the plot footprint the shape covers (growth = bigger shape) */
  scale: number;
  icon: string;
  glow?: string;
}

/** pixel-art sprite for one stage (later) — anchored bottom-centre on the plot position, sized by the footprint */
export interface SpriteStageStyle {
  src: string;
  /** sprite size in world units (defaults to the footprint) */
  w?: number;
  h?: number;
}

export type BuildingSkin =
  | { id: string; kind: 'PLACEHOLDER'; stages: Record<number, PlaceholderStageStyle> }
  | { id: string; kind: 'SPRITE'; stages: Record<number, SpriteStageStyle> };

/** visual-only theme. Deliberately has NO stat / reward fields (see island-themes.spec) */
export interface IslandThemeDefinition {
  id: string;
  name: string;
  free: boolean;
  terrainAsset: { kind: 'PLACEHOLDER'; ground: string; cliff: string; path: string; plaza: string; plot: string } | { kind: 'SPRITE'; src: string };
  backgroundAsset: { kind: 'PLACEHOLDER'; skyTop: string; skyBottom: string; water: string } | { kind: 'SPRITE'; src: string };
  towerSkin: BuildingSkin;
  /** building id → skin (missing → DEFAULT_BUILDING_SKINS) */
  buildingSkins: Record<string, BuildingSkin>;
  vegetationSet: { kind: 'PLACEHOLDER'; colors: string[] } | { kind: 'SPRITE'; srcs: string[] };
  ambientVfx: 'NONE' | 'FIREFLIES' | 'SNOW' | 'PETALS' | 'EMBERS';
  weatherPreset: 'CLEAR' | 'MIST' | 'SNOW' | 'RAIN';
  lightingPreset: 'DAY' | 'DUSK' | 'NIGHT';
  bgmId: string | null;
}

// ------------------------------------------------------------------ 4. player island (save data)

export interface IslandBuildingState {
  buildingId: string;
  isUnlocked: boolean;
  progressionLevel: number;
  visualStage: number;
  customSkinId?: string;
}

export type IslandEventType = 'BUILDING_UNLOCKED' | 'BUILDING_UPGRADED' | 'TOWER_STAGE' | 'STRUCTURE_REVEALED' | 'ISLAND_STAGE';
export interface IslandEvent {
  type: IslandEventType;
  /** building id (tower = 'tower'), or null for island stage */
  buildingId: string | null;
  stage: number;
  /** tower floor that caused it (ordering / text) */
  floor: number;
}

/** persisted per account — positions are NOT stored (they belong to the shared layout) */
export interface PlayerIsland {
  version: 1;
  themeId: string;
  /** owned hero uid shown as the player's representative (cosmetic / identity only) */
  mainIslandHeroId: number | null;
  unlockedBuildings: string[];
  buildingProgression: Record<string, IslandBuildingState>;
  towerVisualStage: number;
  islandProgressionStage: number;
  /** progression events not shown yet (played one at a time on the island) */
  pendingEvents: IslandEvent[];
  /** future cosmetic store: building id → skin id (overrides the theme) */
  buildingSkinOverrides?: Record<string, string>;
}

// ------------------------------------------------------------------ runtime (never saved)

export type IslandHeroActivity = 'IDLE' | 'WANDER' | 'WALK_TO_BUILDING' | 'BUILDING_IDLE' | 'SOCIAL_IDLE' | 'RETURN_TO_AREA';

export interface IslandHeroState {
  heroId: number;
  templateId: string;
  currentPosition: Vec2;
  currentState: IslandHeroActivity;
  /** nav node the hero stands on / walks to */
  targetWaypoint: string;
  targetBuildingId?: string;
  isMainHero: boolean;
}

/** what a visitor (or the owner) needs to draw someone's island — no gameplay data */
export interface IslandVisitView {
  themeId: string;
  towerVisualStage: number;
  islandProgressionStage: number;
  buildings: IslandBuildingState[];
  skinOverrides: Record<string, string>;
  mainHero: { uid: number; templateId: string; name: string } | null;
  roamers: { uid: number; templateId: string; name: string }[];
}
