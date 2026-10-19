import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { GACHA } from '../../core/data/stars';
import { SaveService } from '../../core/services/save.service';
import { GachaComponent } from './gacha.component';

describe('Summon sanctum transactions', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ imports: [GachaComponent], providers: [provideRouter([])] });
    // Exercise actual services and page transaction flow without running decorative/cinematic loops.
    TestBed.overrideComponent(GachaComponent, { set: { template: '<dialog #infoDialog></dialog><dialog #resultsDialog></dialog>', imports: [] } });
  });

  it('charges once while the cinematic plays, then opens results without another pull', () => {
    const f = TestBed.createComponent(GachaComponent);
    f.detectChanges();
    const c = f.componentInstance, save = TestBed.inject(SaveService), before = save.state().gems;
    c.summon(10);
    c.summon(10);
    expect(save.state().gems).toBe(before - GACHA.multi);
    expect(c.results().length).toBe(10);
    expect(c.playing()).toBeTrue();
    c.finishSummon();
    expect(c.playing()).toBeFalse();
    expect(c.resultsDialog().nativeElement.open).toBeTrue();
    expect(save.state().gems).toBe(before - GACHA.multi);
    c.resultsDialog().nativeElement.close();
    f.destroy();
  });

  it('leaves the save unchanged when a pull cannot be afforded', () => {
    const f = TestBed.createComponent(GachaComponent);
    f.detectChanges();
    const save = TestBed.inject(SaveService);
    save.update(s => ({ ...s, gems: 0 }));
    const before = JSON.stringify(save.state());
    f.componentInstance.summon(1);
    expect(f.componentInstance.playing()).toBeFalse();
    expect(f.componentInstance.error()).toBe('เพชรไม่พอ');
    expect(JSON.stringify(save.state())).toBe(before);
    f.destroy();
  });
});

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
    // the summon cinematic plays first; the results grid shows once it ends / is skipped
    expect((fixture.nativeElement as HTMLElement).querySelector('app-summon-scene')).not.toBeNull();
    component.finishSummon();
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
