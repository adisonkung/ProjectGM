import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { newGameState } from '../../core/data/starter';
import { autoPlace } from '../../core/rules/team';
import { SaveService } from '../../core/services/save.service';
import { TeamService } from '../../core/services/team.service';
import { TeamBuilderComponent } from './team-builder.component';
import { TeamBuilderLayout } from './team-builder-layout';

describe('Desktop team archive', () => {
  let fixture: ComponentFixture<TeamBuilderComponent>;
  let team: TeamService;
  let save: SaveService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [TeamBuilderComponent],
      providers: [provideRouter([]), { provide: TeamBuilderLayout, useValue: { desktop: () => true } }],
    });
    save = TestBed.inject(SaveService);
    const templates = ['bailong', 'yuezheng', 'moye', 'tangxun', 'linxue', 'garrick', 'kael'];
    const heroes = templates.map((templateId, index) => ({
      uid: index + 1, templateId, level: 1, potential: 'B' as const, exp: 0, breakthroughTier: 0,
    }));
    save.state.set({ ...newGameState(), heroes, team: autoPlace(heroes), nextUid: heroes.length + 1 });
    team = TestBed.inject(TeamService);
    fixture = TestBed.createComponent(TeamBuilderComponent);
    fixture.detectChanges();
  });

  function button(selector: string): HTMLButtonElement {
    return fixture.nativeElement.querySelector(selector);
  }

  it('maps the far-left display cell to depth 5 of the first lane in the real save', () => {
    const ground: NodeList = fixture.nativeElement.querySelectorAll('.ground-cell');
    expect(ground.length).toBe(18);
    expect(fixture.nativeElement.querySelectorAll('.roster-card').length).toBe(7);
    expect(fixture.nativeElement.querySelectorAll('app-placement').length).toBe(0);

    button('[data-ground-cell="0"]').click();
    button('.roster-card[data-uid="1"]').click();
    fixture.detectChanges();
    expect(team.slots().find(slot => slot.uid === 1)).toEqual({ uid: 1, r: 5, c: 0 });
    expect(team.slots().length).toBe(5);
  });

  it('syncs the icon toggle and native filter without changing the team or save', () => {
    const before = save.state();
    const tank = button('.quick-filters button[aria-label="กรองคลาส แทงก์"]');
    const filter: HTMLSelectElement = fixture.nativeElement.querySelector('.filter select');
    tank.click();
    fixture.detectChanges();
    expect(tank.getAttribute('aria-pressed')).toBe('true');
    expect(filter.value).toBe('tank');
    expect(fixture.nativeElement.querySelectorAll('.roster-card').length).toBe(2);

    tank.click();
    fixture.detectChanges();
    expect(filter.value).toBe('all');
    expect(fixture.nativeElement.querySelectorAll('.roster-card').length).toBe(7);
    expect(save.state()).toBe(before);
  });

  it('saves and reloads the active preset through TeamService', () => {
    const original = team.slots();
    button('.preset:nth-child(2) .preset-select').click();
    button('.actions .save').click();
    expect(team.presets()[1].team).toEqual(original);

    button('[data-ground-cell="0"]').click();
    button('.roster-card[data-uid="1"]').click();
    expect(team.slots()).not.toEqual(original);

    button('.preset:nth-child(2) .preset-select').click();
    expect(team.slots()).toEqual(original);
  });
});
