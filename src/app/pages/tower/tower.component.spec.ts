import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { provideRouter } from '@angular/router';
import { SaveService } from '../../core/services/save.service';
import { TowerComponent } from './tower.component';
import { TowerLayout } from './tower-layout';
import { climbHeight, climbRail } from './tower-climb-art';
import { TOWER_REWARDS } from '../../core/data/economy';

describe('TowerComponent', () => {
  let component: TowerComponent;
  let fixture: ComponentFixture<TowerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TowerComponent],
      providers: [provideRouter([]), { provide: TowerLayout, useValue: { desktop: signal(false) } }],
    })
    .compileComponents();

    fixture = TestBed.createComponent(TowerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('previews locked floors without exposing an entry link or changing the save', () => {
    const save = TestBed.inject(SaveService);
    save.update(s => ({ ...s, cleared: 0 })); fixture.detectChanges();
    const before = save.state();
    component.focusedFloor.set(10); fixture.detectChanges();
    const preview = (fixture.nativeElement as HTMLElement).querySelector('.floor-preview')!;
    expect(preview.querySelector('a')).toBeNull();
    expect(preview.textContent).toContain('พิชิตชั้น 9');
    expect(save.state()).toBe(before);
  });

  it('defaults to the next floor and retains replay entry for cleared floors', () => {
    TestBed.inject(SaveService).update(s => ({ ...s, cleared: 3 })); fixture.detectChanges();
    expect(component.selected().floor).toBe(4);
    let enter = (fixture.nativeElement as HTMLElement).querySelector('.floor-preview a')!;
    expect(enter.getAttribute('href')).toBe('/battle?floor=4&mode=tower');
    component.focusedFloor.set(1); fixture.detectChanges();
    enter = (fixture.nativeElement as HTMLElement).querySelector('.floor-preview a')!;
    expect(enter.getAttribute('href')).toBe('/battle?floor=1&mode=tower');
    expect(enter.textContent).toContain('สู้อีกครั้ง');
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

describe('Tower desktop Milestone Climb', () => {
  let component: TowerComponent;
  let fixture: ComponentFixture<TowerComponent>;
  let el: HTMLElement;
  let save: SaveService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TowerComponent],
      providers: [provideRouter([]), { provide: TowerLayout, useValue: { desktop: signal(true) } }],
    }).compileComponents();
    save = TestBed.inject(SaveService);
    save.update(s => ({ ...s, cleared: 3 }));
    fixture = TestBed.createComponent(TowerComponent);
    component = fixture.componentInstance;
    el = fixture.nativeElement;
    fixture.detectChanges();
  });

  it('stacks the floors bottom to top on evenly spaced balconies', () => {
    for (let f = 2; f <= 10; f++) expect(climbRail(f)).toBeGreaterThan(climbRail(f - 1));
    for (let f = 4; f <= 10; f++) expect(Math.abs(climbRail(f) - climbRail(f - 1) - 398.5)).toBeLessThan(2);
    expect(climbHeight(10)).toBeGreaterThan(climbRail(10));
    const plates = [...el.querySelectorAll<HTMLElement>('.climb-floors li')];
    expect(plates.length).toBe(10);
    const bottom = (f: number) => parseFloat(el.querySelector<HTMLElement>(`[data-floor="${f}"]`)!.style.bottom);
    expect(bottom(1)).toBeLessThan(bottom(2));
    expect(bottom(10)).toBeGreaterThan(bottom(9));
    expect(el.querySelector('.plate.selected .plate-name b')!.textContent).toContain(component.floors[3].name);
    expect(el.querySelector('.plate.next .here')).not.toBeNull();
  });

  it('shows first-clear rewards until the floor is cleared, then the repeat rewards', () => {
    expect(el.querySelector('.prep .ornate')!.textContent).toContain('รางวัลผ่านครั้งแรก');
    expect(el.querySelectorAll('.reward-tiles li').length).toBe(1 + (TOWER_REWARDS[4].firstClear.items?.length ?? 0));
    (el.querySelector('[data-floor="2"] .plate') as HTMLButtonElement).click(); fixture.detectChanges();
    expect(component.selected().floor).toBe(2);
    expect(el.querySelector('.prep .ornate')!.textContent).toContain('รางวัลลงซ้ำ');
    expect(el.querySelectorAll('.reward-tiles li').length).toBe(1);
    expect(el.querySelector('.reward-tiles b')!.textContent).toContain('+' + TOWER_REWARDS[2].clear.heroExp);
    expect(el.querySelector('.climb-cta')!.getAttribute('href')).toBe('/battle?floor=2&mode=tower');
  });

  it('lists every wave with its monsters and marks the boss wave', () => {
    component.focusedFloor.set(10); fixture.detectChanges();
    const waves = el.querySelectorAll('.wave');
    expect(waves.length).toBe(component.detail().waves.length);
    expect(el.querySelector('.wave.boss .wave-tag')!.textContent).toContain('บอส');
    expect(el.querySelectorAll('.wave .mon').length).toBeGreaterThan(3);
    expect(el.querySelector('.climb-cta')).toBeNull();
    expect(el.querySelector('.locked-note')!.textContent).toContain('พิชิตชั้น 9');
  });

  it('shows the saved team with levels against the recommended band', () => {
    const team = save.state().team;
    expect(el.querySelectorAll('.team-rows li:not(.team-empty)').length).toBe(team.length);
    expect(component.team().rows.every(r => r.portrait.startsWith('/portraits/'))).toBeTrue();
    expect(el.querySelector('.team-fit .fit')!.textContent!.trim().length).toBeGreaterThan(0);
  });
});
