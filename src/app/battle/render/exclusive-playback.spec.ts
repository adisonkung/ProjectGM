import { PlaybackClocks } from './exclusive-playback';

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
});
