import { ComponentFixture, TestBed } from '@angular/core/testing';

import { provideRouter } from '@angular/router';
import { BattleComponent } from './battle.component';

describe('BattleComponent', () => {
  let component: BattleComponent;
  let fixture: ComponentFixture<BattleComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BattleComponent],
      providers: [provideRouter([])],
    })
    .compileComponents();

    fixture = TestBed.createComponent(BattleComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('shows the placement board before the battle starts', () => {
    expect(component).toBeTruthy();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('app-placement')).not.toBeNull();
    expect(el.querySelector('app-board')).toBeNull();
  });

  it('switches to the battle board after start', () => {
    component.start();
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('app-board')).not.toBeNull();
    component.ngOnDestroy();
  });

  it('battle screen: wave panel + clock on top, one speed button cycling x1/x2/x4, party in the dock', () => {
    component.start();
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.screen .hud-top .wave-panel')).not.toBeNull();
    expect(el.querySelector('.screen .hud-top .clock')).not.toBeNull();
    expect(el.querySelector('.dock app-party-bar')).not.toBeNull();
    expect(el.querySelectorAll('.hud-right .hud-btn').length).toBe(2);
    const spd = el.querySelector<HTMLButtonElement>('.hud-btn.spd')!;
    expect(spd.textContent).toContain('x1');
    spd.click(); fixture.detectChanges();
    expect(component.speed()).toBe(2);
    spd.click(); spd.click(); fixture.detectChanges();
    expect(component.speed()).toBe(1);
    component.ngOnDestroy();
  });

  it('settings popup pauses the fight: resume / restart / exit to placement', () => {
    component.start();
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    component.openMenu();
    fixture.detectChanges();
    expect(component.paused()).toBeTrue();
    const btns = [...el.querySelectorAll<HTMLButtonElement>('.menu button')].map(b => b.textContent!.trim());
    expect(btns.some(t => t.includes('เล่นต่อ'))).toBeTrue();
    expect(btns.some(t => t.includes('เริ่มใหม่'))).toBeTrue();
    expect(btns.some(t => t.includes('ออกจากด่าน'))).toBeTrue();
    // paused: the engine clock does not advance
    const t0 = component.time();
    (component as unknown as { tick(): void }).tick();
    expect(component.time()).toBe(t0);
    component.resume();
    expect(component.paused()).toBeFalse();
    expect(component.menuOpen()).toBeFalse();
    component.openMenu();
    component.restart();
    expect(component.running()).toBeTrue();
    expect(component.paused()).toBeFalse();
    expect(component.time()).toBe(0);
    component.openMenu();
    component.exitStage();
    fixture.detectChanges();
    expect(component.running()).toBeFalse();
    expect(el.querySelector('app-placement')).not.toBeNull();
    component.ngOnDestroy();
  });
});
