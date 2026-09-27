import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { newGameState } from '../core/data/starter';
import {
  BUILDING_BY_ID, COAST_MARGIN, distToPoly, GROUND_POLY, insideIsland, ISLAND_BUILDINGS, ISLAND_DECOR, ISLAND_PLOTS, ISLAND_ROADS, ISLAND_STAGES, ISLAND_WORLD,
  MAX_EXTRA_ROAMERS, NAV_BY_ID, NAV_EDGES, NAV_NODES, PLATEAU_POLY, pointInPoly, PLOT_BY_ID, segDist, STREAM,
} from '../core/data/island-layout';
import {
  DEFAULT_FOREST_SKINS, DEFAULT_FOREST_THEME, DEFAULT_THEME_ID, ISLAND_THEMES, layersFor, PLACEHOLDER_SKINS, resolveAsset, resolveBuildingSkin, skinStage, themeOf,
} from '../core/data/island-themes';
import { DEFAULT_FOREST_ASSETS } from '../core/data/island/default-forest.assets';
import { FROZEN_KINGDOM_ASSETS } from '../core/data/island/frozen-kingdom.assets';
import { FROZEN_KINGDOM_SKINS, FROZEN_KINGDOM_THEME } from '../core/data/island-themes';
import { buildingDraw, decorDraw, lightsDraw } from './island-view-model';
import { BuildingSkin, IslandThemeDefinition, Rect, Vec2 } from '../core/models/island';
import {
  buildingStageAt, islandVisitView, newIsland, normalizeIsland, pickRoamers, roamerCount, setMainHero, setTheme, syncIsland, towerVisualStageAt, unlockFloorOf,
} from '../core/rules/island';
import { mulberry32 } from '../core/rules/island';
import { IslandService } from '../core/services/island.service';
import { migrate, SaveService } from '../core/services/save.service';
import { IslandComponent } from '../pages/island/island.component';
import { findPath, IslandSim } from './island-sim';

/** Patch 1 Home Island — layout, unlocks, events, roaming, themes, save, UI */

const inside = (p: Vec2, r: Rect, pad = 0) => p.x > r.x - pad && p.x < r.x + r.w + pad && p.y > r.y - pad && p.y < r.y + r.h + pad;
/** sample a segment every 2 units */
function segmentHits(a: Vec2, b: Vec2, r: Rect): boolean {
  const n = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 2);
  for (let i = 0; i <= n; i++) {
    const t = i / Math.max(1, n);
    if (inside({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }, r, 6)) return true;
  }
  return false;
}

describe('Home Island — layout (shared by every player)', () => {
  it('wide horizontal world (≥ 16:9, ~20:9) with left / centre / right districts', () => {
    expect(ISLAND_WORLD.w / ISLAND_WORLD.h).toBeGreaterThanOrEqual(2);
    const x = (id: string) => PLOT_BY_ID[BUILDING_BY_ID[id].plotId].position.x;
    expect(x('training_ground')).toBeLessThan(ISLAND_WORLD.w / 3); // left: training
    expect(x('hero_hall')).toBeLessThan(x('tower'));
    for (const id of ['equipment_workshop', 'skill_shrine', 'ascension_shrine', 'expedition_dock']) expect(x(id)).withContext(id).toBeGreaterThan(ISLAND_WORLD.w * 0.7);
    // the tower is off-centre (upper middle-right), not at the end of a straight central road
    expect(x('tower')).toBeGreaterThan(ISLAND_WORLD.w * 0.52);
    expect(PLOT_BY_ID['PLOT_TOWER'].position.y).toBeLessThan(NAV_BY_ID['plaza'].pos.y - 200);
  });

  it('every nav node is on the island (coast margin) and every building footprint stands on it', () => {
    for (const n of NAV_NODES) {
      expect(insideIsland(n.pos)).withContext(n.id).toBeTrue();
      expect(distToPoly(n.pos, GROUND_POLY)).withContext(n.id).toBeGreaterThanOrEqual(COAST_MARGIN);
    }
    for (const p of ISLAND_PLOTS) {
      const b = p.buildingBounds;
      for (const c of [{ x: b.x, y: b.y + b.h }, { x: b.x + b.w, y: b.y + b.h }]) expect(pointInPoly(c, GROUND_POLY)).withContext(p.plotId).toBeTrue();
    }
  });

  it('roads are organic: curved polylines (no straight axis), stream crossed only on bridges, the plateau only by stairs', () => {
    const bridged = new Set(ISLAND_ROADS.flatMap(r => (r.bridges ?? []).map(([a, b]) => `${a}|${b}`)));
    const stairs = new Set(ISLAND_ROADS.flatMap(r => (r.stairs ?? []).map(([a, b]) => `${a}|${b}`)));
    const wet = (p: { x: number; y: number }) => STREAM.points.slice(1).some((q, i) => segDist(p, STREAM.points[i], q) < STREAM.width / 2 + 8);
    for (const [a, b] of NAV_EDGES) {
      const pa = NAV_BY_ID[a].pos, pb = NAV_BY_ID[b].pos;
      const samples = Array.from({ length: 30 }, (_, i) => ({ x: pa.x + (pb.x - pa.x) * i / 29, y: pa.y + (pb.y - pa.y) * i / 29 }));
      if (samples.some(wet)) expect(bridged.has(`${a}|${b}`) || bridged.has(`${b}|${a}`)).withContext(`${a}-${b} crosses the stream`).toBeTrue();
      if (pointInPoly(pa, PLATEAU_POLY) !== pointInPoly(pb, PLATEAU_POLY)) expect(stairs.has(`${a}|${b}`) || stairs.has(`${b}|${a}`)).withContext(`${a}-${b} height change`).toBeTrue();
    }
    // main roads bend: consecutive segments change direction (no long straight run with ≥ 3 collinear nodes)
    for (const r of ISLAND_ROADS.filter(x => x.nodes.length >= 3)) {
      const turns = r.nodes.slice(2).map((c, i) => {
        const p0 = NAV_BY_ID[r.nodes[i]].pos, p1 = NAV_BY_ID[r.nodes[i + 1]].pos, p2 = NAV_BY_ID[c].pos;
        const a1 = Math.atan2(p1.y - p0.y, p1.x - p0.x), a2 = Math.atan2(p2.y - p1.y, p2.x - p1.x);
        return Math.abs(Math.atan2(Math.sin(a2 - a1), Math.cos(a2 - a1)));
      });
      expect(Math.max(...turns)).withContext(r.id).toBeGreaterThan(0.2);
    }
    // not a mirrored layout: left and right halves hold different numbers of plots
    const left = ISLAND_PLOTS.filter(p => p.position.x < ISLAND_WORLD.w / 2).length;
    expect(left).not.toBe(ISLAND_PLOTS.length - left);
  });

  it('environmental idle points exist (forge, dummy, shrine, tower view, bench, tree rest, dock view)', () => {
    const tags = new Set(NAV_NODES.map(n => n.tag).filter(Boolean));
    for (const t of ['ForgeWatchingPoint', 'TrainingDummyPoint', 'ShrineMeditationPoint', 'TowerViewPoint', 'BenchPoint', 'TreeRestPoint', 'DockViewPoint', 'MainHeroSpawn']) {
      expect(tags.has(t)).withContext(t).toBeTrue();
    }
    expect(NAV_BY_ID['plaza'].tag).toBe('MainHeroSpawn');
  });

  it('no nav node stands in, and no nav edge crosses, any building footprint (heroes never walk through buildings)', () => {
    for (const p of ISLAND_PLOTS) {
      for (const n of NAV_NODES) expect(inside(n.pos, p.buildingBounds, 6)).withContext(`${n.id} in ${p.plotId}`).toBeFalse();
      for (const [a, b] of NAV_EDGES) expect(segmentHits(NAV_BY_ID[a].pos, NAV_BY_ID[b].pos, p.buildingBounds)).withContext(`${a}-${b} x ${p.plotId}`).toBeFalse();
    }
  });

  it('the nav graph is connected and every plot / building points at real nodes', () => {
    for (const n of NAV_NODES) expect(findPath('plaza', n.id)).withContext(n.id).not.toBeNull();
    for (const [a, b] of NAV_EDGES) expect(NAV_BY_ID[a] && NAV_BY_ID[b]).toBeTruthy();
    for (const p of ISLAND_PLOTS) {
      expect(NAV_BY_ID[p.walkInteractionPosition]).withContext(p.plotId).toBeTruthy();
      for (const i of p.heroIdlePoints) expect(NAV_BY_ID[i]).withContext(i).toBeTruthy();
    }
    for (const b of ISLAND_BUILDINGS) {
      expect(PLOT_BY_ID[b.plotId]).withContext(b.id).toBeTruthy();
      expect(b.navigationTarget).toBe(PLOT_BY_ID[b.plotId].walkInteractionPosition);
    }
  });

  it('fixed plots: one building per plot, the tower in the tower plot, 8 functional plots + tower', () => {
    expect(new Set(ISLAND_BUILDINGS.map(b => b.plotId)).size).toBe(ISLAND_BUILDINGS.length);
    expect(BUILDING_BY_ID['tower'].plotId).toBe('PLOT_TOWER');
    expect(ISLAND_PLOTS.length).toBe(9);
  });
});

describe('Home Island — unlocks and visual stages', () => {
  it('a new account: only the tower is active, every other plot is a ruin / sealed / inactive (stage 0)', () => {
    const isl = newGameState().island!;
    expect(isl.unlockedBuildings).toEqual(['tower']);
    for (const b of ISLAND_BUILDINGS.filter(x => x.id !== 'tower')) expect(isl.buildingProgression[b.id].visualStage).withContext(b.id).toBe(0);
    expect(isl.towerVisualStage).toBe(0);
    expect(isl.islandProgressionStage).toBe(0);
    expect(isl.themeId).toBe(DEFAULT_THEME_ID);
  });

  it('unlock floors follow the Patch 1 plan (F3 training, F4 hall, F5 ascension, F6 workshop, F7 skill, F9 challenge, F10 endgame + dock)', () => {
    const got = Object.fromEntries(ISLAND_BUILDINGS.map(b => [b.id, unlockFloorOf(b)]));
    expect(got).toEqual({
      tower: 0, training_ground: 3, hero_hall: 4, ascension_shrine: 5, equipment_workshop: 6, skill_shrine: 7,
      challenge_board: 9, endgame_facility: 10, expedition_dock: 10,
    });
  });

  it('stage data is consistent: stage 0 at floor 0, stage 1 exactly at the unlock floor, thresholds rising', () => {
    for (const b of ISLAND_BUILDINGS) {
      const st = b.visualStages;
      expect(st[0].stage).toBe(0);
      expect(st[0].minFloor).toBe(0);
      if (b.id !== 'tower') expect(st[1].minFloor).withContext(b.id).toBe(unlockFloorOf(b));
      for (let i = 1; i < st.length; i++) expect(st[i].minFloor).toBeGreaterThan(st[i - 1].minFloor);
    }
  });

  it('tower visual stages 0 sealed → 1 F3 → 2 F5 → 3 F7 → 4 F9 → 5 F10; some floors upgrade instead of unlocking', () => {
    expect([0, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(towerVisualStageAt)).toEqual([0, 0, 1, 1, 2, 2, 3, 3, 4, 5]);
    expect(buildingStageAt(BUILDING_BY_ID['equipment_workshop'], 8).stage).toBe(2); // F8 = upgrade, not a new building
    expect(buildingStageAt(BUILDING_BY_ID['training_ground'], 9).stage).toBe(3);
  });

  it('return to island: progress made in the tower becomes queued events, in order, one per change', () => {
    const isl = newIsland(0, newGameState().heroes, newGameState().team);
    const r = syncIsland(isl, 5);
    const types = r.events.map(e => `${e.type}:${e.buildingId ?? '-'}`);
    expect(types[0]).toBe('TOWER_STAGE:tower');
    expect(types).toContain('BUILDING_UNLOCKED:training_ground');
    expect(types).toContain('BUILDING_UNLOCKED:hero_hall');
    expect(types).toContain('BUILDING_UNLOCKED:ascension_shrine');
    expect(types[types.length - 1]).toBe('ISLAND_STAGE:-');
    expect(r.island.pendingEvents.length).toBe(r.events.length);
    expect(syncIsland(r.island, 5).events.length).toBe(0); // nothing new → nothing queued
    const f10 = syncIsland(r.island, 10).events;
    expect(f10.filter(e => e.type === 'STRUCTURE_REVEALED').map(e => e.buildingId).sort()).toEqual(['endgame_facility', 'expedition_dock']);
    expect(f10.some(e => e.type === 'BUILDING_UPGRADED' && e.buildingId === 'training_ground' && e.stage === 3)).toBeTrue();
    expect(f10.some(e => e.type === 'BUILDING_UNLOCKED' && e.buildingId === 'equipment_workshop' && e.stage === 3)).toBeTrue(); // skipped floors: one event, final look
  });

  it('island stages grow with the tower and allow more roaming heroes (never above 5 extras)', () => {
    expect(ISLAND_STAGES.map(s => s.extraRoamers)).toEqual([1, 2, 3, 4, 5, 5]);
    expect(roamerCount(5, 50)).toBe(MAX_EXTRA_ROAMERS);
    expect(roamerCount(0, 1)).toBe(0);
  });
});

describe('Home Island — main hero, roamers, visit view', () => {
  it('main hero: defaults to the first team hero; only an owned hero can be set; not tied to team or stats', () => {
    const s = newGameState();
    expect(s.island!.mainIslandHeroId).toBe(s.team[0].uid);
    const bench = s.heroes.find(h => !s.team.some(t => t.uid === h.uid))!;
    const next = setMainHero(s.island!, s.heroes, bench.uid)!;
    expect(next.mainIslandHeroId).toBe(bench.uid);
    expect(setMainHero(s.island!, s.heroes, 9999)).toBeNull();
  });

  it('roamers: distinct owned heroes, never the main hero, team members first, deterministic per seed', () => {
    const s = newGameState();
    const main = s.island!.mainIslandHeroId;
    const a = pickRoamers(s.heroes, s.team, main, 4, 20260926);
    expect(a.length).toBe(4);
    expect(new Set(a.map(h => h.uid)).size).toBe(4);
    expect(a.some(h => h.uid === main)).toBeFalse();
    for (const h of a) expect(s.team.some(t => t.uid === h.uid)).toBeTrue(); // 4 teammates left besides the main hero
    expect(pickRoamers(s.heroes, s.team, main, 4, 20260926).map(h => h.uid)).toEqual(a.map(h => h.uid));
  });

  it('visit view: theme, tower stage, buildings, main hero and roamers — no gameplay data, same layout ids', () => {
    const s = newGameState();
    const v = islandVisitView(s, 1);
    expect(v.themeId).toBe(DEFAULT_THEME_ID);
    expect(v.buildings.map(b => b.buildingId)).toEqual(ISLAND_BUILDINGS.map(b => b.id));
    expect(v.mainHero!.uid).toBe(s.island!.mainIslandHeroId!);
    expect(v.roamers.length).toBe(roamerCount(0, s.heroes.length));
    expect(Object.keys(v)).not.toContain('inventory');
  });
});

describe('Home Island — roaming simulation', () => {
  const input = () => newGameState().heroes.slice(0, 6).map((h, i) => ({ uid: h.uid, templateId: h.templateId, cls: ['tank', 'fighter', 'assassin', 'archer', 'healer', 'mage'][i] as never, isMain: i === 0 }));

  it('180 s of roaming: heroes always on the island, never inside a building, keep moving, visit only built buildings', () => {
    const unlocked = ['tower', 'training_ground', 'hero_hall', 'ascension_shrine'];
    const sim = new IslandSim(input(), unlocked, mulberry32(7));
    const visited = new Map<number, Set<string>>();
    const buildings = new Set<string>();
    for (let t = 0; t < 180; t += 0.05) {
      sim.step(0.05);
      for (const h of sim.heroes) {
        expect(insideIsland(h.currentPosition)).toBeTrue();
        for (const p of ISLAND_PLOTS) expect(inside(h.currentPosition, p.buildingBounds)).withContext(`${h.heroId} in ${p.plotId}`).toBeFalse();
        (visited.get(h.heroId) ?? visited.set(h.heroId, new Set()).get(h.heroId)!).add(h.at);
        if (h.targetBuildingId) buildings.add(h.targetBuildingId);
        expect(['IDLE', 'WANDER', 'WALK_TO_BUILDING', 'BUILDING_IDLE', 'SOCIAL_IDLE', 'RETURN_TO_AREA']).toContain(h.currentState);
      }
    }
    for (const [uid, nodes] of visited) expect(nodes.size).withContext(`hero ${uid} stuck`).toBeGreaterThanOrEqual(3);
    for (const b of buildings) expect(unlocked).toContain(b);
    expect(buildings.size).toBeGreaterThan(0);
  });

  it('only the tower built: heroes still roam (plaza / tower), no crash, no locked building targeted', () => {
    const sim = new IslandSim(input().slice(0, 2), ['tower'], mulberry32(3));
    for (let t = 0; t < 60; t += 0.05) sim.step(0.05);
    for (const h of sim.heroes) expect(h.targetBuildingId === undefined || h.targetBuildingId === 'tower').toBeTrue();
  });
});

describe('Home Island — themes, assets and fallbacks (cosmetic only)', () => {
  const T = DEFAULT_FOREST_THEME;

  it('the Default Forest theme exists, is free, and every building stage resolves to real layered art', () => {
    expect(DEFAULT_THEME_ID).toBe('default_forest');
    expect(T.free).toBeTrue();
    for (const b of ISLAND_BUILDINGS) {
      const skin = resolveBuildingSkin(b.id, T);
      expect(skin.kind).withContext(b.id).toBe('LAYERED');
      for (const st of b.visualStages) {
        const layers = layersFor(skin, st.stage, T);
        expect(layers).withContext(`${b.id} ${st.stage}`).not.toBeNull();
        expect(layers!.some(l => l.layer.role === 'BASE')).withContext(`${b.id} ${st.stage} base`).toBeTrue();
      }
    }
  });

  it('every slot the theme references (skins, decor, background, fx) exists in the asset pack, with the naming convention', () => {
    const slots = new Set<string>();
    for (const skin of Object.values(DEFAULT_FOREST_SKINS)) if (skin.kind === 'LAYERED') for (const ls of Object.values(skin.stages)) for (const l of ls) slots.add(l.slot);
    for (const d of ISLAND_DECOR) slots.add(d.slot);
    for (const [slot, fx] of Object.entries(T.decorFx)) { slots.add(slot); fx.forEach(f => slots.add(f.slot)); }
    [T.terrainSet.ground, T.terrainSet.water!, T.terrainSet.waterfall!, T.roadSet.layer, T.roadSet.bridge!, T.backgroundSet.sky, T.backgroundSet.mist!,
      ...T.backgroundSet.far.map(f => f.slot), ...T.backgroundSet.clouds, ...T.backgroundSet.floatingRocks, T.ambientFxSet.fireflies!, ...T.ambientFxSet.foregroundBranches!,
      ...T.treeSet, ...T.vegetationSet, ...T.propSet].forEach(x => slots.add(x));
    for (const slot of slots) expect(DEFAULT_FOREST_ASSETS[slot]).withContext(slot).toBeDefined();
    for (const [slot, a] of Object.entries(DEFAULT_FOREST_ASSETS)) {
      expect(a.src).withContext(slot).toMatch(/^island\/default_forest\/[a-z]+\/island_default_[a-z]+_[a-z0-9_]+\.png$/);
      if (a.frames) expect(a.frames).withContext(slot).toBeGreaterThan(1);
    }
  });

  it('required animated assets exist as sprite sheets (smoke 6–10 f, fire 4–6 f, sparks, lantern, runes, particles, tower aura, flags)', () => {
    const f = (s: string) => DEFAULT_FOREST_ASSETS[s].frames ?? 1;
    expect(f('building.forge.fx.smoke')).toBeGreaterThanOrEqual(6); expect(f('building.forge.fx.smoke')).toBeLessThanOrEqual(10);
    expect(f('building.forge.fx.fire')).toBeGreaterThanOrEqual(4); expect(f('building.forge.fx.fire')).toBeLessThanOrEqual(6);
    expect(DEFAULT_FOREST_ASSETS['building.forge.fx.sparks'].loop).toBe('rare');
    for (const s of ['fx.lantern', 'fx.particlesCyan', 'fx.particlesViolet', 'building.tower.fx.aura.emerald', 'building.tower.fx.particles.emerald',
      'building.ascension.fx.runeCircle', 'training.banner', 'prop.bannerBlue', 'fx.fireflies', 'terrain.streamWater', 'terrain.waterfall']) expect(f(s)).withContext(s).toBeGreaterThan(1);
  });

  it('FX anchors used by skins exist on their plot (layout owns positions, the theme only names them)', () => {
    for (const b of ISLAND_BUILDINGS) {
      const skin = DEFAULT_FOREST_SKINS[b.id];
      if (skin.kind !== 'LAYERED') continue;
      for (const ls of Object.values(skin.stages)) for (const l of ls) if (l.at) expect(PLOT_BY_ID[b.plotId].fxAnchors[l.at]).withContext(`${b.id} ${l.at}`).toBeDefined();
    }
  });

  it('themes carry no stat / reward fields', () => {
    const allowed = ['id', 'name', 'description', 'free', 'assets', 'terrainSet', 'roadSet', 'backgroundSet', 'buildingSkins', 'treeSet', 'vegetationSet', 'propSet',
      'ambientFxSet', 'lightingPreset', 'decorFx', 'weatherPreset', 'bgmId'];
    for (const t of Object.values(ISLAND_THEMES)) for (const k of Object.keys(t)) expect(allowed).withContext(k).toContain(k);
    expect(JSON.stringify(T.lightingPreset)).not.toMatch(/"(atk|hp|def|exp|dropRate|bonus|power)"/i);
  });

  it('fallbacks: missing theme asset → Default Forest asset; missing base everywhere → placeholder (never hidden, never a crash)', () => {
    const empty: typeof T = { ...T, id: 'frozen_test', assets: {} };
    expect(resolveAsset(empty, 'training.dummy')).toBe(DEFAULT_FOREST_ASSETS['training.dummy']);
    expect(resolveAsset(empty, 'nope.slot')).toBeNull();
    // a theme whose training skin points at art nobody has → placeholder for that building, others still drawn
    const broken: typeof T = { ...T, id: 'broken_test', buildingSkins: { training_ground: { id: 'x', kind: 'LAYERED', stages: { 0: [{ slot: 'missing.base', role: 'BASE' }] } } } };
    const states = newIsland(3, newGameState().heroes, newGameState().team).buildingProgression;
    const d = buildingDraw(broken, states, {}, unlockFloorOf);
    expect(d.placeholders.map(p => p.building)).toEqual(['training_ground']);
    expect(d.hits.length).toBe(ISLAND_BUILDINGS.length);
    // missing optional FX layer → the building still draws its static base
    const noSmoke: typeof T = { ...T, assets: Object.fromEntries(Object.entries(T.assets).filter(([k]) => k !== 'fx.smoke')) };
    expect(layersFor(DEFAULT_FOREST_SKINS['hero_hall'], 1, { ...noSmoke, assets: noSmoke.assets } as typeof T)!.some(l => l.layer.role === 'BASE')).toBeTrue();
    expect(themeOf('ancient_forest').id).toBe(DEFAULT_THEME_ID);
  });

  it('skin priority: individual override → theme skin → Default Forest skin → placeholder; art swaps change no gameplay data', () => {
    const sprite: BuildingSkin = { id: 'frozen_training', kind: 'SPRITE', stages: { 0: { src: 'x/ruin.png' }, 1: { src: 'x/training.png' } } };
    const gold: BuildingSkin = { id: 'gold_training', kind: 'SPRITE', stages: { 0: { src: 'x/gold.png' } } };
    const frozen: IslandThemeDefinition = { ...T, id: 'frozen', buildingSkins: { training_ground: sprite } };
    const before = JSON.stringify({ b: BUILDING_BY_ID['training_ground'], p: PLOT_BY_ID['PLOT_A'] });
    expect(resolveBuildingSkin('training_ground', { ...T, buildingSkins: {} })).toBe(DEFAULT_FOREST_SKINS['training_ground']);
    expect(resolveBuildingSkin('training_ground', frozen)).toBe(sprite);
    expect(resolveBuildingSkin('training_ground', frozen, { training_ground: 'gold_training' }, { gold_training: gold })).toBe(gold);
    expect(PLACEHOLDER_SKINS['training_ground'].kind).toBe('PLACEHOLDER');
    expect(JSON.stringify({ b: BUILDING_BY_ID['training_ground'], p: PLOT_BY_ID['PLOT_A'] })).toBe(before);
  });

  it('island visibly develops: more building art, lights and FX at Floor 10 than on a new account', () => {
    const h = newGameState();
    const s0 = newIsland(0, h.heroes, h.team).buildingProgression, s10 = newIsland(10, h.heroes, h.team).buildingProgression;
    const d0 = buildingDraw(T, s0, {}, unlockFloorOf), d10 = buildingDraw(T, s10, {}, unlockFloorOf);
    expect(d10.sprites.length).toBeGreaterThan(d0.sprites.length + 10);
    expect(lightsDraw(T, s10).length).toBeGreaterThan(lightsDraw(T, s0).length);
    expect(decorDraw(T).length).toBeGreaterThan(60);
    // tower art changes with its stage (base sprite differs at 0 / 2 / 5)
    const towerBase = (st: number) => layersFor(DEFAULT_FOREST_SKINS['tower'], st, T)!.find(l => l.layer.role === 'BASE')!.asset.src;
    expect(new Set([towerBase(0), towerBase(2), towerBase(5)]).size).toBe(3);
  });

  it('setTheme accepts known themes only; unknown saved themes fall back to the default', () => {
    const s = newGameState();
    expect(setTheme(s.island!, 'nope')).toBeNull();
    expect(setTheme(s.island!, DEFAULT_THEME_ID)!.themeId).toBe(DEFAULT_THEME_ID);
    expect(normalizeIsland({ ...s.island!, themeId: 'deleted_theme' }, s).themeId).toBe(DEFAULT_THEME_ID);
    expect(normalizeIsland({ ...s.island!, themeId: 'ancient_forest' }, s).themeId).toBe(DEFAULT_THEME_ID);
  });
});

describe('Home Island — cosmetic themes (Frozen Kingdom, Sakura, Cursed, Celestial, Desert — visuals only)', () => {
  const D = DEFAULT_FOREST_THEME;
  const h = newGameState();
  const THEMES = Object.values(ISLAND_THEMES).filter(t => t.id !== DEFAULT_THEME_ID);
  const PREFIX: Record<string, string> = { frozen_kingdom: 'frozen', sakura_sanctuary: 'sakura', cursed_hollow: 'cursed', celestial_isle: 'celestial', desert_oasis: 'desert' };

  it('five extra themes are registered, each with a name, description and a full asset pack (every Default Forest slot re-drawn)', () => {
    expect(THEMES.map(t => t.id).sort()).toEqual(Object.keys(PREFIX).sort());
    expect(ISLAND_THEMES['frozen_kingdom']).toBe(FROZEN_KINGDOM_THEME);
    expect(FROZEN_KINGDOM_THEME.weatherPreset).toBe('SNOW');
    for (const t of THEMES) {
      expect(themeOf(t.id)).toBe(t);
      expect(t.name.length).withContext(t.id).toBeGreaterThan(3);
      expect(t.description?.length ?? 0).withContext(t.id).toBeGreaterThan(10);
      expect(t.ambientFxSet.weather?.length ?? 0).withContext(t.id).toBeGreaterThan(0);
      for (const w of t.ambientFxSet.weather!) {
        expect(resolveAsset(t, w.slot)).withContext(`${t.id} ${w.slot}`).not.toBeNull();
        expect(Number.isInteger(w.dx) && Number.isInteger(w.dy)).withContext(`${t.id} ${w.slot} seamless loop`).toBeTrue();
      }
      for (const slot of Object.keys(DEFAULT_FOREST_ASSETS)) expect(t.assets[slot]).withContext(`${t.id} ${slot}`).toBeDefined();
      const re = new RegExp(`^island\\/${t.id}\\/[a-z]+\\/island_${PREFIX[t.id]}_[a-z]+_[a-z0-9_]+\\.png$`);
      for (const [slot, a] of Object.entries(t.assets)) {
        expect(a.src).withContext(`${t.id} ${slot}`).toMatch(re);
        expect(a.src).withContext(slot).not.toBe(DEFAULT_FOREST_ASSETS[slot]?.src);
      }
    }
  });

  it('every building stage draws the theme own layered art (own skin ids), using only FX anchors the plot already has', () => {
    for (const t of THEMES) for (const b of ISLAND_BUILDINGS) {
      const skin = resolveBuildingSkin(b.id, t);
      expect(skin).withContext(`${t.id} ${b.id}`).toBe(t.buildingSkins[b.id]);
      expect(skin.id).withContext(b.id).toContain(t.id);
      for (const st of b.visualStages) {
        const base = layersFor(skin, st.stage, t)!.find(l => l.layer.role === 'BASE');
        expect(base?.asset.src).withContext(`${t.id} ${b.id} ${st.stage}`).toContain(t.id);
      }
      if (skin.kind === 'LAYERED') for (const ls of Object.values(skin.stages)) for (const l of ls) if (l.at) expect(PLOT_BY_ID[b.plotId].fxAnchors[l.at]).withContext(`${b.id} ${l.at}`).toBeDefined();
    }
  });

  it('keeps every footprint: building / training / road / terrain art has the Default Forest size, anchor and frame count', () => {
    for (const t of THEMES) for (const [slot, a] of Object.entries(DEFAULT_FOREST_ASSETS)) {
      if (!/^(building|training|road|terrain)\./.test(slot)) continue;
      const f = t.assets[slot];
      expect([f.w, f.h, f.ax, f.ay, f.frames ?? 1]).withContext(`${t.id} ${slot}`).toEqual([a.w, a.h, a.ax, a.ay, a.frames ?? 1]);
    }
    expect(FROZEN_KINGDOM_ASSETS['building.forge.crystal']).toBeDefined();
  });

  it('gameplay neutral: same tap areas, name plates, decoration spots, nav graph and save data — only the look changes', () => {
    const states = newIsland(10, h.heroes, h.team).buildingProgression;
    const dd = buildingDraw(D, states, {}, unlockFloorOf);
    const nav = JSON.stringify({ NAV_NODES, NAV_EDGES, ISLAND_PLOTS, ISLAND_BUILDINGS });
    const isl = newIsland(10, h.heroes, h.team);
    for (const t of THEMES) {
      const df = buildingDraw(t, states, {}, unlockFloorOf);
      expect(df.hits).withContext(t.id).toEqual(dd.hits);
      expect(df.placeholders.length).withContext(t.id).toBe(0);
      expect(decorDraw(t).length).withContext(t.id).toBe(decorDraw(D).length);
      const switched = setTheme(isl, t.id)!;
      expect({ ...switched, themeId: isl.themeId }).withContext(t.id).toEqual(isl);
      expect(switched.themeId).toBe(t.id);
      expect(JSON.stringify(t)).withContext(t.id).not.toMatch(/"(atk|hp|def|exp|dropRate|bonus|power|speed)"\s*:/i);
    }
    expect(JSON.stringify({ NAV_NODES, NAV_EDGES, ISLAND_PLOTS, ISLAND_BUILDINGS })).toBe(nav);
    // theme-only optional slots fall back to nothing (layer skipped), never to a hidden building
    expect(resolveAsset(D, 'building.forge.crystal')).toBeNull();
    expect(layersFor(FROZEN_KINGDOM_SKINS['equipment_workshop'], 3, D)!.some(l => l.layer.role === 'BASE')).toBeTrue();
  });
});

describe('Home Island — save / load', () => {
  it('old saves get an island matching their progress with no retroactive events', () => {
    const old = { ...newGameState(), cleared: 7 } as unknown as Record<string, unknown>;
    delete old['island'];
    const m = migrate(old)!;
    expect(m.island!.unlockedBuildings.sort()).toEqual(['ascension_shrine', 'equipment_workshop', 'hero_hall', 'skill_shrine', 'tower', 'training_ground']);
    expect(m.island!.pendingEvents).toEqual([]);
    expect(m.island!.towerVisualStage).toBe(3);
  });

  it('save → load keeps theme, main hero, buildings, tower stage and pending events; a sold main hero falls back', () => {
    const s = newGameState();
    const synced = syncIsland({ ...s.island!, mainIslandHeroId: s.heroes[6].uid }, 4).island;
    const loaded = migrate(JSON.parse(JSON.stringify({ ...s, cleared: 4, island: synced })))!;
    expect(loaded.island).toEqual(synced);
    const gone = migrate(JSON.parse(JSON.stringify({ ...s, heroes: s.heroes.slice(0, 5), island: { ...s.island!, mainIslandHeroId: s.heroes[8].uid } })))!;
    expect(gone.island!.mainIslandHeroId).toBe(s.team[0].uid);
  });

  it('no runtime asset / position data is saved', () => {
    const json = JSON.stringify(newGameState().island);
    for (const k of ['src', 'currentPosition', 'x":', 'png', 'webp']) expect(json).not.toContain(k);
  });
});

describe('Home Island — page', () => {
  beforeEach(() => localStorage.clear());

  async function mount(cleared = 0) {
    await TestBed.configureTestingModule({ imports: [IslandComponent], providers: [provideRouter([])] }).compileComponents();
    const save = TestBed.inject(SaveService);
    save.reset();
    save.update(s => ({ ...s, cleared }));
    const f = TestBed.createComponent(IslandComponent);
    f.detectChanges();
    return { f, el: f.nativeElement as HTMLElement, save, isl: TestBed.inject(IslandService) };
  }

  it('draws every plot, the main hero and the extra roamers; locked plots show their requirement', async () => {
    const { f, el } = await mount(0);
    expect(el.querySelectorAll('button.hit').length).toBe(ISLAND_BUILDINGS.length);
    expect(el.querySelectorAll('.plate.locked').length).toBe(ISLAND_BUILDINGS.length - 1);
    expect(el.querySelectorAll('app-island-hero').length).toBe(1 + roamerCount(0, 10));
    expect(el.querySelector('img[src*="tower_base_sealed"]')).not.toBeNull();
    f.componentInstance.tapBuilding('equipment_workshop');
    f.detectChanges();
    expect(el.querySelector('div.sheet[role="dialog"]')!.textContent).toContain('ผ่านหอคอยชั้น 6');
    f.destroy();
  });

  it('theme button on the island opens the picker; choosing a theme redraws the island and saves only the theme id', async () => {
    const { f, el, isl } = await mount(3);
    const before = JSON.stringify({ ...isl.island(), themeId: null });
    el.querySelector<HTMLButtonElement>('.hud.tr .theme-btn')!.click();
    f.detectChanges();
    const cards = el.querySelectorAll<HTMLButtonElement>('.themes-sheet .theme-card');
    expect(cards.length).toBe(Object.keys(ISLAND_THEMES).length);
    [...cards].find(c => c.textContent!.includes('Cursed Hollow'))!.click();
    f.detectChanges();
    expect(isl.island().themeId).toBe('cursed_hollow');
    expect(JSON.stringify({ ...isl.island(), themeId: null })).toBe(before);
    expect(el.querySelector('img[src*="island/cursed_hollow/"]')).not.toBeNull();
    expect(el.querySelectorAll('.weather').length).toBe(2);
    f.destroy();
  });

  it('tapping a built building offers its features and navigates', async () => {
    const { f, el } = await mount(0);
    const nav = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    f.componentInstance.tapBuilding('tower');
    f.detectChanges();
    const btn = el.querySelector<HTMLButtonElement>('.sheet .acts button')!;
    btn.click();
    expect(nav).toHaveBeenCalledWith(['/tower'], { queryParams: undefined });
    f.destroy();
  });

  it('progress while away plays as events one at a time; the building appears only once its event is revealed', async () => {
    const { f, el, isl } = await mount(3);
    expect(isl.island().pendingEvents.length).toBeGreaterThan(0);
    const c = f.componentInstance;
    expect(c.current()!.type).toBe('TOWER_STAGE');
    // training ground still shows as a ruin while its event waits in the queue
    expect(c.display()['training_ground'].isUnlocked).toBeFalse();
    c.nextEvent();
    f.detectChanges();
    expect(c.current()!.buildingId).toBe('training_ground');
    c.phase.set('reveal');
    f.detectChanges();
    expect(c.display()['training_ground'].isUnlocked).toBeTrue();
    expect(el.querySelector('.event.show')).not.toBeNull();
    c.skipEvents();
    f.detectChanges();
    expect(c.current()).toBeNull();
    expect(c.display()['training_ground'].isUnlocked).toBeTrue();
    f.destroy();
  });

  it('hero sheet: set as main hero updates the island (identity only)', async () => {
    const { f, el, isl, save } = await mount(0);
    const bench = save.state().heroes.find(h => !save.state().team.some(t => t.uid === h.uid))!;
    const teamBefore = JSON.stringify(save.state().team);
    f.componentInstance.tapHero(bench.uid);
    f.detectChanges();
    const btns = [...el.querySelectorAll<HTMLButtonElement>('.sheet.hero .acts button')];
    btns.find(b => b.textContent!.includes('ฮีโร่หลัก'))!.click();
    f.detectChanges();
    expect(isl.mainHeroUid()).toBe(bench.uid);
    expect(JSON.stringify(save.state().team)).toBe(teamBefore);
    f.destroy();
  });
});
