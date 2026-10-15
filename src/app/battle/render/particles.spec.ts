import { FX } from '../../core/data/sprites';
import { PARTICLES, particleDef } from '../../core/data/particles';
import { Emitter, particleRng } from './particles';

describe('particles (one-clock emitters)', () => {
  const rng = () => particleRng(7);

  it('a burst spawns its count at once, falls with gravity and is gone after its life', () => {
    const e = new Emitter(PARTICLES['debris'], 5, 3, false, rng());
    expect(e.particles.length).toBe(PARTICLES['debris'].count);
    const y0 = e.particles.map(p => p.y);
    for (let i = 0; i < 20; i++) e.step(0.016);
    expect(e.particles.every((p, i) => p.vy > -100 && p.y !== y0[i])).toBeTrue();
    for (let i = 0; i < 80; i++) e.step(0.016);
    expect(e.done).toBeTrue();
  });

  it('dt 0 (pause / hit-stop) freezes every particle', () => {
    const e = new Emitter(PARTICLES['sparks'], 0, 0, false, rng());
    e.step(0.05);
    const snap = JSON.stringify(e.particles);
    e.step(0);
    expect(JSON.stringify(e.particles)).toBe(snap);
  });

  it('launch angles mirror for a left-facing FX', () => {
    const r = new Emitter({ ...PARTICLES['embers'], area: [0, 0] }, 0, 0, false, rng());
    const l = new Emitter({ ...PARTICLES['embers'], area: [0, 0] }, 0, 0, true, rng());
    r.particles.forEach((p, i) => expect(l.particles[i].vx).toBeCloseTo(-p.vx, 6));
    expect(r.particles.every(p => p.vy < 0)).toBeTrue(); // embers fly upward
  });

  it('a rate emitter keeps emitting for its duration, then drains', () => {
    const e = new Emitter(PARTICLES['ember-rise'], 0, 0, false, rng(), 1);
    expect(e.particles.length).toBe(0);
    for (let i = 0; i < 30; i++) e.step(1 / 30);
    expect(e.particles.length).toBeGreaterThan(15);
    expect(e.done).toBeFalse();
    for (let i = 0; i < 120; i++) e.step(1 / 30);
    expect(e.done).toBeTrue();
  });

  it('alpha / size follow the life curve; overrides tint and scale a preset', () => {
    const e = new Emitter(PARTICLES['dust'], 0, 0, false, rng());
    const p = e.particles[0];
    expect(e.alphaOf(p)).toBe(1);
    p.age = p.life / 2;
    expect(e.alphaOf(p)).toBeCloseTo(0.5, 6);
    expect(e.sizeOf(p)).toBeCloseTo(p.size * (1 + (1.9 - 1) * 0.5), 6);
    const d = particleDef({ name: 'sparks', colors: [0x123456], count: 3, scale: 2 })!;
    expect([d.colors, d.count, d.size[0]]).toEqual([[0x123456], 3, PARTICLES['sparks'].size[0] * 2]);
  });

  it('every FX particle reference names a preset', () => {
    for (const [name, fx] of Object.entries(FX)) for (const ref of fx.particles ?? []) expect(particleDef(ref)).withContext(name).toBeDefined();
    expect(FX['kl-ult-slam'].particles).toEqual(['embers', 'debris', 'dust']);
  });
});
