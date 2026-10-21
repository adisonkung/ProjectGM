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
  it('freezes a lingering strike independently of a target that moves while attached marks follow it', async () => {
    fixture.componentRef.setInput('frozen',()=>true);
    const clock=component as unknown as {vclock:number;fxAnchors:{at(id:number):unknown}};
    const unit={id:7,side:'ally',name:'k',r:0,c:1,hp:1,maxHp:1,alive:true} as unknown as UnitView;
    fixture.componentRef.setInput('units',[unit]);
    fixture.componentRef.setInput('fx',[
      {id:1,r:0,c:1,name:'vn-ult-phantom-1',angle:0,follow:7,lockAfterMs:65},
      {id:2,r:0,c:1,name:'vn-ult-cut',angle:0,follow:7},
    ]);
    fixture.detectChanges();
    for(let i=0;i<30&&!clock.fxAnchors.at(1);i++) await new Promise<void>(r=>requestAnimationFrame(()=>r()));
    expect(clock.fxAnchors.at(1)).toBeDefined();
    clock.vclock+=.1;
    await new Promise<void>(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r())));
    const el=fixture.nativeElement as HTMLElement;
    const ghost=el.querySelector<HTMLElement>('.fx-wrap[data-fx="1"]')!;
    const mark=el.querySelector<HTMLElement>('.fx-wrap[data-fx="2"]')!;
    const frozen=ghost.style.transform;
    fixture.componentRef.setInput('units',[{...unit,c:4}]);fixture.detectChanges();
    await new Promise(r=>setTimeout(r,400));
    expect(ghost.style.transform).toBe(frozen);
    expect(mark.style.transform).toBe(el.querySelector<HTMLElement>('.unit[data-uid="7"]')!.style.transform);
    expect(mark.style.transform).not.toBe(frozen);
    fixture.componentRef.setInput('fx',[]);fixture.detectChanges();
    expect(el.querySelectorAll('.fx-wrap').length).toBe(0);
  });

});
