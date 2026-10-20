import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { GACHA } from '../../core/data/stars';
import { GachaService } from '../../core/services/gacha.service';
import { SaveService } from '../../core/services/save.service';
import { GachaComponent } from './gacha.component';

describe('Summon sanctum transactions', () => {
  let freeMode: jasmine.Spy;
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ imports: [GachaComponent], providers: [provideRouter([])] });
    // Exercise actual services and page transaction flow without running decorative/cinematic loops.
    TestBed.overrideComponent(GachaComponent, { set: { template: '<dialog #infoDialog></dialog><dialog #resultsDialog></dialog><dialog #confirmDialog></dialog>', imports: [] } });
    freeMode = spyOnProperty(TestBed.inject(GachaService), 'freeSummons', 'get').and.returnValue(false);
  });

  it('charges once while the cinematic plays, then opens results without another pull', () => {
    const f = TestBed.createComponent(GachaComponent);
    f.detectChanges();
    const c = f.componentInstance, save = TestBed.inject(SaveService), before = save.state().gems;
    c.summon(10);
    expect(save.state().gems).toBe(before);
    c.confirmSummon();
    c.confirmSummon();
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

  it('free test mode accepts repeated zero-gem pulls and prevents double-confirm rewards', () => {
    freeMode.and.returnValue(true);
    const f = TestBed.createComponent(GachaComponent);
    f.detectChanges();
    const c = f.componentInstance, save = TestBed.inject(SaveService);
    save.update(s => ({ ...s, gems: 0 }));
    c.summon(10); c.confirmSummon();
    const after = JSON.stringify(save.state());
    c.confirmSummon(); c.summon(10);
    expect(JSON.stringify(save.state())).toBe(after);
    expect(c.results().length).toBe(10);
    expect(save.state().gems).toBe(0);
    c.finishSummon();
    c.summon(1); c.confirmSummon();
    expect(c.results().length).toBe(1);
    expect(c.playing()).toBeTrue();
    expect(save.state().gems).toBe(0);
    expect(c.error()).toBeNull();
    f.destroy();
  });

  it('cancelling or dismissing confirmation spends nothing and leaves previous results intact', () => {
    const f = TestBed.createComponent(GachaComponent);
    f.detectChanges();
    const c = f.componentInstance, save = TestBed.inject(SaveService);
    const before = JSON.stringify(save.state());
    c.summon(10);
    expect(c.confirmDialog().nativeElement.open).toBeTrue();
    expect(c.pending()).toBe(10);
    c.cancelSummon();
    c.confirmSummon();
    expect(c.pending()).toBeNull();
    expect(c.confirmDialog().nativeElement.open).toBeFalse();
    expect(c.playing()).toBeFalse();
    expect(JSON.stringify(save.state())).toBe(before);
    f.destroy();
  });

  it('rechecks affordability on confirmation without spending or playing a cinematic', () => {
    const f = TestBed.createComponent(GachaComponent);
    f.detectChanges();
    const c = f.componentInstance, save = TestBed.inject(SaveService);
    c.summon(10);
    save.update(s => ({ ...s, gems: 0 }));
    const before = JSON.stringify(save.state());
    c.confirmSummon();
    expect(c.error()).toBe('เพชรไม่พอ');
    expect(c.pending()).toBeNull();
    expect(c.playing()).toBeFalse();
    expect(JSON.stringify(save.state())).toBe(before);
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
  let freeMode: jasmine.Spy;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({ imports: [GachaComponent], providers: [provideRouter([])] }).compileComponents();
    freeMode = spyOnProperty(TestBed.inject(GachaService), 'freeSummons', 'get').and.returnValue(false);
    TestBed.inject(SaveService).reset();
    fixture = TestBed.createComponent(GachaComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('a 10-pull spends 900 gems and shows 10 results (1★–3★ only, at least one 2★+)', () => {
    const save = TestBed.inject(SaveService);
    const gems = save.state().gems;
    component.summon(10);
    component.confirmSummon();
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

  it('shows original prices and enables both buttons at zero gems in free test mode', () => {
    freeMode.and.returnValue(true);
    TestBed.inject(SaveService).update(s => ({ ...s, gems: 0 }));
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const buttons = [...el.querySelectorAll<HTMLButtonElement>('.summon-button')];
    expect(buttons.every(b => !b.disabled)).toBeTrue();
    expect(buttons[0].querySelector('.price')?.textContent).toContain(String(GACHA.single));
    expect(buttons[1].querySelector('.price')?.textContent).toContain(String(GACHA.multi));
    component.summon(10); fixture.detectChanges();
    expect(el.querySelector('.confirm-wallet')?.textContent).toContain('ราคาเดิม');
    expect(el.querySelector('.confirm-wallet')?.textContent).toContain(String(GACHA.multi));
    expect(el.querySelector('.confirm-note')?.textContent).toContain('ไม่หักเพชร');
    expect(el.querySelector<HTMLButtonElement>('.confirm-actions .primary')?.disabled).toBeFalse();
    component.cancelSummon();
  });

  it('not enough gems → error, nothing spent', () => {
    const save = TestBed.inject(SaveService);
    save.update(s => ({ ...s, gems: 50 }));
    component.summon(1);
    expect(component.error()).toBe('เพชรไม่พอ');
    expect(save.state().gems).toBe(50);
  });
});
