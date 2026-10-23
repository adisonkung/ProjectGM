import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { AppComponent, LOBBY_NAV, MAIN_NAV } from './app.component';
import { ISLAND_BUILDINGS } from './core/data/island-layout';
import { FARM_DUNGEONS } from './core/data/economy';
import { actionUnlockFloor } from './core/rules/island';
import { DUNGEON_TYPES } from './pages/dungeons/dungeons.component';

@Component({ template: '' })
class NavigationTestPage {}

describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [provideRouter([{ path: 'home', component: NavigationTestPage }, { path: 'heroes', component: NavigationTestPage }, { path: 'heroes/:uid', component: NavigationTestPage }, { path: 'account', component: NavigationTestPage }, { path: 'gacha', component: NavigationTestPage }, { path: 'tower', component: NavigationTestPage }, { path: 'dungeons/:type', component: NavigationTestPage }])],
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

  it('uses six destinations on Home, summon and collection pages, without exposing a floor-locked feature', async () => {
    const fixture = TestBed.createComponent(AppComponent);
    const router = TestBed.inject(Router);
    fixture.detectChanges();
    await router.navigateByUrl('/home');
    fixture.detectChanges();
    const links = () => [...(fixture.nativeElement as HTMLElement).querySelectorAll('nav a')].map(a => a.getAttribute('href'));
    expect(links()).toEqual(['/home', '/heroes', '/team', '/armory', '/gacha', '/tower']);
    expect(fixture.nativeElement.querySelector('nav a[aria-current="page"]').getAttribute('href')).toBe('/home');
    const buildingActions = ISLAND_BUILDINGS.flatMap(b => b.actions.map(a => ({ route: a.route, floor: actionUnlockFloor(b, a) })));
    for (const n of LOBBY_NAV.filter(n => !MAIN_NAV.some(core => core.path === n.path))) {
      expect(buildingActions.some(a => a.route === n.path && a.floor === 0)).withContext(n.path).toBeTrue();
    }
    await router.navigateByUrl('/gacha');
    fixture.detectChanges();
    expect(links()).toEqual(LOBBY_NAV.map(n => n.path));
    expect(fixture.nativeElement.querySelector('nav a[aria-current="page"]').getAttribute('href')).toBe('/gacha');
    await router.navigateByUrl('/heroes');
    fixture.detectChanges();
    expect(links()).toEqual(LOBBY_NAV.map(n => n.path));
    expect(fixture.componentInstance.immersive()).toBeFalse();
    expect(fixture.componentInstance.collection()).toBeTrue();
  });

  it('keeps adventure navigation active and document scrolling on tower and dungeon pages', async () => {
    const fixture = TestBed.createComponent(AppComponent); fixture.detectChanges();
    for (const route of ['/tower', '/dungeons/hunt']) {
      await TestBed.inject(Router).navigateByUrl(route); fixture.detectChanges();
      expect(fixture.componentInstance.fantasy()).toBeTrue();
      expect(fixture.componentInstance.immersive()).toBeFalse();
      expect(fixture.nativeElement.querySelector('nav a[aria-current="page"]').getAttribute('href')).toBe('/tower');
    }
  });

  it('retains the six destinations and scrolling when opening a hero or account', async () => {
    const fixture = TestBed.createComponent(AppComponent); fixture.detectChanges();
    for (const route of ['/heroes/1', '/account']) {
      await TestBed.inject(Router).navigateByUrl(route); fixture.detectChanges();
      expect(fixture.componentInstance.collection()).toBeTrue();
      expect(fixture.componentInstance.immersive()).toBeFalse();
      expect(fixture.nativeElement.querySelectorAll('nav.menu a').length).toBe(6);
      expect(fixture.componentInstance.active()).toBe(route.startsWith('/heroes') ? '/heroes' : null);
    }
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
