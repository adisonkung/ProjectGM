import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { SaveService } from '../../core/services/save.service';
import { IslandComponent } from './island.component';

describe('Home tower entrance acknowledgement', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [IslandComponent], providers: [provideRouter([])] });
    TestBed.overrideComponent(IslandComponent, { set: { template: '', imports: [] } });
    TestBed.inject(SaveService).reset();
  });

  it('acknowledges once and navigates to the floor captured on press', fakeAsync(() => {
    spyOn(window, 'matchMedia').and.returnValue({ matches: false } as MediaQueryList);
    const save = TestBed.inject(SaveService);
    const navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    const fixture = TestBed.createComponent(IslandComponent);
    const c = fixture.componentInstance;
    c.enterTower();
    c.enterTower();
    expect(c.enteringTower()).toBeTrue();
    tick(479);
    expect(navigate).not.toHaveBeenCalled();
    save.update(s => ({ ...s, cleared: 7 }));
    tick(1);
    expect(navigate).toHaveBeenCalledOnceWith(['/battle'], { queryParams: { floor: 1, mode: 'tower' } });
    fixture.destroy();
  }));

  it('cancels pending navigation when Home is destroyed', fakeAsync(() => {
    spyOn(window, 'matchMedia').and.returnValue({ matches: false } as MediaQueryList);
    const navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    const fixture = TestBed.createComponent(IslandComponent);
    fixture.componentInstance.enterTower();
    fixture.destroy();
    tick(600);
    expect(navigate).not.toHaveBeenCalled();
  }));

  it('skips motion delay and allows retry if navigation is cancelled', fakeAsync(() => {
    spyOn(window, 'matchMedia').and.returnValue({ matches: true } as MediaQueryList);
    const navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(false);
    const fixture = TestBed.createComponent(IslandComponent);
    fixture.componentInstance.enterTower();
    expect(navigate).toHaveBeenCalledOnceWith(['/battle'], { queryParams: { floor: 1, mode: 'tower' } });
    tick();
    expect(fixture.componentInstance.enteringTower()).toBeFalse();
    fixture.destroy();
  }));
});
