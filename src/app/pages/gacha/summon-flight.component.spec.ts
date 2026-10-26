import { Component, input } from '@angular/core';
import { SummonCardSurfaceComponent } from './summon-card-surface.component';
import { TestBed } from '@angular/core/testing';
import { SummonFlightComponent } from './summon-flight.component';

@Component({ selector:'app-summon-card-surface', template:'' })
class SurfaceStub { readonly src=input(''); readonly seed=input(0); }

describe('Summon card flight continuity', () => {
  let animate: jasmine.Spy;
  const created: Animation[] = [];
  beforeEach(() => {
    created.length = 0;
    spyOn(window, 'matchMedia').and.returnValue({ matches: false } as MediaQueryList);
    animate = spyOn(Element.prototype, 'animate').and.callFake(() => {
      const animation = { cancel: jasmine.createSpy('cancel') } as unknown as Animation;
      created.push(animation); return animation;
    });
    TestBed.configureTestingModule({ imports: [SummonFlightComponent] });
    TestBed.overrideComponent(SummonFlightComponent, { remove:{ imports:[SummonCardSurfaceComponent] }, add:{ imports:[SurfaceStub] } });
  });
  it('releases from the exact collected pose and cancels old and destroyed animations', () => {
    const f = TestBed.createComponent(SummonFlightComponent);
    f.componentRef.setInput('stars', [3, 2]); f.componentRef.setInput('grand', true); f.detectChanges();
    expect(f.nativeElement.querySelectorAll('.flight').length).toBe(2);
    expect(animate).toHaveBeenCalledTimes(4); // two card transforms and their directional wakes
    const gather = animate.calls.argsFor(0)[0] as Keyframe[];
    const gathered = [...created];
    f.componentRef.setInput('release', true); f.detectChanges();
    expect(animate).toHaveBeenCalledTimes(8);
    const release = animate.calls.argsFor(4)[0] as Keyframe[];
    expect(release[0]['transform']).toBe(gather[gather.length - 1]['transform']);
    expect(gathered.every(a => (a.cancel as jasmine.Spy).calls.count() === 1)).toBeTrue();
    f.destroy();
    expect(created.every(a => (a.cancel as jasmine.Spy).calls.count() === 1)).toBeTrue();
  });
  it('starts no flight animations when reduced motion is requested', () => {
    (window.matchMedia as jasmine.Spy).and.returnValue({ matches: true } as MediaQueryList);
    const f = TestBed.createComponent(SummonFlightComponent);
    f.componentRef.setInput('stars', [3]); f.detectChanges();
    expect(animate).not.toHaveBeenCalled(); f.destroy();
  });
});
