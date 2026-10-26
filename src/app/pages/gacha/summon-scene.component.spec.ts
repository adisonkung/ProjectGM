import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { SummonPull, SummonSceneComponent } from './summon-scene.component';

const result = (star: number): SummonPull => ({ templateId: 'elira', name: 'Elira', cls: 'Healer', star, isNew: true, memory: 0, universal: 0 });

describe('Summon cinematic', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [SummonSceneComponent] });
    TestBed.overrideComponent(SummonSceneComponent, { set: { template: '<dialog #stage></dialog>', imports: [] } });
  });
  function scene(stars: number[]) {
    const f = TestBed.createComponent(SummonSceneComponent);
    f.componentRef.setInput('results', stars.map(result));
    f.detectChanges();
    return f;
  }
  it('uses the large beam only when the committed results contain a 3-star hero', fakeAsync(() => {
    const f = scene([1, 2]);
    expect(f.componentInstance.grand()).toBeFalse();
    tick(550);
    expect(f.componentInstance.phase()).toBe('burst');
    tick(1500);
    expect(f.componentInstance.phase()).toBe('cards');
    f.destroy();
    const rare = scene([2, 3]);
    expect(rare.componentInstance.grand()).toBeTrue();
    tick(550);
    expect(rare.componentInstance.phase()).toBe('charge');
    tick(2050);
    expect(rare.componentInstance.phase()).toBe('burst');
    tick(2600);
    expect(rare.componentInstance.phase()).toBe('cards');
    rare.destroy();
  }));
  it('opens each card once and continues to the summary after the last card', fakeAsync(() => {
    const f = scene([3, 2]), c = f.componentInstance;
    const done = jasmine.createSpy('done'); c.done.subscribe(done);
    c.reveal(0); // Cannot reveal during the intro.
    expect(c.opened().size).toBe(0);
    tick(5200);
    c.revealNext();
    expect(c.current()?.star).toBe(3);
    expect(c.remaining()).toBe(1);
    c.continue();
    c.reveal(0);
    expect(c.phase()).toBe('cards');
    c.revealNext();
    expect(c.current()?.star).toBe(2);
    c.continue();
    c.finish();
    expect(done).toHaveBeenCalledTimes(1);
    f.destroy();
  }));
  it('skip is idempotent and cancels pending scene transitions', fakeAsync(() => {
    const f = scene([3]), c = f.componentInstance;
    const done = jasmine.createSpy('done'); c.done.subscribe(done);
    c.finish(); c.finish();
    tick(5000);
    expect(c.phase()).toBe('out');
    expect(done).toHaveBeenCalledTimes(1);
    f.destroy();
  }));
  it('destroying during the intro cancels every pending callback', fakeAsync(() => {
    const f = scene([3]), c = f.componentInstance;
    f.destroy(); tick(5000);
    expect(c.phase()).toBe('charge');
  }));
});
