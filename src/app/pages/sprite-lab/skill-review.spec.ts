import { appliedStatusFx, FX, fxFor } from '../../core/data/sprites';
import { groundFxCell } from '../../battle/render/fx-clip';
import { skillReview } from './skill-review';

describe('Glassbind isolated skill review and generic presentation', () => {
  const targets = [
    { id: 2, pos: { r: 1, c: 9 } }, { id: 3, pos: { r: 1, c: 10 } },
    { id: 4, pos: { r: 2, c: 9 } }, { id: 5, pos: { r: 2, c: 10 } },
  ];

  it('no pre-existing Chill gives four hits and Chill applications, never a Root/Bind or periodic damage', () => {
    const review = skillReview('mirelle', 'skill2', { r: 1, c: 5 }, targets);
    const events = review.samples.flatMap(s => s.events);
    expect(events.filter(e => e.type === 'damage').length).toBe(4);
    expect(events.filter(e => e.type === 'buff' && e.buff === 'chill').length).toBe(4);
    expect(events.filter(e => e.type === 'buff' && e.buff === 'root')).toEqual([]);
    expect(events.filter(e => e.type === 'FIELD_STARTED')).toEqual([]);
    expect(events.filter(e => e.type === 'projectile')).toEqual([]);
  });

  it('only a successful Root on the pre-Chilled target selects Bind; source kit and original target data stay unchanged', () => {
    const snapshot = JSON.stringify(targets);
    const input = targets.map((t, i) => ({ ...t, statuses: i === 0 ? ['chill'] : [] }));
    const review = skillReview('mirelle', 'skill2', { r: 1, c: 5 }, input);
    const roots = review.samples.flatMap(s => s.events).filter(e => e.type === 'buff' && e.buff === 'root');
    expect(roots.length).toBe(1);
    if (roots[0].type === 'buff') expect(review.ids.get(roots[0].dst)).toBe(2);
    expect(appliedStatusFx('hero-mirelle.png', 'root')).toBe('mf-s2-bind');
    expect(appliedStatusFx('hero-mirelle.png', 'chill')).toBeUndefined();
    expect(appliedStatusFx('hero-kael.png', 'root')).toBeUndefined();
    expect(JSON.stringify(targets)).toBe(snapshot);
    expect(review.samples.at(-1)!.statuses[2].map(b => b.id)).not.toContain('root');
    expect(fxFor('hero-mirelle.png', 'skill2', { on: 'event', event: 'VFX_SPAWN' })).toEqual(['mf-s2-main']);
    expect(fxFor('hero-mirelle.png', 'skill2', { on: 'impact' })).toEqual([]);
  });

  it('ground placement matches the oriented 2×2 cells at either facing and the bottom lane, independent of PNG size', () => {
    const d = FX['mf-s2-main'];
    expect(groundFxCell(d, { r: 1, c: 5 }, { r: 1, c: 9 })).toEqual({ r: 1.5, c: 9.5 });
    expect(groundFxCell(d, { r: 1, c: 8 }, { r: 2, c: 4 })).toEqual({ r: 1.5, c: 3.5 });
    expect(groundFxCell({ ...d, w: 999, h: 999 }, { r: 1, c: 5 }, { r: 1, c: 9 })).toEqual({ r: 1.5, c: 9.5 });
    expect(groundFxCell(FX['mf-s2-bind'], { r: 1, c: 5 }, { r: 2, c: 9 })).toEqual({ r: 2, c: 9 });
  });
});
