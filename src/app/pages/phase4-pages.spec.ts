import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { HERO_BY_ID } from '../core/data/heroes';
import { SaveService } from '../core/services/save.service';
import { HeroDetailComponent } from './hero-detail/hero-detail.component';
import { HeroesComponent } from './heroes/heroes.component';
import { HomeComponent } from './home/home.component';

describe('Phase 4 pages', () => {
  beforeEach(() => localStorage.clear());

  it('hero roster: one card per hero, class filter narrows the list', async () => {
    await TestBed.configureTestingModule({ imports: [HeroesComponent], providers: [provideRouter([])] }).compileComponents();
    const f = TestBed.createComponent(HeroesComponent);
    f.detectChanges();
    const el: HTMLElement = f.nativeElement;
    const heroes = TestBed.inject(SaveService).state().heroes;
    expect(el.querySelectorAll('.card').length).toBe(heroes.length);
    f.componentInstance.cls.set('tank');
    f.detectChanges();
    expect(el.querySelectorAll('.card').length).toBe(heroes.filter(h => HERO_BY_ID[h.templateId].cls === 'tank').length);
  });

  it('hero detail: shows the hero from the route, its three skills and three gear slots', async () => {
    await TestBed.configureTestingModule({
      imports: [HeroDetailComponent],
      providers: [provideRouter([]), { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ uid: '1' })) } }],
    }).compileComponents();
    const f = TestBed.createComponent(HeroDetailComponent);
    f.detectChanges();
    const el: HTMLElement = f.nativeElement;
    const h = TestBed.inject(SaveService).state().heroes[0];
    expect(el.querySelector('h1')!.textContent).toContain(HERO_BY_ID[h.templateId].name);
    expect(el.querySelectorAll('.skill').length).toBe(3);
    expect(el.querySelectorAll('.gear-list > div').length).toBe(3);
  });

  it('home hub: next floor call to action points at a real tower run', async () => {
    await TestBed.configureTestingModule({ imports: [HomeComponent], providers: [provideRouter([])] }).compileComponents();
    const f = TestBed.createComponent(HomeComponent);
    f.detectChanges();
    const el: HTMLElement = f.nativeElement;
    const cta = el.querySelector<HTMLAnchorElement>('.cta a.primary')!;
    expect(cta.getAttribute('href')).toContain('/battle');
    expect(cta.getAttribute('href')).toContain('floor=1');
    expect(el.querySelectorAll('.squad .mem').length).toBe(5);
  });
});
