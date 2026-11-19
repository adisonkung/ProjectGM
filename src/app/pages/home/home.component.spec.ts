import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { Component } from '@angular/core';
import { HomeComponent, HOME_NAV } from './home.component';
import { HOME_EVENTS } from './home-mock';

@Component({ template: '' })
class StubPage {}

describe('HomeComponent (K7)', () => {
  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [HomeComponent],
      providers: [provideRouter([{ path: '**', component: StubPage }])],
    }).compileComponents();
  });

  it('bottom menu reaches heroes, team, gear, summon and the Sky Isle', () => {
    const f = TestBed.createComponent(HomeComponent); f.detectChanges();
    const hrefs = [...(f.nativeElement as HTMLElement).querySelectorAll('nav.main-nav a')].map(a => a.getAttribute('href'));
    expect(hrefs).toEqual(HOME_NAV.map(n => n.path));
    expect(hrefs).toContain('/island');
  });

  it('adventure card opens the tower and shows real tower progress', () => {
    const f = TestBed.createComponent(HomeComponent); f.detectChanges();
    const card = (f.nativeElement as HTMLElement).querySelector('a.adventure')!;
    expect(card.getAttribute('href')).toBe('/tower');
    expect(card.textContent).toContain(`${f.componentInstance.cleared()} / ${f.componentInstance.totalFloors}`);
  });

  it('menu button toggles the expanded menu; Escape closes it', () => {
    const f = TestBed.createComponent(HomeComponent); f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    (el.querySelector('.menu-btn') as HTMLButtonElement).click(); f.detectChanges();
    expect(el.querySelector('#home-menu')).not.toBeNull();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); f.detectChanges();
    expect(el.querySelector('#home-menu')).toBeNull();
  });

  it('mock features show a notice; tiles with a route navigate', async () => {
    const f = TestBed.createComponent(HomeComponent); f.detectChanges();
    const router = TestBed.inject(Router);
    const nav = spyOn(router, 'navigateByUrl').and.resolveTo(true);
    f.componentInstance.open(undefined);
    expect(f.componentInstance.notice()).toContain('เร็ว ๆ นี้');
    f.componentInstance.open('/forge');
    expect(nav).toHaveBeenCalledWith('/forge');
  });

  it('carousel wraps both ways and shows one slide at a time', () => {
    const f = TestBed.createComponent(HomeComponent); f.detectChanges();
    const c = f.componentInstance;
    c.show(-1); expect(c.slide()).toBe(HOME_EVENTS.length - 1);
    c.show(HOME_EVENTS.length); expect(c.slide()).toBe(0);
    f.detectChanges();
    expect((f.nativeElement as HTMLElement).querySelectorAll('.slide.on').length).toBe(1);
  });

  it('board scales to the window within limits', () => {
    const f = TestBed.createComponent(HomeComponent); f.detectChanges();
    const k = f.componentInstance.scale();
    expect(k).toBeGreaterThanOrEqual(0.55);
    expect(k).toBeLessThanOrEqual(1.2);
  });

  it('plays both arena impacts on hover and removes the effects on exit', () => {
    const matchMedia = window.matchMedia.bind(window);
    spyOn(window, 'matchMedia').and.callFake(() => matchMedia('not all'));
    const f = TestBed.createComponent(HomeComponent);
    f.detectChanges();
    const card = (f.nativeElement as HTMLElement).querySelector('.arena')!;
    card.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' }));
    f.detectChanges();
    expect(card.classList).toContain('art-active');
    expect(card.querySelectorAll('app-sheet-fx.clash').length).toBe(2);
    card.dispatchEvent(new PointerEvent('pointerleave', { pointerType: 'mouse' }));
    f.detectChanges();
    expect(card.classList).not.toContain('art-active');
    expect(card.querySelector('app-sheet-fx')).toBeNull();
  });

  it('starts the three touch intros 300 ms apart and plays a short icon press', fakeAsync(() => {
    const matchMedia = window.matchMedia.bind(window);
    spyOn(window, 'matchMedia').and.callFake(query => matchMedia(query.includes('pointer: coarse') ? 'all' : 'not all'));
    const f = TestBed.createComponent(HomeComponent);
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    const activeCards = () => Array.from(el.querySelectorAll('.card.art-active'));
    tick(240); f.detectChanges();
    expect(activeCards()).toEqual([el.querySelector('.adventure')!]);
    tick(300); f.detectChanges();
    expect(activeCards().length).toBe(2);
    tick(300); f.detectChanges();
    expect(activeCards().length).toBe(3);

    const icon = el.querySelector('.main-nav .mn')!;
    icon.dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'touch' }));
    f.detectChanges();
    expect(icon.classList).toContain('art-short');
    expect(icon.classList).toContain('art-active');
    tick(460); f.detectChanges();
    expect(icon.classList).not.toContain('art-active');
    f.destroy();
  }));

  it('skips hover, touch and intro effects under reduced motion', fakeAsync(() => {
    const matchMedia = window.matchMedia.bind(window);
    spyOn(window, 'matchMedia').and.callFake(() => matchMedia('all'));
    const f = TestBed.createComponent(HomeComponent);
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    el.querySelector('.arena')!.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' }));
    el.querySelector('.arena')!.dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'touch' }));
    tick(1500); f.detectChanges();
    expect(el.querySelector('.art-active, app-sheet-fx')).toBeNull();
    f.destroy();
  }));
});
