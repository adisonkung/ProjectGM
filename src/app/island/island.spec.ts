import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { newGameState } from '../core/data/starter';
import {
  BUILDING_BY_ID, ISLAND_BUILDINGS, ISLAND_PLOTS, ISLAND_SAFE, ISLAND_STAGES, islandMask, MAX_EXTRA_ROAMERS, NAV_BY_ID, NAV_EDGES, NAV_NODES, PLOT_BY_ID,
} from '../core/data/island-layout';
import { DEFAULT_BUILDING_SKINS, DEFAULT_THEME_ID, ISLAND_THEMES, resolveBuildingSkin, skinStage } from '../core/data/island-themes';
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
const corners = (r: Rect): Vec2[] => [{ x: r.x, y: r.y }, { x: r.x + r.w, y: r.y }, { x: r.x, y: r.y + r.h }, { x: r.x + r.w, y: r.y + r.h }];

describe('Home Island — layout (shared by every player)', () => {
  it('every nav node and building footprint is inside the island mask with a margin', () => {
    for (const n of NAV_NODES) expect(islandMask(n.pos)).withContext(n.id).toBeLessThanOrEqual(ISLAND_SAFE);
    for (const p of ISLAND_PLOTS) for (const c of corners(p.buildingBounds)) expect(islandMask(c)).withContext(p.plotId).toBeLessThanOrEqual(ISLAND_SAFE);
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
        expect(islandMask(h.currentPosition)).toBeLessThanOrEqual(ISLAND_SAFE);
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

describe('Home Island — themes and skins (cosmetic only)', () => {
  it('the default theme exists, is free, and every building has a placeholder skin for every stage', () => {
    const t = ISLAND_THEMES[DEFAULT_THEME_ID];
    expect(t.free).toBeTrue();
    for (const b of ISLAND_BUILDINGS) {
      const skin = resolveBuildingSkin(b.id, t);
      expect(skin.kind).toBe('PLACEHOLDER');
      for (const s of b.visualStages) expect(skinStage(skin.stages as Record<number, unknown>, s.stage)).withContext(`${b.id} ${s.stage}`).toBeTruthy();
    }
  });

  it('themes carry no stat / reward fields', () => {
    const allowed = ['id', 'name', 'free', 'terrainAsset', 'backgroundAsset', 'towerSkin', 'buildingSkins', 'vegetationSet', 'ambientVfx', 'weatherPreset', 'lightingPreset', 'bgmId'];
    for (const t of Object.values(ISLAND_THEMES)) for (const k of Object.keys(t)) expect(allowed).withContext(k).toContain(k);
  });

  it('skin priority: individual override → theme skin → default; swapping to pixel art changes no gameplay data', () => {
    const sprite: BuildingSkin = { id: 'frozen_training', kind: 'SPRITE', stages: { 0: { src: 'x/ruin.png' }, 1: { src: 'x/training.png' } } };
    const gold: BuildingSkin = { id: 'gold_training', kind: 'SPRITE', stages: { 0: { src: 'x/gold.png' } } };
    const frozen: IslandThemeDefinition = { ...ISLAND_THEMES[DEFAULT_THEME_ID], id: 'frozen', buildingSkins: { training_ground: sprite } };
    const before = JSON.stringify({ b: BUILDING_BY_ID['training_ground'], p: PLOT_BY_ID['PLOT_A'] });
    expect(resolveBuildingSkin('training_ground', ISLAND_THEMES[DEFAULT_THEME_ID])).toBe(DEFAULT_BUILDING_SKINS['training_ground']);
    expect(resolveBuildingSkin('training_ground', frozen)).toBe(sprite);
    expect(resolveBuildingSkin('training_ground', frozen, { training_ground: 'gold_training' }, { gold_training: gold })).toBe(gold);
    expect(JSON.stringify({ b: BUILDING_BY_ID['training_ground'], p: PLOT_BY_ID['PLOT_A'] })).toBe(before);
  });

  it('setTheme accepts known themes only; unknown saved themes fall back to the default', () => {
    const s = newGameState();
    expect(setTheme(s.island!, 'nope')).toBeNull();
    expect(setTheme(s.island!, DEFAULT_THEME_ID)!.themeId).toBe(DEFAULT_THEME_ID);
    expect(normalizeIsland({ ...s.island!, themeId: 'deleted_theme' }, s).themeId).toBe(DEFAULT_THEME_ID);
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
    expect(el.querySelectorAll('g.bld').length).toBe(ISLAND_BUILDINGS.length);
    expect(el.querySelectorAll('g.bld.locked').length).toBe(ISLAND_BUILDINGS.length - 1);
    expect(el.querySelectorAll('g.hero').length).toBe(1 + roamerCount(0, 10));
    f.componentInstance.tapBuilding('equipment_workshop');
    f.detectChanges();
    expect(el.querySelector('.sheet')!.textContent).toContain('ผ่านหอคอยชั้น 6');
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
