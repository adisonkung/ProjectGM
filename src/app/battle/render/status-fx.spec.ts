import { StatusFxInstance, StatusFxPlayback } from './status-fx';

describe('generic status-owned visual lifecycle', () => {
  const root: StatusFxInstance = { source: 1, target: 2, status: 'root', sprite: 'hero-sylvara.png', at: { r: 1, c: 9 } };
  function scene() {
    let next = 0;
    const shown = new Map<number, { name: string; target: number; loop: boolean }>();
    const spawns: string[] = [];
    const playback = new StatusFxPlayback({
      spawn: (name, target, _at, loop) => { shown.set(++next, { name, target, loop }); spawns.push(name); return next; },
      remove: ids => ids.forEach(id => shown.delete(id)),
    });
    return { playback, shown, spawns };
  }

  it('grows once, loops only the stable strip and retains the same visuals across status refreshes', () => {
    const s = scene();
    s.playback.sync([root], 1);
    expect(s.shown.size).toBe(2);
    expect([...s.shown.values()].filter(f => f.loop).map(f => f.name)).toEqual(['sw-s2-root-loop']);
    s.playback.sync([root], 1.5);
    expect([...s.shown.values()].map(f => f.name)).toEqual(['sw-s2-root-loop']);
    s.playback.sync([root], 2.5); // refreshed status remains present; do not restart growth
    expect(s.spawns.length).toBe(2);
    s.playback.sync([], 3);
    expect(s.shown.size).toBe(0);
  });

  it('removes growth/loop immediately on cleanse, death or reset, including during delayed loop startup', () => {
    const s = scene();
    s.playback.sync([root, { ...root, target: 3 }], 0);
    expect(s.shown.size).toBe(4);
    s.playback.sync([{ ...root, target: 3 }], 0.1);
    expect([...s.shown.values()].every(f => f.target === 3)).toBeTrue();
    s.playback.clear(); s.playback.clear();
    expect(s.shown.size).toBe(0);
    s.playback.sync([], 5);
    expect(s.spawns.length).toBe(4);
  });

  it('uses the actual caster metadata; rejected/missing statuses and other casters never show Sylvara roots', () => {
    const s = scene();
    s.playback.sync([{ ...root, sprite: 'hero-mirelle.png' }, { ...root, status: 'chill' }], 0);
    expect(s.shown.size).toBe(0);
    s.playback.sync([root], 1);
    s.playback.sync([{ ...root, source: 8, sprite: 'hero-kael.png' }], 1.1);
    expect(s.shown.size).toBe(0);
  });
});
