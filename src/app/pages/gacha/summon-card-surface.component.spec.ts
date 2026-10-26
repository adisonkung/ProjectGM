import { TestBed } from '@angular/core/testing';
import { SummonCardSurfaceComponent } from './summon-card-surface.component';

describe('Flexible summon card surface', () => {
  let animate: jasmine.Spy, media: MediaQueryList;
  const handles: Animation[] = [];
  beforeEach(() => {
    handles.length = 0;
    media = { matches:false, addEventListener:jasmine.createSpy(), removeEventListener:jasmine.createSpy() } as unknown as MediaQueryList;
    spyOn(window, 'matchMedia').and.returnValue(media);
    animate = spyOn(Element.prototype, 'animate').and.callFake(() => {
      const a = { cancel:jasmine.createSpy('cancel') } as unknown as Animation; handles.push(a); return a;
    });
    TestBed.configureTestingModule({ imports:[SummonCardSurfaceComponent] });
  });
  it('keeps wind running across unchanged inputs and cancels all hinges/lights on replacement and destroy', () => {
    const f = TestBed.createComponent(SummonCardSurfaceComponent);
    f.componentRef.setInput('src', '/ui/eldervane/summon-card-celestial.webp'); f.componentRef.setInput('seed', 2); f.detectChanges();
    expect(f.nativeElement.querySelectorAll('.card-flex-bone').length).toBe(10);
    expect(animate).toHaveBeenCalledTimes(21);
    f.detectChanges(); expect(animate).toHaveBeenCalledTimes(21);
    f.componentRef.setInput('src', '/ui/eldervane/summon-card-common.webp'); f.detectChanges();
    expect(animate).toHaveBeenCalledTimes(42);
    expect(handles.slice(0,21).every(a => (a.cancel as jasmine.Spy).calls.count() === 1)).toBeTrue();
    f.destroy();
    expect(handles.every(a => (a.cancel as jasmine.Spy).calls.count() === 1)).toBeTrue();
    expect(media.removeEventListener).toHaveBeenCalledWith('change', jasmine.any(Function));
  });
  it('builds a complete static card without wind or light loops for reduced motion', () => {
    Object.defineProperty(media, 'matches', { value:true });
    const f = TestBed.createComponent(SummonCardSurfaceComponent);
    f.componentRef.setInput('src', '/ui/eldervane/summon-card-common.webp'); f.detectChanges();
    expect(f.nativeElement.querySelectorAll('.card-flex-face').length).toBe(10);
    expect(animate).not.toHaveBeenCalled(); f.destroy();
  });
});
