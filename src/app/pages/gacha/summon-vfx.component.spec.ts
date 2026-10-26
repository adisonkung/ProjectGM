import { TestBed } from '@angular/core/testing';
import { SummonVfxComponent } from './summon-vfx.component';

describe('Summon VFX lifecycle', () => {
  // Angular's render scheduler also requests frames; count only this effect's callback.
  const loop = (c: SummonVfxComponent) => (c as unknown as { animate: FrameRequestCallback }).animate;
  const count = (c: SummonVfxComponent, spy: jasmine.Spy) => spy.calls.allArgs().filter(([cb]) => cb === loop(c)).length;
  let raf: jasmine.Spy, cancel: jasmine.Spy;
  let media: MediaQueryList;
  beforeEach(() => {
    media = { matches: false, addEventListener: jasmine.createSpy(), removeEventListener: jasmine.createSpy() } as unknown as MediaQueryList;
    spyOn(window, 'matchMedia').and.returnValue(media);
    spyOnProperty(document, 'hidden', 'get').and.returnValue(false);
    raf = spyOn(window, 'requestAnimationFrame').and.returnValue(41);
    cancel = spyOn(window, 'cancelAnimationFrame');
    TestBed.configureTestingModule({ imports: [SummonVfxComponent] });
  });
  it('keeps one loop through mode changes, cancels while paused and cleans up on destroy', () => {
    const f = TestBed.createComponent(SummonVfxComponent);
    f.detectChanges();
    expect(count(f.componentInstance, raf)).toBe(1);
    f.componentRef.setInput('mode', 'burst'); f.detectChanges();
    expect(count(f.componentInstance, raf)).toBe(1);
    f.componentRef.setInput('paused', true); f.detectChanges();
    expect(cancel).toHaveBeenCalledWith(41);
    f.componentRef.setInput('paused', false); f.detectChanges();
    expect(count(f.componentInstance, raf)).toBe(2);
    f.destroy();
    expect(cancel).toHaveBeenCalledWith(41);
    expect(media.removeEventListener).toHaveBeenCalledWith('change', jasmine.any(Function));
  });
  it('renders a static composition without starting a loop for reduced motion', () => {
    Object.defineProperty(media, 'matches', { value: true });
    const f = TestBed.createComponent(SummonVfxComponent);
    f.detectChanges();
    f.componentRef.setInput('mode', 'spotlight'); f.detectChanges();
    expect(count(f.componentInstance, raf)).toBe(0);
    f.destroy();
  });
});
