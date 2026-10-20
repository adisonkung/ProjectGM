import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { PlacementComponent } from '../../battle/placement/placement.component';
import { TeamService } from '../../core/services/team.service';
import { SaveService } from '../../core/services/save.service';
import { STAGES } from '../../core/data/stages';
import { provideRouter } from '@angular/router';
import { TeamBuilderComponent } from './team-builder.component';

describe('TeamBuilderComponent', () => {
  let fixture: ComponentFixture<TeamBuilderComponent>;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [TeamBuilderComponent],
      providers: [provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(TeamBuilderComponent);
    fixture.detectChanges();
  });

  it('renders the 6x3 ally side and the starter team', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelectorAll('.cell.ally').length).toBe(18);
    expect(el.querySelectorAll('.cell.ally .unit').length).toBe(5);
  });

  it('shows only our team with a mark on every empty legal cell', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelectorAll('.unit.foe, .enemy-half, .neutral, .floors').length).toBe(0);
    expect(el.querySelectorAll('.place-mark').length).toBe(13);
    expect(el.querySelectorAll('.empty-slot[aria-label*="วางฮีโร่ได้"]').length).toBe(13);
  });

  it('battle preparation retains the stage enemy preview by default', () => {
    const f = TestBed.createComponent(PlacementComponent);
    f.componentRef.setInput('stage', STAGES[0]);
    f.detectChanges();
    expect(f.nativeElement.querySelectorAll('.unit.foe').length).toBe(3);
    expect(f.nativeElement.querySelectorAll('.neutral').length).toBe(1);
    expect(f.nativeElement.querySelectorAll('.place-mark').length).toBe(0);
    f.destroy();
  });

  it('supports choosing an empty cell before a bench hero, and persists the real position', () => {
    const team = TestBed.inject(TeamService);
    team.clear();
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    const cell = el.querySelector<HTMLElement>('.cell.ally')!;
    cell.click();
    fixture.detectChanges();
    expect(cell.getAttribute('aria-pressed')).toBe('true');
    el.querySelector<HTMLButtonElement>('.bench .card')!.click();
    fixture.detectChanges();
    const editor = fixture.debugElement.query(By.directive(PlacementComponent)).componentInstance as PlacementComponent;
    expect(team.slots().length).toBe(1);
    expect(team.slots()[0].r).toBe(editor.allyCells[0].r);
    expect(team.slots()[0].c).toBe(editor.allyCells[0].c);
    expect(cell.querySelector('.unit')).not.toBeNull();
    expect(el.querySelectorAll('.place-mark').length).toBe(17);
  });

  it('keeps the five hero limit and can replace a placed hero', () => {
    const editor = fixture.debugElement.query(By.directive(PlacementComponent)).componentInstance as PlacementComponent;
    const save = TestBed.inject(SaveService);
    const bench = editor.bench()[0];
    const occupied = editor.allyCells.find(c => editor.at(c))!;
    const empty = editor.allyCells.find(c => !editor.at(c))!;
    editor.tapHero(bench.uid, new Event('click'));
    editor.tapCell(empty);
    expect(save.state().team.length).toBe(5);
    expect(save.state().team.some(t => t.uid === bench.uid)).toBeFalse();
    editor.tapCell(occupied);
    expect(save.state().team.length).toBe(5);
    expect(save.state().team.some(t => t.uid === bench.uid)).toBeTrue();
  });

  it('tap a hero then tap an empty cell to move it', () => {
    const el: HTMLElement = fixture.nativeElement;
    const cells = el.querySelectorAll<HTMLElement>('.cell.ally');
    const from = [...cells].findIndex(c => c.querySelector('.unit'));
    const to = [...cells].findIndex(c => !c.querySelector('.unit'));
    cells[from].click();
    cells[to].click();
    fixture.detectChanges();
    expect(cells[to].querySelector('.unit')).not.toBeNull();
    expect(cells[from].querySelector('.unit')).toBeNull();
  });
});
