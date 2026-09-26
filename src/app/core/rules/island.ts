import { DEFAULT_THEME_ID, ISLAND_THEMES } from '../data/island-themes';
import { BUILDING_BY_ID, ISLAND_BUILDINGS, ISLAND_STAGES, MAX_EXTRA_ROAMERS } from '../data/island-layout';
import { HERO_BY_ID } from '../data/heroes';
import { GameState, TeamSlot } from '../models/game-state';
import { OwnedHero } from '../models/hero';
import { IslandBuildingDefinition, IslandBuildingState, IslandEvent, IslandVisitView, PlayerIsland } from '../models/island';

/**
 * Home Island rules — pure functions over the save. Everything visual is derived from `cleared` (tower floors) via
 * the building definitions; the renderer never decides what is unlocked.
 */

export const unlockFloorOf = (b: IslandBuildingDefinition) => (b.unlockRequirement.type === 'TOWER_FLOOR' ? b.unlockRequirement.floor : 0);
export const isBuildingUnlocked = (b: IslandBuildingDefinition, cleared: number) => cleared >= unlockFloorOf(b);

/** highest visual stage whose floor threshold is met (stage 0 = ruin / sealed / inactive) */
export function buildingStageAt(b: IslandBuildingDefinition, cleared: number): { stage: number; level: number; label: string } {
  let best = b.visualStages[0];
  for (const s of b.visualStages) if (cleared >= s.minFloor && s.stage >= best.stage) best = s;
  return { stage: best.stage, level: best.level, label: best.label };
}

export const towerVisualStageAt = (cleared: number) => buildingStageAt(BUILDING_BY_ID['tower'], cleared).stage;
export function islandStageAt(cleared: number): number {
  let s = 0;
  for (const x of ISLAND_STAGES) if (cleared >= x.minFloor) s = x.stage;
  return s;
}
export const islandStageName = (stage: number) => ISLAND_STAGES.find(s => s.stage === stage)?.name ?? '';

/** building states for a tower progress (custom skins carried over) */
export function deriveBuildings(cleared: number, prev: Record<string, IslandBuildingState> = {}): Record<string, IslandBuildingState> {
  const out: Record<string, IslandBuildingState> = {};
  for (const b of ISLAND_BUILDINGS) {
    const s = buildingStageAt(b, cleared);
    const unlocked = isBuildingUnlocked(b, cleared);
    out[b.id] = {
      buildingId: b.id, isUnlocked: unlocked, progressionLevel: unlocked ? s.level : 0, visualStage: s.stage,
      ...(prev[b.id]?.customSkinId ? { customSkinId: prev[b.id].customSkinId } : {}),
    };
  }
  return out;
}

/** main hero default: first hero of the current team, else the first owned hero */
export function defaultMainHero(heroes: OwnedHero[], team: TeamSlot[]): number | null {
  const owned = new Set(heroes.map(h => h.uid));
  return team.find(t => owned.has(t.uid))?.uid ?? heroes[0]?.uid ?? null;
}

/** a fresh island that matches the current progress (no pending events — nothing to "celebrate" retroactively) */
export function newIsland(cleared: number, heroes: OwnedHero[], team: TeamSlot[]): PlayerIsland {
  const buildingProgression = deriveBuildings(cleared);
  return {
    version: 1,
    themeId: DEFAULT_THEME_ID,
    mainIslandHeroId: defaultMainHero(heroes, team),
    unlockedBuildings: Object.values(buildingProgression).filter(b => b.isUnlocked).map(b => b.buildingId),
    buildingProgression,
    towerVisualStage: towerVisualStageAt(cleared),
    islandProgressionStage: islandStageAt(cleared),
    pendingEvents: [],
  };
}

/** load-time repair: unknown theme → default, missing / sold main hero → default, missing buildings → derived */
export function normalizeIsland(raw: Partial<PlayerIsland> | undefined, s: Pick<GameState, 'cleared' | 'heroes' | 'team'>): PlayerIsland {
  if (!raw || raw.version !== 1) return newIsland(s.cleared, s.heroes, s.team);
  const owned = new Set(s.heroes.map(h => h.uid));
  const base = newIsland(s.cleared, s.heroes, s.team);
  const prog = { ...base.buildingProgression };
  // keep the saved snapshot for known buildings (so progress made while away still produces events on the island)
  for (const [id, b] of Object.entries(raw.buildingProgression ?? {})) if (BUILDING_BY_ID[id]) prog[id] = { ...b, buildingId: id };
  return {
    version: 1,
    themeId: raw.themeId && ISLAND_THEMES[raw.themeId] ? raw.themeId : DEFAULT_THEME_ID,
    mainIslandHeroId: raw.mainIslandHeroId != null && owned.has(raw.mainIslandHeroId) ? raw.mainIslandHeroId : base.mainIslandHeroId,
    unlockedBuildings: Object.values(prog).filter(b => b.isUnlocked).map(b => b.buildingId),
    buildingProgression: prog,
    towerVisualStage: raw.towerVisualStage ?? base.towerVisualStage,
    islandProgressionStage: raw.islandProgressionStage ?? base.islandProgressionStage,
    pendingEvents: (raw.pendingEvents ?? []).filter(e => e.buildingId == null || !!BUILDING_BY_ID[e.buildingId]),
    ...(raw.buildingSkinOverrides ? { buildingSkinOverrides: raw.buildingSkinOverrides } : {}),
  };
}

/**
 * Compare the saved island with the tower progress → updated island + NEW progression events (appended to the queue).
 * Order: tower transformation, then buildings by the floor that caused them, island stage last.
 */
export function syncIsland(island: PlayerIsland, cleared: number): { island: PlayerIsland; events: IslandEvent[] } {
  const next = deriveBuildings(cleared, island.buildingProgression);
  const events: IslandEvent[] = [];
  const tower = towerVisualStageAt(cleared);
  if (tower > island.towerVisualStage) {
    events.push({ type: 'TOWER_STAGE', buildingId: 'tower', stage: tower, floor: BUILDING_BY_ID['tower'].visualStages[tower].minFloor });
  }
  const bEvents: IslandEvent[] = [];
  for (const b of ISLAND_BUILDINGS) {
    if (b.id === 'tower') continue;
    const was = island.buildingProgression[b.id];
    const now = next[b.id];
    const floor = b.visualStages.find(s => s.stage === now.visualStage)?.minFloor ?? 0;
    if (now.isUnlocked && !was?.isUnlocked) bEvents.push({ type: b.future ? 'STRUCTURE_REVEALED' : 'BUILDING_UNLOCKED', buildingId: b.id, stage: now.visualStage, floor });
    else if (now.visualStage > (was?.visualStage ?? 0)) bEvents.push({ type: 'BUILDING_UPGRADED', buildingId: b.id, stage: now.visualStage, floor });
  }
  bEvents.sort((a, b) => a.floor - b.floor);
  events.push(...bEvents);
  const stage = islandStageAt(cleared);
  if (stage > island.islandProgressionStage) events.push({ type: 'ISLAND_STAGE', buildingId: null, stage, floor: cleared });
  return {
    events,
    island: {
      ...island,
      buildingProgression: next,
      unlockedBuildings: Object.values(next).filter(b => b.isUnlocked).map(b => b.buildingId),
      towerVisualStage: Math.max(island.towerVisualStage, tower),
      islandProgressionStage: Math.max(island.islandProgressionStage, stage),
      pendingEvents: [...island.pendingEvents, ...events],
    },
  };
}

/** Main Island Hero: identity / cosmetic only — any owned hero, not tied to the team or stats */
export function setMainHero(island: PlayerIsland, heroes: OwnedHero[], uid: number): PlayerIsland | null {
  if (!heroes.some(h => h.uid === uid)) return null;
  return { ...island, mainIslandHeroId: uid };
}

/** cosmetic only; unknown themes are refused */
export function setTheme(island: PlayerIsland, themeId: string, themes = ISLAND_THEMES): PlayerIsland | null {
  return themes[themeId] ? { ...island, themeId } : null;
}

/** number of heroes roaming besides the main hero at an island stage (≤ owned − 1, ≤ MAX_EXTRA_ROAMERS) */
export function roamerCount(stage: number, owned: number): number {
  const want = ISLAND_STAGES.find(s => s.stage === stage)?.extraRoamers ?? 1;
  return Math.max(0, Math.min(want, MAX_EXTRA_ROAMERS, owned - 1));
}

/** deterministic small PRNG (roamer choice changes per day, stable within the day) */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** extra roamers: team members first ("recently used"), then a seeded shuffle of the rest; never the main hero */
export function pickRoamers(heroes: OwnedHero[], team: TeamSlot[], mainUid: number | null, count: number, seed: number): OwnedHero[] {
  const pool = heroes.filter(h => h.uid !== mainUid);
  const teamSet = new Set(team.map(t => t.uid));
  const rng = mulberry32(seed);
  const shuffled = pool.map(h => ({ h, k: rng() })).sort((a, b) => a.k - b.k).map(x => x.h);
  const ordered = [...shuffled.filter(h => teamSet.has(h.uid)), ...shuffled.filter(h => !teamSet.has(h.uid))];
  return ordered.slice(0, count);
}

export const daySeed = (d = new Date()) => d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();

/** everything another player needs to draw this island (future "Visit Island") — no gameplay data */
export function islandVisitView(s: Pick<GameState, 'heroes' | 'team' | 'island'>, seed = daySeed()): IslandVisitView {
  const isl = s.island!;
  const hero = (h: OwnedHero) => ({ uid: h.uid, templateId: h.templateId, name: HERO_BY_ID[h.templateId]?.name ?? h.templateId });
  const main = s.heroes.find(h => h.uid === isl.mainIslandHeroId) ?? null;
  return {
    themeId: isl.themeId,
    towerVisualStage: isl.towerVisualStage,
    islandProgressionStage: isl.islandProgressionStage,
    buildings: ISLAND_BUILDINGS.map(b => isl.buildingProgression[b.id]),
    skinOverrides: isl.buildingSkinOverrides ?? {},
    mainHero: main ? hero(main) : null,
    roamers: pickRoamers(s.heroes, s.team, isl.mainIslandHeroId, roamerCount(isl.islandProgressionStage, s.heroes.length), seed).map(hero),
  };
}
