import { SHEETS, SheetDef } from '../../core/data/sprites';
import { clipTimeline, UnitClip } from './unit-clip';

/** the Pixi renderer's clip logic: one clock in, a pose out — the same rules as the DOM unit sprite */
describe('UnitClip (one-clock character animation)', () => {
  const kael = SHEETS['hero-kael.png'];
  const a = kael.anims;

  it('idle breathes on the real-time clock (never sped up by x2 / x4) and is frozen when the clock is', () => {
    const c = new UnitClip(kael, 0);
    const ms = (a.idle!.ms ?? 150) / 1000;
    const p0 = c.pose(0, 0, false);
    expect(p0.row).toBe(a.idle!.row);
    expect(c.pose(5, 0, false).col).toBe(p0.col);                                 // game clock ran, idle clock did not
    expect(c.pose(5, ms * 1.01, false).col).not.toBe(p0.col);
  });

  it('an action clip runs on the game clock, then falls back to idle (or walk while moving)', () => {
    const c = new UnitClip(kael, 0);
    c.request({ anim: 'attack' }, 1, 10, false);
    const ms = (a.attack!.ms ?? 85) / 1000;
    expect(c.pose(10, 0, false)).toEqual(jasmine.objectContaining({ row: a.attack!.row, col: 0 }));
    expect(c.pose(10 + 2.5 * ms, 0, false).col).toBe(2);
    expect(c.pose(10 + 2.5 * ms, 0, false).col).toBe(2);                         // same clock = same frame (frozen)
    c.pose(10 + a.attack!.frames * ms + 0.001, 0, false);
    expect(c.name).toBe('idle');
    c.request({ anim: 'attack' }, 2, 20, true);
    c.pose(20 + a.attack!.frames * ms + 0.001, 0, true);
    expect(c.name).toBe('walk');
  });

  it('hurt never cuts an attack or a skill, unless forced (interrupted cast); death holds its last frame', () => {
    const c = new UnitClip(kael, 0);
    c.request({ anim: 'skill' }, 1, 0, false);
    c.request({ anim: 'hurt' }, 2, 0.1, false);
    expect(c.name).toBe('skill');
    c.request({ anim: 'hurt', force: true }, 3, 0.2, false);
    expect(c.name).toBe('hurt');
    c.request({ anim: 'die' }, 4, 1, false);
    const end = c.pose(99, 0, false);
    expect([end.row, end.col]).toEqual([a.die!.row, a.die!.frames - 1]);
    c.request({ anim: 'attack' }, 5, 100, false);
    expect(c.name).toBe('die');
  });

  it('choreographed clips follow seq + steps (Kael Ult holds: F6 for 300 ms)', () => {
    const ult = a.ult!;
    const tl = clipTimeline(ult, 'ult', { anim: 'ult' });
    const steps = ult.steps!;
    expect(tl.duration).toBeCloseTo(steps.reduce((x, y) => x + y, 0) / 1000, 6);
    const startF6 = steps.slice(0, 5).reduce((x, y) => x + y, 0) / 1000;
    expect(tl.frameAt(startF6 + 0.01)).toBe(ult.seq![5]);
    expect(tl.frameAt(startF6 + 0.29)).toBe(ult.seq![5]);
    expect(tl.frameAt(startF6 + 0.31)).toBe(ult.seq![6]);
  });

  it('Phantom Crossing holds F8 throughout movement and preserves every recovery pose before Idle', () => {
    const sheet = SHEETS['hero-vaelric.png'];
    const tl = clipTimeline(sheet.anims.skill!, 'skill', { anim: 'skill' });
    expect(tl.frameAt(.30 + 1e-7)).toBe(7);
    expect(tl.frameAt(.599999)).toBe(7);
    expect(tl.frameAt(.600001)).toBe(8);
    for (let frame = 9; frame <= 25; frame++) {
      expect(tl.frameAt(.6 + (frame - 9) * .03 + .015)).toBe(frame - 1);
    }
    const c = new UnitClip(sheet, 0);
    c.request({ anim: 'skill' }, 1, 0, false);
    c.request({ anim: 'hurt' }, 2, .7, false);
    expect(c.pose(1.109, 0, false)).toEqual(jasmine.objectContaining({ row: 5, col: 24 }));
    c.pose(1.111, 0, false);
    expect(c.name).toBe('idle');
  });

  it('Hollow Requiem plays all25 poses at20FPS without hit pauses, then returns to Idle', () => {
    const sheet = SHEETS['hero-vaelric.png'];
    const c = new UnitClip(sheet,0); c.request({anim:'skill2'},1,0,false);
    for (let frame=0;frame<25;frame++) expect(c.pose(frame*.05+.025,0,false)).toEqual(jasmine.objectContaining({row:6,col:frame}));
    c.pose(1.251,0,false);expect(c.name).toBe('idle');
  });

  it('root motion and opacity curves are sampled on the clip clock (Mo Ye Phantom Step)', () => {
    const s2 = SHEETS['hero-moye.png'].anims.skill2!;
    const tl = clipTimeline(s2, 'skill2', { anim: 'skill2' });
    expect(tl.opacityAt(0)).toBe(1);
    const mid = tl.duration * 0.4;
    expect(tl.opacityAt(mid)).toBeLessThan(0.5);
    expect(tl.opacityAt(tl.duration)).toBeCloseTo(1, 3);
  });

  it('the walk loop advances with the ground speed (pace) — slower legs at a slower walk, no restart', () => {
    const fast = new UnitClip(kael, 0);
    const slow = new UnitClip(kael, 0);
    fast.pose(0, 0, true, 2.3);
    slow.pose(0, 0, true, 1.15);
    const frames = a.walk!.frames;
    const cycle = (frames * (a.walk!.ms ?? 85)) / 1000;
    for (let t = 1 / 60; t < cycle * 0.5; t += 1 / 60) {
      fast.pose(t, 0, true, 2.3);
      slow.pose(t, 0, true, 1.15);
    }
    const f = fast.pose(cycle * 0.5, 0, true, 2.3).col;
    const s = slow.pose(cycle * 0.5, 0, true, 1.15).col;
    expect(f).toBeGreaterThan(s);
    expect(f).toBe(Math.floor(frames * 0.5));
  });

  it('monster cast stretches CAST_START → SKILL_ACTIVATE over the cast time', () => {
    const def = Object.values(SHEETS).find(d => d.anims.cast?.castStart != null && d.anims.cast?.activate != null) as SheetDef;
    const cast = def.anims.cast!;
    const tl = clipTimeline(cast, 'cast', { anim: 'cast', castTime: 2 });
    const ms = (cast.ms ?? 85) / 1000;
    expect(tl.duration).toBeCloseTo(2 + (cast.frames - cast.activate!) * ms, 6);
    expect(tl.frameAt(0)).toBe(cast.castStart!);
    expect(tl.frameAt(1.999)).toBe(cast.activate! - 1);
    expect(tl.frameAt(2.001)).toBe(cast.activate!);
  });
});
