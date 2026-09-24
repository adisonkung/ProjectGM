import { ComponentFixture, TestBed } from '@angular/core/testing';
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

  it('renders the 4x7 ally half and the starter team', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelectorAll('.cell.ally').length).toBe(28);
    expect(el.querySelectorAll('.cell.ally .unit').length).toBe(5);
  });

  it('shows enemies of the selected floor', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelectorAll('.unit.foe').length).toBe(3);
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
