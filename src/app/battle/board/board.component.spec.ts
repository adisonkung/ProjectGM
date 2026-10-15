import { ComponentFixture, TestBed } from '@angular/core/testing';

import { fxAttached } from '../../core/data/sprites';
import { BoardComponent, UnitView } from './board.component';

describe('BoardComponent', () => {
  let component: BoardComponent;
  let fixture: ComponentFixture<BoardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BoardComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BoardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('lingering auras / guards / fields are attached to their unit; slashes, waves and bursts stay where they happened', () => {
    for (const n of ['gr-s1-aura', 'gr-ult-aura', 'lx-s2-guard', 'yz-ult-field-back', 'yz-ult-field-front']) expect(fxAttached(n)).withContext(n).toBeTrue();
    for (const n of ['kl-ult-wave', 'kl-ult-slam', 'gr-s2-main', 'lx-ult-main', 'kl-s1-impact', 'nope']) expect(fxAttached(n)).withContext(n).toBeFalse();
  });

  it('an attached FX rides on its unit: the frame loop copies the unit\'s drawn transform onto it', async () => {
    const unit = { id: 7, side: 'ally', name: 'k', r: 0, c: 1, hp: 1, maxHp: 1, alive: true } as unknown as UnitView;
    fixture.componentRef.setInput('units', [unit]);
    fixture.componentRef.setInput('fx', [{ id: 1, r: 0, c: 1, name: 'gr-s1-aura', angle: 0, follow: 7 }, { id: 2, r: 0, c: 1, name: 'kl-ult-wave', angle: 0 }]);
    fixture.detectChanges();
    fixture.componentRef.setInput('units', [{ ...unit, c: 4 }]);                 // the unit walks 3 cells
    fixture.detectChanges();
    await new Promise(r => setTimeout(r, 400));
    const el = fixture.nativeElement as HTMLElement;
    const u = el.querySelector<HTMLElement>('.unit[data-uid="7"]')!;
    const [aura, wave] = Array.from(el.querySelectorAll<HTMLElement>('.fx-wrap'));
    expect(u.style.transform).toContain('translate(4');
    expect(aura.style.transform).toBe(u.style.transform);
    expect(wave.style.transform).toBe(component.pos(0, 1));
  });
});
