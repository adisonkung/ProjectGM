import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { HeroesComponent } from './heroes.component';
import { SaveService } from '../../core/services/save.service';
import { newGameState } from '../../core/data/starter';
import { HEROES } from '../../core/data/heroes';

describe('Charcoal hero collection', () => {
  beforeEach(() => TestBed.configureTestingModule({ imports: [HeroesComponent], providers: [provideRouter([])] }));

  function setup() {
    const save = TestBed.inject(SaveService);
    const state = newGameState();
    state.heroes = HEROES.map((t, i) => ({ uid: i + 1, templateId: t.id, level: i === 0 ? 10 : 1, potential: 'B', star: i === 0 ? 6 : 3 }));
    state.nextUid = state.heroes.length + 1;
    save.state.set(state);
    const fixture = TestBed.createComponent(HeroesComponent);
    fixture.detectChanges();
    return { save, fixture, component: fixture.componentInstance, root: fixture.nativeElement as HTMLElement };
  }

  it('filters, searches and sorts the real collection without changing the save', () => {
    const { save, fixture, component, root } = setup();
    const before = JSON.stringify(save.state());
    expect(root.querySelectorAll('.hero-card').length).toBe(HEROES.length);
    expect(component.shown().map(h => h.id)).toEqual(HEROES.map(t => t.id));
    component.cls.set('mage'); fixture.detectChanges();
    expect(component.shown().map(h => h.id)).toEqual(HEROES.filter(t => t.cls === 'mage').map(t => t.id));
    component.cls.set('all'); component.query.set('ดอว์นเมียร์'); fixture.detectChanges();
    expect(component.shown().map(h => h.id)).toEqual(['elira']);
    component.query.set('no-such-hero'); fixture.detectChanges();
    expect(root.querySelector('[role="status"]')?.textContent).toContain('ไม่พบฮีโร่');
    component.query.set(''); component.sort.set('star'); fixture.detectChanges();
    expect(component.shown()[0].id).toBe('bailong');
    expect(JSON.stringify(save.state())).toBe(before);
  });

  it('uses live stars, levels, currency and class colors while retaining detail routes', () => {
    const { component, root } = setup();
    const first = root.querySelector('.hero-card') as HTMLElement;
    expect(first.getAttribute('href')).toBe('/heroes/1');
    expect(first.querySelector('app-hero-stars')?.getAttribute('aria-label')).toBe('6 ดาว');
    expect(first.querySelector('.hero-level b')?.textContent).toBe('10');
    expect(root.querySelector('.resource b')?.textContent).toBe('1,500');
    for (const [index, hero] of HEROES.entries()) {
      expect((root.querySelectorAll('.hero-card')[index] as HTMLElement).style.getPropertyValue('--class-color')).toBe(component.classColor[hero.cls]);
    }
    const fighters = root.querySelectorAll('.filters button');
    (fighters[1] as HTMLButtonElement).click();
    expect(component.cls()).toBe('fighter');
  });
});
