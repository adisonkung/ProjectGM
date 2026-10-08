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

  it('hero detail: key art + the hero from the route, its three skills and three gear slots on the second tab', async () => {
    await TestBed.configureTestingModule({
      imports: [HeroDetailComponent],
      providers: [provideRouter([]), { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ uid: '1' })) } }],
    }).compileComponents();
    const f = TestBed.createComponent(HeroDetailComponent);
    f.detectChanges();
    const el: HTMLElement = f.nativeElement;
    const h = TestBed.inject(SaveService).state().heroes[0];
    expect(el.querySelector('h1')!.textContent).toContain(HERO_BY_ID[h.templateId].name);
    // the full key art is shown when the hero has one; skills / gear live on the second tab
    expect(el.querySelectorAll('.show img.key').length).toBe(heroArt(h.templateId)?.banner ? 1 : 0);
    expect(el.querySelectorAll('.skill').length).toBe(0);
    f.componentInstance.tab.set('kit');
    f.detectChanges();
    expect(el.querySelectorAll('.skill').length).toBe(3);
    expect(el.querySelectorAll('.gear-list > div').length).toBe(3);
  });
});
