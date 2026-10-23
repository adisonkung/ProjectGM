import '../../testing/legacy-roster';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ISLAND_BUILDINGS } from '../core/data/island-layout';
import { SKY_EDGES, SKY_NODES, SKY_PLOTS, SKY_SPAWN, SKY_WORLD } from '../core/data/sky-city';
import { newGameState } from '../core/data/starter';
import { normalizeIsland } from '../core/rules/island';
import { IslandService } from '../core/services/island.service';
import { SaveService } from '../core/services/save.service';
import { IslandComponent } from '../pages/island/island.component';
import { cityPath, CitySim } from './city-sim';

describe('Sky City — data', () => {
  it('every island building has a plot (hit, plate, focus, front node); every landmark except the tower has art', () => {
    for (const b of ISLAND_BUILDINGS) {
      const p = SKY_PLOTS[b.id];
      expect(p).withContext(b.id).toBeDefined();
      expect(SKY_NODES[p.front]).withContext(`${b.id} front`).toBeDefined();
      expect(!!p.art).withContext(b.id).toBe(b.id !== 'tower');
    }
  });

  it('art, hit areas and nodes lie inside the world', () => {
    for (const p of Object.values(SKY_PLOTS)) {
      const boxes = [p.hit, ...(p.art ? [p.art] : [])];
      for (const r of boxes) {
        expect(r.x).withContext(p.id).toBeGreaterThanOrEqual(0);
        expect(r.y).withContext(p.id).toBeGreaterThanOrEqual(0);
        expect(r.x + r.w).withContext(p.id).toBeLessThanOrEqual(SKY_WORLD.w);
        expect(r.y + r.h).withContext(p.id).toBeLessThanOrEqual(SKY_WORLD.h);
      }
    }
    for (const [id, n] of Object.entries(SKY_NODES)) {
      expect(n.x > 0 && n.x < SKY_WORLD.w && n.y > 0 && n.y < SKY_WORLD.h).withContext(id).toBeTrue();
    }
  });

  it('the walking graph is connected (both satellite islets reachable over the chain bridges)', () => {
    for (const [a, b] of SKY_EDGES) expect(SKY_NODES[a] && SKY_NODES[b]).withContext(`${a}-${b}`).toBeTruthy();
    for (const id of Object.keys(SKY_NODES)) expect(cityPath(SKY_SPAWN, id)).withContext(id).not.toBeNull();
    expect(cityPath('temple_c', 'harbor_c')!.length).toBeGreaterThan(4);
  });
});

describe('Sky City — hero roaming', () => {
  it('heroes walk the road graph only, then rest on a node; visits go to unlocked landmark fronts', () => {
    let seed = 1;
    const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const sim = new CitySim([{ uid: 1, templateId: 'aurel', cls: 'tank', isMain: true }, { uid: 2, templateId: 'jin', cls: 'fighter', isMain: false }],
      ['tower', 'hero_hall'], rng);
    expect(sim.heroes[0].currentPosition).toEqual(SKY_NODES[SKY_SPAWN]);
    const visited = new Set<string>();
    for (let t = 0; t < 600; t++) {
      sim.step(0.1);
      for (const h of sim.heroes) {
        if (!h.walking) {
          visited.add(h.at);
          expect(h.currentPosition).toEqual(SKY_NODES[h.at]);
        }
      }
    }
    expect(visited.size).toBeGreaterThan(3);
    expect([...visited].some(n => n === SKY_PLOTS['hero_hall'].front || n === SKY_PLOTS['tower'].front)).toBeTrue();
  });
});

describe('Sky City — map choice', () => {
  it('the Sky City is the default map; a classic theme switches to the classic island; map survives save → load', () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const save = TestBed.inject(SaveService);
    const isl = TestBed.inject(IslandService);
    save.reset();
    expect(isl.isCity()).toBeTrue();
    expect(isl.setTheme('frozen_kingdom')).toBeTrue();
    expect(isl.isCity()).toBeFalse();
    expect(isl.island().themeId).toBe('frozen_kingdom');
    const s = save.state();
    expect(normalizeIsland(JSON.parse(JSON.stringify(s.island)), s).map).toBe('classic');
    isl.setMap('city');
    expect(isl.isCity()).toBeTrue();
    expect(isl.island().themeId).toBe('frozen_kingdom'); // the classic theme is remembered for later
    expect(normalizeIsland({ ...newGameState().island!, map: 'nope' as never }, s).map).toBeUndefined();
  });

  it('the island page draws the Sky City: base art, unlocked landmarks, every plate; a reveal makes the landmark rise', async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({ imports: [IslandComponent], providers: [provideRouter([])] }).compileComponents();
    const save = TestBed.inject(SaveService);
    save.reset();
    save.update(s => ({ ...s, cleared: 6 }));
    const f = TestBed.createComponent(IslandComponent);
    f.detectChanges();
    const c = f.componentInstance;
    c.skipEvents();
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    // The playable city must be visible immediately; the former panorama hid every plot.
    expect(el.querySelector('.citadel-vista')).toBeNull();
    expect(el.querySelector('app-sky-city')).not.toBeNull();
    expect(el.querySelector('app-island-scene')).toBeNull();
    expect(el.querySelector('img.base[src*="sky_city/base"]')).not.toBeNull();
    const unlocked = ISLAND_BUILDINGS.filter(b => b.id !== 'tower' && c.display()[b.id].isUnlocked).length;
    expect(el.querySelectorAll('img.landmark').length).toBe(unlocked);
    expect(el.querySelectorAll('.plate').length).toBe(ISLAND_BUILDINGS.length);
    expect(el.querySelectorAll('svg.circle').length).toBe(ISLAND_BUILDINGS.length - 1 - unlocked);
    // focus / reveal: the training yard rises
    save.update(s => ({ ...s, island: { ...s.island!, pendingEvents: [{ type: 'BUILDING_UNLOCKED', buildingId: 'training_ground', stage: 1, floor: 3 }] } }));
    f.detectChanges();
    expect(c.focus()).toEqual(SKY_PLOTS['training_ground'].focus);
    c.phase.set('reveal');
    f.detectChanges();
    expect(el.querySelector('img.landmark.rise[src*="training_ground"]')).not.toBeNull();
    // Cosmetic map switching keeps progression intact and exposes the chosen playable scene.
    const beforeSwitch = { ...save.state().island, map: null };
    c.setMap('classic');
    f.detectChanges();
    expect({ ...save.state().island, map: null }).toEqual(beforeSwitch);
    expect(el.querySelector('app-island-scene')).not.toBeNull();
    expect(el.querySelector('app-sky-city')).toBeNull();
    f.destroy();
  });
});
