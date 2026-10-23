import { heroArt } from '../core/data/hero-art';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { HERO_BY_ID } from '../core/data/heroes';
import { SaveService } from '../core/services/save.service';
import { HeroDetailComponent } from './hero-detail/hero-detail.component';
import { HeroesComponent } from './heroes/heroes.component';

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

  it('roster search composes with class filters and an empty result can be cleared', async () => {
    await TestBed.configureTestingModule({ imports: [HeroesComponent], providers: [provideRouter([])] }).compileComponents();
    const f = TestBed.createComponent(HeroesComponent); f.detectChanges();
    const el: HTMLElement = f.nativeElement;
    const search = el.querySelector('input[type="search"]') as HTMLInputElement;
    const hero = TestBed.inject(SaveService).state().heroes[0];
    const template = HERO_BY_ID[hero.templateId];
    const enter = (text: string) => { search.value = text; search.dispatchEvent(new Event('input')); f.detectChanges(); };
    enter(`  ${template.id.toUpperCase()}  `);
    expect(el.querySelectorAll('.card').length).toBe(1);
    expect(el.querySelector('.card')!.textContent).toContain(template.name);
    f.componentInstance.cls.set(template.cls === 'tank' ? 'mage' : 'tank'); f.detectChanges();
    expect(el.querySelectorAll('.card').length).toBe(0);
    (el.querySelector('.none button') as HTMLButtonElement).click(); f.detectChanges();
    expect(search.value).toBe('');
    expect(el.querySelectorAll('.card').length).toBe(TestBed.inject(SaveService).state().heroes.length);
    enter(template.name);
    expect(el.querySelectorAll('.card').length).toBe(1);
  });

  it('hero detail: route identity, overview gear, and accessible skill/stat navigation', async () => {
    await TestBed.configureTestingModule({
      imports: [HeroDetailComponent],
      providers: [provideRouter([]), { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ uid: '1' })) } }],
    }).compileComponents();
    const f = TestBed.createComponent(HeroDetailComponent);
    f.detectChanges();
    const el: HTMLElement = f.nativeElement;
    const h = TestBed.inject(SaveService).state().heroes[0];
    expect(el.querySelector('h1')!.textContent).toContain(HERO_BY_ID[h.templateId].name);
    // Key art remains intact; overview includes the actual gear slots.
    expect(el.querySelectorAll('.show img.key').length).toBe(heroArt(h.templateId)?.banner ? 1 : 0);
    expect(el.querySelectorAll('.skill').length).toBe(0);
    expect(el.querySelectorAll('.gear-list > a').length).toBe(3);
    (el.querySelector('#hero-tab-skills') as HTMLButtonElement).click();
    f.detectChanges();
    expect(el.querySelectorAll('.skill').length).toBe(3);
    expect(el.querySelectorAll('.basic-attack').length).toBe(1);
    expect(el.querySelector('#hero-panel')!.getAttribute('aria-labelledby')).toBe('hero-tab-skills');
    el.querySelector('#hero-tab-skills')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    f.detectChanges();
    expect(el.querySelector('#hero-tab-stats')!.getAttribute('aria-selected')).toBe('true');
    expect(el.querySelectorAll('table.breakdown thead th').length).toBe(4);
    expect(el.querySelectorAll('.skill').length).toBe(0);
  });
});
