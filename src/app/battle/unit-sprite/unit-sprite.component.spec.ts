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
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
