import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SUMMON_SEALS, SUMMON_SEAL_COST } from '../../core/data/summon-seals';
import { GachaService } from '../../core/services/gacha.service';
import { SaveService } from '../../core/services/save.service';
import { GachaComponent } from './gacha.component';
import { SummonBookComponent } from './summon-book/summon-book.component';

describe('Summon sanctum transactions', () => {
  let freeMode: jasmine.Spy;
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ imports: [GachaComponent], providers: [provideRouter([])] });
    // Exercise actual services and page transaction flow without running decorative/cinematic loops.
    TestBed.overrideComponent(GachaComponent, { set: { template: '<dialog #infoDialog></dialog><dialog #resultsDialog></dialog><dialog #confirmDialog></dialog>', imports: [] } });
    freeMode = spyOnProperty(TestBed.inject(GachaService), 'freeSummons', 'get').and.returnValue(false);
    TestBed.inject(SaveService).update(s => ({...s, inventory:{...s.inventory,[SUMMON_SEALS.standard.id]:30}}));
  });

  it('charges once while the cinematic plays, then opens results without another pull', () => {
    const f = TestBed.createComponent(GachaComponent);
    f.detectChanges();
    const c = f.componentInstance, save = TestBed.inject(SaveService), before = (save.state().inventory[SUMMON_SEALS.standard.id] ?? 0);
    c.summon(10);
    expect((save.state().inventory[SUMMON_SEALS.standard.id] ?? 0)).toBe(before);
    c.confirmSummon();
    c.confirmSummon();
    c.summon(10);
    expect((save.state().inventory[SUMMON_SEALS.standard.id] ?? 0)).toBe(before - SUMMON_SEAL_COST.multi);
    expect(c.results().length).toBe(10);
    expect(c.playing()).toBeTrue();
    c.finishSummon();
    expect(c.playing()).toBeFalse();
    // the summon book ends on its own card summary; the results list opens from "ผลครั้งล่าสุด"
    expect(c.resultsDialog().nativeElement.open).toBeFalse();
    c.openResults();
    expect(c.resultsDialog().nativeElement.open).toBeTrue();
    expect((save.state().inventory[SUMMON_SEALS.standard.id] ?? 0)).toBe(before - SUMMON_SEAL_COST.multi);
    c.resultsDialog().nativeElement.close();
    f.destroy();
  });

  it('"สุ่มอีกครั้ง" from the summary asks to confirm the same count again and spends nothing yet', () => {
    const f = TestBed.createComponent(GachaComponent);
    f.detectChanges();
    const c = f.componentInstance, save = TestBed.inject(SaveService);
    save.update(s => ({ ...s, gems: 5000, inventory: { ...s.inventory, [SUMMON_SEALS.standard.id]: 5000 } }));
    c.summon(10); c.confirmSummon();
    const after = (save.state().inventory[SUMMON_SEALS.standard.id] ?? 0);
    c.summonAgain();
    expect(c.playing()).toBeFalse();
    expect(c.pending()).toBe(10);
    expect(c.confirmDialog().nativeElement.open).toBeTrue();
    expect((save.state().inventory[SUMMON_SEALS.standard.id] ?? 0)).toBe(after);
    c.cancelSummon();
    f.destroy();
  });

  it('free test mode accepts repeated zero-seal pulls and prevents double-confirm rewards', () => {
    freeMode.and.returnValue(true);
    const f = TestBed.createComponent(GachaComponent);
    f.detectChanges();
    const c = f.componentInstance, save = TestBed.inject(SaveService);
    save.update(s => ({ ...s, gems: 0, inventory: { ...s.inventory, [SUMMON_SEALS.standard.id]: 0 } }));
    c.summon(10); c.confirmSummon();
    const after = JSON.stringify(save.state());
    c.confirmSummon(); c.summon(10);
    expect(JSON.stringify(save.state())).toBe(after);
    expect(c.results().length).toBe(10);
    expect((save.state().inventory[SUMMON_SEALS.standard.id] ?? 0)).toBe(0);
    c.finishSummon();
    c.summon(1); c.confirmSummon();
    expect(c.results().length).toBe(1);
    expect(c.playing()).toBeTrue();
    expect((save.state().inventory[SUMMON_SEALS.standard.id] ?? 0)).toBe(0);
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
    save.update(s => ({ ...s, gems: 0, inventory: { ...s.inventory, [SUMMON_SEALS.standard.id]: 0 } }));
    const before = JSON.stringify(save.state());
    c.confirmSummon();
    expect(c.error()).toBe('หน้าตำราดาราไม่พอ');
    expect(c.pending()).toBeNull();
    expect(c.playing()).toBeFalse();
    expect(JSON.stringify(save.state())).toBe(before);
    f.destroy();
  });

  it('leaves the save unchanged when a pull cannot be afforded', () => {
    const f = TestBed.createComponent(GachaComponent);
    f.detectChanges();
    const save = TestBed.inject(SaveService);
    save.update(s => ({ ...s, gems: 0, inventory: { ...s.inventory, [SUMMON_SEALS.standard.id]: 0 } }));
    const before = JSON.stringify(save.state());
    f.componentInstance.summon(1);
    expect(f.componentInstance.playing()).toBeFalse();
    expect(f.componentInstance.error()).toBe('หน้าตำราดาราไม่พอ');
    expect(JSON.stringify(save.state())).toBe(before);
    f.destroy();
  });
});

describe('GachaComponent', () => {
  let component: GachaComponent;
  let fixture: ComponentFixture<GachaComponent>;
  let freeMode: jasmine.Spy;

  beforeEach(async () => {
    // Test the page/transaction boundary without constructing a real WebGL renderer.
    spyOn<any>(SummonBookComponent.prototype, 'mount').and.stub();
    localStorage.clear();
    await TestBed.configureTestingModule({ imports: [GachaComponent], providers: [provideRouter([])] }).compileComponents();
    freeMode = spyOnProperty(TestBed.inject(GachaService), 'freeSummons', 'get').and.returnValue(false);
    TestBed.inject(SaveService).update(s => ({...s, inventory:{...s.inventory,[SUMMON_SEALS.standard.id]:30}}));
    TestBed.inject(SaveService).reset();
    TestBed.inject(SaveService).update(s => ({...s, inventory:{...s.inventory,[SUMMON_SEALS.standard.id]:30}}));
    fixture = TestBed.createComponent(GachaComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    component.book()!.loading.set(false);
    fixture.detectChanges();
  });

  it('prepares a hidden book on entry without rolling or spending', () => {
    fixture.destroy();
    const service = TestBed.inject(GachaService), summon = spyOn(service, 'summon').and.callThrough();
    const save = TestBed.inject(SaveService), before = JSON.stringify(save.state());
    fixture = TestBed.createComponent(GachaComponent); component = fixture.componentInstance;
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-summon-book')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('dialog.book')?.open).toBeFalse();
    expect(component.playing()).toBeFalse();
    expect(summon).not.toHaveBeenCalled();
    expect(JSON.stringify(save.state())).toBe(before);
  });

  it('does not spend a confirmed intent until the prepared room is ready', () => {
    const c = component, save = TestBed.inject(SaveService), seals = (save.state().inventory[SUMMON_SEALS.standard.id] ?? 0);
    const summon = spyOn(TestBed.inject(GachaService), 'summon').and.callThrough();
    c.book()!.loading.set(true); fixture.detectChanges();
    c.summon(1); c.confirmSummon();
    expect(c.pending()).toBe(1); expect(c.playing()).toBeFalse();
    expect((save.state().inventory[SUMMON_SEALS.standard.id] ?? 0)).toBe(seals); expect(summon).not.toHaveBeenCalled();
    c.book()!.loading.set(false); fixture.detectChanges();
    c.confirmSummon(); c.confirmSummon();
    expect((save.state().inventory[SUMMON_SEALS.standard.id] ?? 0)).toBe(seals - SUMMON_SEAL_COST.single);
    expect(summon).toHaveBeenCalledTimes(1);
    expect(c.playing()).toBeTrue();
  });

  it('a 10-pull spends 10 seals and shows 10 results (1★–3★ only, at least one 2★+)', () => {
    const save = TestBed.inject(SaveService);
    const seals = (save.state().inventory[SUMMON_SEALS.standard.id] ?? 0);
    component.summon(10);
    component.confirmSummon();
    fixture.detectChanges();
    // the summon cinematic plays first; the results grid shows once it ends / is skipped
    expect((fixture.nativeElement as HTMLElement).querySelector('app-summon-book')).not.toBeNull();
    component.finishSummon();
    component.openResults();
    fixture.detectChanges();
    expect((save.state().inventory[SUMMON_SEALS.standard.id] ?? 0)).toBe(seals - SUMMON_SEAL_COST.multi);
    const res = component.results();
    expect(res.length).toBe(10);
    expect(res.every(r => r.star >= 1 && r.star <= 3)).toBeTrue();
    expect(res.some(r => r.star >= 2)).toBeTrue();
    expect((fixture.nativeElement as HTMLElement).querySelectorAll('.res').length).toBe(10);
  });

  it('shows the selected seal costs and enables both buttons at zero seals in free test mode', () => {
    freeMode.and.returnValue(true);
    TestBed.inject(SaveService).update(s => ({ ...s, gems: 0, inventory: { ...s.inventory, [SUMMON_SEALS.standard.id]: 0 } }));
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const buttons = [...el.querySelectorAll<HTMLButtonElement>('.summon-button')];
    expect(buttons.every(b => !b.disabled)).toBeTrue();
    expect(buttons[0].querySelector('.price')?.textContent).toContain(String(SUMMON_SEAL_COST.single));
    expect(buttons[1].querySelector('.price')?.textContent).toContain(String(SUMMON_SEAL_COST.multi));
    component.summon(10); fixture.detectChanges();
    expect(el.querySelector('.confirm-wallet')?.textContent).toContain('ราคาเดิม');
    expect(el.querySelector('.confirm-wallet')?.textContent).toContain(String(SUMMON_SEAL_COST.multi));
    expect(el.querySelector('.confirm-note')?.textContent).toContain('ไม่หักหน้าตำราดารา');
    expect(el.querySelector<HTMLButtonElement>('.confirm-actions .primary')?.disabled).toBeFalse();
    component.cancelSummon();
  });

  it('not enough seals → error, nothing spent', () => {
    const save = TestBed.inject(SaveService);
    save.update(s => ({ ...s, gems: 50, inventory: { ...s.inventory, [SUMMON_SEALS.standard.id]: 0 } }));
    component.summon(1);
    expect(component.error()).toBe('หน้าตำราดาราไม่พอ');
    expect((save.state().inventory[SUMMON_SEALS.standard.id] ?? 0)).toBe(0);
  });
});
