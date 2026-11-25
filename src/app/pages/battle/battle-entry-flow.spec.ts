import { By } from '@angular/platform-browser';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { BattlePreloadService, PreloadJob, PreloadResult } from '../../battle/render/battle-preload';
import { BoardComponent } from '../../battle/board/board.component';
import { BattleComponent } from './battle.component';
import { BattleEntryComponent } from './battle-entry.component';
import { BattleEngine } from '../../battle/engine/battle-engine';

function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => resolve = done); return { promise, resolve }; }
const loaded: PreloadResult = { loaded: 2, total: 2, failed: [], pixiAvailable: false };

describe('battle entry clock gate', () => {
  let fixture: ComponentFixture<BattleComponent>, component: BattleComponent;
  let download: ReturnType<typeof deferred<PreloadResult>>, renderer: ReturnType<typeof deferred<'dom' | 'pixi'>>;
  let preload: jasmine.Spy, job: PreloadJob;
  const until = async (condition: () => boolean) => {
    const end = performance.now() + 2500;
    while (!condition() && performance.now() < end) { fixture.detectChanges(); await new Promise(r => setTimeout(r, 10)); }
    fixture.detectChanges(); expect(condition()).toBeTrue();
  };
  beforeEach(async () => {
    download = deferred(); renderer = deferred();
    preload = jasmine.createSpy('load').and.callFake((next: PreloadJob) => { job = next; next.onProgress?.(0, 2); return download.promise; });
    spyOn(BoardComponent.prototype, 'prepareBattle').and.returnValue(renderer.promise);
    await TestBed.configureTestingModule({ imports: [BattleComponent], providers: [provideRouter([]), { provide: BattlePreloadService, useValue: { load: preload } }] }).compileComponents();
    fixture = TestBed.createComponent(BattleComponent); component = fixture.componentInstance; component.renderer.set('dom'); fixture.detectChanges();
  });
  afterEach(() => fixture.destroy());
  it('holds engine time through black 100%, renderer preparation and the completed intro', async () => {
    component.enter(); fixture.detectChanges();
    expect(component.running()).toBeFalse(); expect(component.loading()?.phase).toBe('loading');
    download.resolve(loaded); await Promise.resolve(); await Promise.resolve(); fixture.detectChanges();
    expect(component.loading()?.done).toBe(2); expect(component.loading()?.phase).toBe('loading');
    await until(() => component.loading()?.phase === 'preparing');
    const engine = (component as unknown as { engine: BattleEngine }).engine;
    expect(engine.time).toBe(0); expect(component.running()).toBeFalse(); expect(component.boardFrozen()).toBeTrue();
    renderer.resolve('dom'); await until(() => component.loading()?.phase === 'intro');
    expect(engine.time).toBe(0); expect(component.running()).toBeFalse();
    const id = component.loading()!.id;
    component.entryFinished(id + 1); expect(component.running()).toBeFalse();
    fixture.debugElement.query(By.directive(BattleEntryComponent)).componentInstance.completed.emit(id);
    expect(component.running()).toBeTrue(); expect(component.loading()).toBeNull(); expect(engine.time).toBe(0);
  });
  it('blocks required-image failures and retries with a fresh request identity', async () => {
    component.enter(); fixture.detectChanges(); const id = component.loading()!.id;
    download.resolve({ ...loaded, loaded: 1, failed: ['/required'] });
    await until(() => component.loading()?.phase === 'error');
    expect(component.running()).toBeFalse(); expect(fixture.nativeElement.textContent).toContain('ลองโหลดใหม่');
    download = deferred(); component.retryEntry(); fixture.detectChanges();
    expect(component.loading()?.id).toBeGreaterThan(id); expect(preload).toHaveBeenCalledTimes(2);
    component.entryFinished(id); expect(component.running()).toBeFalse();
  });
  it('ignores old progress and completion after a new preparation replaces the request', async () => {
    component.enter(); fixture.detectChanges(); const oldJob = job!, oldDownload = download;
    component.prepare(); download = deferred(); component.enter(); fixture.detectChanges();
    const id = component.loading()!.id;
    oldJob.onProgress?.(99, 99); oldDownload.resolve(loaded); await Promise.resolve(); await Promise.resolve();
    expect(component.loading()?.id).toBe(id); expect(component.loading()?.done).toBe(0); expect(component.running()).toBeFalse();
  });
  it('routes restart through the same asset and intro gate', () => {
    const enter = spyOn(component, 'enter'); component.restart();
    expect(enter).toHaveBeenCalledTimes(1); expect(component.running()).toBeFalse();
  });
});
