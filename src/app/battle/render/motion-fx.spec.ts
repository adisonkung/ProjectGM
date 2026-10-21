import { MotionFxPlayback } from './motion-fx';

describe('semantic dash FX ownership', () => {
  it('starts attached layers once, then removes both on arrival or cancellation without spawning damage FX', () => {
    const spawned: { name: string; source: number; loop: boolean }[] = [];
    const removed: number[][] = [];
    const player = new MotionFxPlayback({
      spawn: (name, source, loop) => { spawned.push({ name, source, loop }); return spawned.length; },
      remove: ids => removed.push(ids),
    });
    player.handle(1, 'hero-vaelric.png', 'skill', 'DASH_START');
    player.handle(1, 'hero-vaelric.png', 'skill', 'DASH_START');
    expect(spawned).toEqual([
      { name: 'vn-s1-main', source: 1, loop: false },
      { name: 'vn-s1-loop', source: 1, loop: true },
    ]);
    player.handle(1, 'hero-vaelric.png', 'skill', 'DAMAGE');
    expect(removed).toEqual([]);
    player.handle(1, 'hero-vaelric.png', 'skill', 'DASH_END');
    player.handle(1, 'hero-vaelric.png', 'skill', 'DASH_END');
    expect(removed).toEqual([[1, 2]]);
    player.handle(2, 'hero-vaelric.png', 'skill', 'DASH_START');
    player.clear();
    expect(removed).toEqual([[1, 2], [3, 4]]);
  });
});
