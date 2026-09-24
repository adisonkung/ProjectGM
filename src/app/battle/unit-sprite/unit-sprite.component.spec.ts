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

  it('bobs the whole unit when the sheet has no walk row', () => {
    const host: HTMLElement = fixture.nativeElement;
    const spy = spyOn(host, 'animate').and.callThrough();
    fixture.componentRef.setInput('sprite', 'hero-draken.png');
    fixture.componentRef.setInput('anim', 'walk');
    fixture.detectChanges();
    expect(spy).toHaveBeenCalled();
  });
});
