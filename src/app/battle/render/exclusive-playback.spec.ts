import { PlaybackClocks } from './exclusive-playback';
import { FxAnchors } from './fx-anchor';

describe('exclusive animation clocks', () => {
  it('resumes from the held frame instead of jumping to global time', () => {
    const c = new PlaybackClocks();
    expect(c.sample('other', 1, false)).toBe(1);
    expect(c.sample('ult', 1, false)).toBe(1);
    expect(c.sample('other', 2, true)).toBe(1);
    expect(c.sample('ult', 2, false)).toBe(2);
    expect(c.sample('other', 5, true)).toBe(1);
    expect(c.sample('other', 5.1, false)).toBeCloseTo(1.1);
    c.retain(new Set());
    expect(c.sample('other', 6, false)).toBe(6);
  });

  it('uses the held instance clock for anchor locking too', () => {
    const a = new FxAnchors(), c = new PlaybackClocks();
    const fx = [{ id: 1, r: 0, c: 0, follow: 5, lockAfterMs: 200 }];
    a.sync(fx, id => c.sample(String(id), 0, false), 0, () => ({ x: 100, y: 100 }));
    a.sync(fx, id => c.sample(String(id), 3, true), 0, () => ({ x: 100, y: 100 }));
    expect(a.at(1)?.locked).toBeFalse();
    a.sync(fx, id => c.sample(String(id), 3.1, false), 0, () => ({ x: 120, y: 100 }));
    expect(a.at(1)?.locked).toBeFalse();
    a.sync(fx, id => c.sample(String(id), 3.3, false), 0, () => ({ x: 140, y: 100 }));
    expect(a.at(1)?.locked).toBeTrue();
  });
});
