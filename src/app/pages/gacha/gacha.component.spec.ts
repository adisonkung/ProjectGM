import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { GachaComponent } from './gacha.component';
import { SaveService } from '../../core/services/save.service';

describe('GachaComponent', () => {
  let component: GachaComponent;
  let fixture: ComponentFixture<GachaComponent>;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({ imports: [GachaComponent], providers: [provideRouter([])] }).compileComponents();
    TestBed.inject(SaveService).reset();
    fixture = TestBed.createComponent(GachaComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('a 10-pull spends 900 gems and shows 10 results (1★–3★ only, at least one 2★+)', () => {
    const save = TestBed.inject(SaveService);
    const gems = save.state().gems;
    component.summon(10);
    fixture.detectChanges();
    expect(save.state().gems).toBe(gems - 900);
    const res = component.results();
    expect(res.length).toBe(10);
    expect(res.every(r => r.star >= 1 && r.star <= 3)).toBeTrue();
    expect(res.some(r => r.star >= 2)).toBeTrue();
    expect((fixture.nativeElement as HTMLElement).querySelectorAll('.res').length).toBe(10);
  });

  it('not enough gems → error, nothing spent', () => {
    const save = TestBed.inject(SaveService);
    save.update(s => ({ ...s, gems: 50 }));
    component.summon(1);
    expect(component.error()).toBe('เพชรไม่พอ');
    expect(save.state().gems).toBe(50);
  });
});
