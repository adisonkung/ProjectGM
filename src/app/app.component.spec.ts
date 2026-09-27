import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AppComponent, MAIN_NAV } from './app.component';
import { ISLAND_BUILDINGS } from './core/data/island-layout';
import { FARM_DUNGEONS } from './core/data/economy';
import { actionUnlockFloor } from './core/rules/island';
import { DUNGEON_TYPES } from './pages/dungeons/dungeons.component';

describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('main menu = core loops only (island · heroes · team · summon); island-hub pages are reached from the island', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const links = [...(fixture.nativeElement as HTMLElement).querySelectorAll('nav a')].map(a => a.getAttribute('href'));
    expect(links).toEqual(['/home', '/heroes', '/team', '/gacha']);
    for (const p of ['/tower', '/dungeons', '/forge', '/armory', '/lab']) expect(links).not.toContain(p);
  });

  it('island-hub pages (tower, dungeons, forge, armory, battle) light up the island tab', () => {
    const island = MAIN_NAV.find(n => n.path === '/home')!;
    for (const p of ['/tower', '/dungeons', '/forge', '/armory', '/battle', '/lab']) expect(island.match).withContext(p).toContain(p);
  });

  it('every page removed from the menu is still reachable from an island building', () => {
    const routes = new Set(ISLAND_BUILDINGS.flatMap(b => b.actions.map(a => a.route.split('/').slice(0, 2).join('/'))));
    for (const p of ['/tower', '/dungeons', '/forge', '/armory', '/lab']) expect(routes).withContext(p).toContain(p);
  });

  it('a feature opens on the island on the same floor as the feature itself (ruins still work) — dungeon floors match FARM_DUNGEONS', () => {
    for (const b of ISLAND_BUILDINGS) {
      for (const a of b.actions) {
        const m = /^\/dungeons\/(\w+)/.exec(a.route);
        if (!m) continue;
        const pool = DUNGEON_TYPES.find(t => t.id === m[1])!.pool;
        const first = Math.min(...FARM_DUNGEONS.filter(d => d.dailyBonusPool === pool).map(d => d.unlockFloor));
        expect(actionUnlockFloor(b, a)).withContext(a.route).toBe(first);
      }
    }
  });
});
