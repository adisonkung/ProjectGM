import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UnitSpriteComponent } from './unit-sprite.component';

describe('UnitSpriteComponent', () => {
  let component: UnitSpriteComponent;
  let fixture: ComponentFixture<UnitSpriteComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UnitSpriteComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(UnitSpriteComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('cls', 'tank');
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('bobs the whole unit when it has no walk row (token without a sheet)', () => {
    const host: HTMLElement = fixture.nativeElement;
    const spy = spyOn(host, 'animate').and.callThrough();
    fixture.componentRef.setInput('anim', 'walk');
    fixture.detectChanges();
    expect(spy).toHaveBeenCalled();
  });

  it('walk cycle follows the ground speed: pace / AnimDef.pace, clamped, updated without restarting', () => {
    fixture.componentRef.setInput('sprite', 'hero-garrick.png');                  // walk drawn for 2.2 cells/s
    fixture.componentRef.setInput('moving', true);
    fixture.componentRef.setInput('pace', 2.2);
    fixture.detectChanges();
    const sheet = fixture.nativeElement.querySelector('.sheet') as HTMLElement;
    const walk = () => sheet.getAnimations()[0];
    const first = walk();
    expect(first.playbackRate).toBeCloseTo(1, 2);
    fixture.componentRef.setInput('pace', 1.5);                                  // his combat walk: legs slow down
    fixture.detectChanges();
    expect(walk()).toBe(first);
    expect(walk().playbackRate).toBeCloseTo(1.5 / 2.2, 2);
    fixture.componentRef.setInput('pace', 0.2);
    fixture.detectChanges();
    expect(walk().playbackRate).toBeCloseTo(0.55, 2);
    fixture.componentRef.setInput('pace', 9);
    fixture.detectChanges();
    expect(walk().playbackRate).toBeCloseTo(1.7, 2);
  });
});
