import { ComponentFixture, TestBed } from '@angular/core/testing';

import { provideRouter } from '@angular/router';
import { SaveService } from '../../core/services/save.service';
import { TowerComponent } from './tower.component';

describe('TowerComponent', () => {
  let component: TowerComponent;
  let fixture: ComponentFixture<TowerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TowerComponent],
      providers: [provideRouter([])],
    })
    .compileComponents();

    fixture = TestBed.createComponent(TowerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('previews locked floors without exposing an entry link or changing the save', () => {
    const save = TestBed.inject(SaveService);
    save.update(s => ({ ...s, cleared: 0 })); fixture.detectChanges();
    const before = save.state();
    component.focusedFloor.set(10); fixture.detectChanges();
    const preview = (fixture.nativeElement as HTMLElement).querySelector('.floor-preview')!;
    expect(preview.querySelector('a')).toBeNull();
    expect(preview.textContent).toContain('พิชิตชั้น 9');
    expect(save.state()).toBe(before);
  });

  it('defaults to the next floor and retains replay entry for cleared floors', () => {
    TestBed.inject(SaveService).update(s => ({ ...s, cleared: 3 })); fixture.detectChanges();
    expect(component.selected().floor).toBe(4);
    let enter = (fixture.nativeElement as HTMLElement).querySelector('.floor-preview a')!;
    expect(enter.getAttribute('href')).toBe('/battle?floor=4&mode=tower');
    component.focusedFloor.set(1); fixture.detectChanges();
    enter = (fixture.nativeElement as HTMLElement).querySelector('.floor-preview a')!;
    expect(enter.getAttribute('href')).toBe('/battle?floor=1&mode=tower');
    expect(enter.textContent).toContain('สู้อีกครั้ง');
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
