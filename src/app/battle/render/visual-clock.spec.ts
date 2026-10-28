import { visualGameClock } from './visual-clock';

describe('authoritative visual game clock', () => {
  it('stays within the latest fixed simulation interval, including a slow display frame', () => {
    expect(visualGameClock(4.2,1,.05)).toBeCloseTo(4.2,8);
    expect(visualGameClock(4.2,0,.05)).toBeCloseTo(4.15,8);
    expect(visualGameClock(4.2,.5,.05)).toBeCloseTo(4.175,8);
    // Large gaps between display frames do not accumulate an independent half-speed clock.
    expect(visualGameClock(9,1,.05)).toBe(9);
  });
  it('accounts for battle speed and clamps preparation / interpolation bounds', () => {
    expect(visualGameClock(4,0,.2)).toBeCloseTo(3.8,8);
    expect(visualGameClock(0,0,.05)).toBe(0);
    expect(visualGameClock(2,4,.05)).toBe(2);
    expect(visualGameClock(2,-1,.05)).toBeCloseTo(1.95,8);
  });
});
