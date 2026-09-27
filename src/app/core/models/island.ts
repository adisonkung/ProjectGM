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

/** world units: the island is a fixed wide canvas (see ISLAND_WORLD); art is authored at 1 px = PIXEL_SCALE world units */
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
  /** where the building's art is drawn relative to `position` (world units) — lets a theme hang art over a cliff edge etc. */
  visualOffset: Vec2;
  /** named FX anchors relative to `position` (world units): chimneySmokeAnchor, forgeFireAnchor, auraAnchor … */
  fxAnchors: Record<string, Vec2>;
}

export type NavNodeKind = 'PATH' | 'FRONT' | 'IDLE' | 'SOCIAL';
export interface NavNode {
  id: string;
  pos: Vec2;
  kind: NavNodeKind;
  /** area a hero drifts back to (RETURN_TO_AREA) */
  area?: 'PLAZA' | 'HOME';
  /** environmental idle point name (ForgeWatchingPoint, TowerViewPoint, BenchPoint …) */
  tag?: string;
}

export type RoadKind = 'MAIN' | 'SECONDARY' | 'TRAIL' | 'BROKEN';
/** a road = a spline through nav nodes (drawn by the theme's road layer; walked along its nodes) */
export interface IslandRoad {
  id: string;
  kind: RoadKind;
  width: number;
  nodes: string[];
  stairs?: [string, string][];
  bridges?: [string, string][];
}

export type DecorLayer = 'far' | 'mid' | 'fore';
/** a decoration spot: the layout says WHERE and WHAT KIND (semantic slot), the theme says what it looks like */
export interface IslandDecor {
  slot: string;
  x: number;
  y: number;
  layer: DecorLayer;
  flip?: boolean;
  /** ambient motion (leaf / grass sway, bob) — cosmetic */
  sway?: boolean;
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

/** one generated / painted image (native pixels; the scene scales by PIXEL_SCALE). Sheets are horizontal strips. */
export interface IslandAsset {
  src: string;
  /** one frame, native px */
  w: number;
  h: number;
  /** anchor inside the frame (native px) — placed on the world point */
  ax: number;
  ay: number;
  frames?: number;
  fps?: number;
  /** 'rare' = plays once every few seconds (sparks, energy pulse) */
  loop?: 'rare';
}

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

/** pixel-art sprite for one stage — anchored bottom-centre on the plot position, sized by the footprint */
export interface SpriteStageStyle {
  src: string;
  w?: number;
  h?: number;
}

/** ambient CSS motion for a static layer (animation never affects gameplay) */
export type LayerMotion = 'pulse' | 'flicker' | 'bob' | 'breathe' | 'sway';

/**
 * one layer of a building stage: an asset SLOT (resolved through the theme, falling back to Default Forest),
 * placed at the plot position (+ visualOffset) or at a named FX anchor (+ dx/dy, world units)
 */
export interface SkinLayer {
  slot: string;
  /** draw order inside the building: SHADOW → BACK (behind, e.g. aura / ground runes) → BASE → PART → OVERLAY → LIGHT → FX */
  role: 'SHADOW' | 'BACK' | 'BASE' | 'PART' | 'OVERLAY' | 'LIGHT' | 'FX';
  at?: string;
  dx?: number;
  dy?: number;
  motion?: LayerMotion;
  /** additive-looking light (CSS screen blend) */
  glow?: boolean;
  /** mirror horizontally */
  flip?: boolean;
}

export type BuildingSkin =
  | { id: string; kind: 'PLACEHOLDER'; stages: Record<number, PlaceholderStageStyle> }
  | { id: string; kind: 'SPRITE'; stages: Record<number, SpriteStageStyle> }
  | { id: string; kind: 'LAYERED'; stages: Record<number, SkinLayer[]> };

/** localized light pools (radial glows over the scene) — per building / anchor */
export interface LightDef {
  building: string;
  at?: string;
  dx?: number;
  dy?: number;
  color: string;
  radius: number;
  /** only between these visual stages of the building */
  minStage?: number;
  maxStage?: number;
  flicker?: boolean;
}

/** light that follows every decoration of a slot (lantern posts, campfire …) */
export interface DecorLightDef {
  color: string;
  radius: number;
  dy?: number;
  flicker?: boolean;
}

/** visual-only theme manifest. Deliberately has NO stat / reward fields (see island.spec) */
export interface IslandThemeDefinition {
  id: string;
  name: string;
  /** one-line flavour text for the theme picker */
  description?: string;
  free: boolean;
  /** slot → asset. Missing slots fall back to the Default Forest theme (never crash, never hide a building) */
  assets: Record<string, IslandAsset>;
  terrainSet: { ground: string; water?: string; waterfall?: string };
  roadSet: { layer: string; bridge?: string };
  backgroundSet: { sky: string; far: { slot: string; y: number; parallax: number }[]; clouds: string[]; floatingRocks: string[]; mist?: string };
  /** building id → skin (missing → Default Forest skin → placeholder) */
  buildingSkins: Record<string, BuildingSkin>;
  /** decoration slot families this theme provides (informational — placement lives in the layout) */
  treeSet: string[];
  vegetationSet: string[];
  propSet: string[];
  ambientFxSet: {
    fireflies?: string;
    foregroundBranches?: string[];
    /**
     * weather overlay layers — seamless tiles scrolled by CSS (cosmetic only, never read by gameplay).
     * One loop moves the tile by (dx, dy) whole tiles (keeps the loop seamless); negative dy = rising (embers, motes).
     */
    weather?: { slot: string; seconds: number; dx: number; dy: number; opacity?: number }[];
  };
  lightingPreset: { id: 'DAY' | 'DUSK' | 'NIGHT'; ambient: string; lights: LightDef[]; decorLights: Record<string, DecorLightDef> };
  /** animated sprites attached to decoration slots (campfire flame, fountain water, lantern flame) */
  decorFx: Record<string, { slot: string; dx: number; dy: number; glow?: boolean }[]>;
  weatherPreset: 'CLEAR' | 'MIST' | 'SNOW' | 'RAIN';
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
