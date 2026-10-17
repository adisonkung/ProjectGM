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

  it('Winterglass Field has exactly six light pulses on occupants, with no launch burst or damaging shatter', () => {
    const review = skillReview('mirelle', 'ult', { r: 1, c: 5 }, targets);
    const start = review.samples.find(s => s.events.some(e => e.type === 'FIELD_STARTED'))!;
    expect(start).toBeDefined();
    expect(review.samples.filter(s => s.t < start.t + 0.9).flatMap(s => s.events).some(e => e.type === 'damage')).toBeFalse();
    const hits = review.samples.filter(s => s.events.some(e => e.type === 'damage'));
    expect(hits.length).toBe(6);
    expect(hits.flatMap(s => s.events).filter(e => e.type === 'damage').length).toBe(24);
    const events = review.samples.flatMap(s => s.events);
    const ends = events.filter(e => e.type === 'FIELD_ENDED');
    expect(ends.length).toBe(1);
    if (ends[0].type === 'FIELD_ENDED') expect(ends[0].reason).toBe('EXPIRED');
    expect(events.filter(e => e.type === 'buff' && e.buff === 'root')).toEqual([]);
    expect(events.filter(e => e.type === 'buff' && e.buff === 'frost_fatigue').length).toBe(24);
  });

  it('final Sync actual events use the 50ms combat step: projectile arrival, one S2 hit and independent field expiry', () => {
    const s1 = skillReview('mirelle', 'skill', { r: 1, c: 5 }, targets.slice(0, 1));
    const launch = s1.samples.find(s => s.events.some(e => e.type === 'projectile'))!;
    const contact = s1.samples.find(s => s.events.some(e => e.type === 'damage'))!;
    expect(launch.t).toBeCloseTo(0.5, 8);
    expect(contact.t).toBeCloseTo(0.85, 8); // distance4:0.34s flight, arrival rounded by combat step
    expect(launch.events.some(e => e.type === 'damage' || e.type === 'buff')).toBeFalse();
    const s2 = skillReview('mirelle', 'skill2', { r: 1, c: 5 }, targets);
    const hits = s2.samples.filter(s => s.events.some(e => e.type === 'damage'));
    expect(hits.length).toBe(1);
    expect(hits[0].t).toBeCloseTo(1, 8);
    const ult = skillReview('mirelle', 'ult', { r: 1, c: 5 }, targets);
    expect(ult.samples.find(s => s.events.some(e => e.type === 'FIELD_STARTED'))!.t).toBeCloseTo(1.2, 8);
    expect(ult.samples.find(s => s.events.some(e => e.type === 'FIELD_ENDED'))!.t).toBeCloseTo(7.2, 8);
    expect(ult.samples.find(s => s.events.some(e => e.type === 'animEvent' && e.event === 'ANIMATION_END'))!.t).toBeCloseTo(1.8, 8);
    expect(ult.samples.filter(s => s.events.some(e => e.type === 'damage')).map(s => Number(s.t.toFixed(2))))
      .toEqual([2.2, 3.2, 4.2, 5.2, 6.2, 7.2]);
  });
});

describe('Verdant Snare actual-engine projectile review', () => {
  const targets = [
    { id: 2, pos: { r: 1, c: 9 } }, { id: 3, pos: { r: 1, c: 10 } },
    { id: 4, pos: { r: 2, c: 9 } }, { id: 5, pos: { r: 2, c: 10 } },
  ];
  it('has one arrow, then four damage/Root results at arrival; no periodic damage or field', () => {
    const r = skillReview('sylvara', 'skill2', { r: 1, c: 5 }, targets);
    const launch = r.samples.find(s => s.events.some(e => e.type === 'projectile'))!;
    const contact = r.samples.find(s => s.events.some(e => e.type === 'damage'))!;
    const events = r.samples.flatMap(s => s.events);
    expect(launch.t).toBeCloseTo(0.35, 8);
    expect(contact.t).toBeCloseTo(0.7, 8);
    expect(launch.events.some(e => e.type === 'damage' || e.type === 'buff')).toBeFalse();
    expect(events.filter(e => e.type === 'projectile').length).toBe(1);
    expect(events.filter(e => e.type === 'damage').length).toBe(4);
    expect(events.filter(e => e.type === 'buff' && e.buff === 'root').length).toBe(4);
    expect(events.filter(e => e.type === 'FIELD_STARTED').length).toBe(0);
    expect(Object.values(contact.statuses).flat().filter(b => b.id === 'root').every(b => b.sourceId === 1)).toBeTrue();
    expect(Object.values(r.samples.at(-1)!.statuses).flat().some(b => b.id === 'root')).toBeFalse();
  });

  it('does not invent a Root on the Unstoppable target; the remaining occupants still get Root', () => {
    const r = skillReview('sylvara', 'skill2', { r: 1, c: 5 }, targets.map((t, i) => ({ ...t, statuses: i === 0 ? ['gate_stance'] : [] })));
    const roots = r.samples.flatMap(s => s.events).filter(e => e.type === 'buff' && e.buff === 'root');
    expect(roots.length).toBe(3);
    expect(roots.every(e => e.type === 'buff' && r.ids.get(e.dst) !== 2)).toBeTrue();
  });
});


describe('Emerald Skyfall actual-engine five-wave review', () => {
  it('launches one visual arrow, activates after ascent, and resolves five occupant pulses with no launch/end damage', () => {
    const targets = [1, 2].flatMap(r => [9, 8, 10].map(c => ({ id: r * 10 + c, pos: { r, c } })));
    const review = skillReview('sylvara', 'ult', { r: 1, c: 5 }, targets);
    const events = review.samples.flatMap(s => s.events);
    const release = review.samples.find(s => s.events.some(e => e.type === 'animEvent' && e.event === 'PROJECTILE_SPAWN'))!;
    const start = review.samples.find(s => s.events.some(e => e.type === 'FIELD_STARTED'))!;
    expect(release.t).toBeCloseTo(0.7, 8);
    expect(start.t).toBeCloseTo(1.2, 8);
    expect(events.filter(e => e.type === 'animEvent' && e.event === 'PROJECTILE_SPAWN').length).toBe(1);
    expect(events.filter(e => e.type === 'projectile')).toEqual([]); // ascent is visual, never a damaging homing arrow
    expect(review.samples.filter(s => s.t < 2.19).flatMap(s => s.events).some(e => e.type === 'damage')).toBeFalse();
    const pulses = review.samples.filter(s => s.events.some(e => e.type === 'FIELD_PULSED'));
    expect(pulses.map(s => Number(s.t.toFixed(2)))).toEqual([2.2, 3.2, 4.2, 5.2, 6.2]);
    expect(pulses.flatMap(s => s.events).filter(e => e.type === 'damage').length).toBe(30);
    expect(events.filter(e => e.type === 'FIELD_PULSED').map(e => e.type === 'FIELD_PULSED' ? e.index : -1)).toEqual([0, 1, 2, 3, 4]);
    expect(events.filter(e => e.type === 'buff')).toEqual([]);
    expect(review.samples.find(s => s.events.some(e => e.type === 'FIELD_ENDED'))!.t).toBeCloseTo(6.2, 8);
  });
});

describe('targeted support skill review', () => {
  it('casts on a real injured ally once and shows no enemy damage/projectile', () => {
    const review = skillReview('elira', 'skill', { r: 1, c: 5 }, [{ id: 2, pos: { r: 1, c: 9 } }, { id: 3, pos: { r: 1, c: 10 } }]);
    const heal = review.samples.filter(s => s.events.some(e => e.type === 'heal'));
    expect(heal.length).toBe(1); expect(heal[0].t).toBeCloseTo(0.5, 6);
    const events = review.samples.flatMap(s => s.events);
    const effect = events.find(e => e.type === 'heal')!;
    if (effect.type === 'heal') { expect(review.ids.get(effect.dst)).toBe(2); expect(effect.amount).toBeGreaterThan(0); }
    expect(events.some(e => e.type === 'damage' || e.type === 'projectile')).toBeFalse();
    const impact = events.find(e => e.type === 'impact');
    if (impact?.type !== 'impact') throw new Error('Missing heal impact');
    expect(impact.hits!.map(id => review.ids.get(id))).toEqual([2]);
  });
});

describe('Sanctuary Veil support-only impact and shield lifetime', () => {
  it('grants one shield to the actual selected ally at F7 and reports its expiry independently of the flare', () => {
    const review = skillReview('elira', 'skill2', { r: 1, c: 5 }, [{ id: 2, pos: { r: 1, c: 8 } }, { id: 3, pos: { r: 1, c: 9 } }]);
    const events = review.samples.flatMap(s => s.events);
    const grants = review.samples.filter(s => s.events.some(e => e.type === 'shield'));
    expect(grants.length).toBe(1); expect(grants[0].t).toBeCloseTo(0.5, 6);
    const shield = events.find(e => e.type === 'shield')!;
    if (shield.type !== 'shield') throw new Error('Missing shield');
    expect(review.ids.get(shield.dst)).toBe(2);
    expect(shield.amount).toBeGreaterThan(0);
    const impacts = events.filter(e => e.type === 'impact');
    expect(impacts.length).toBe(1);
    if (impacts[0].type === 'impact') expect(impacts[0].hits!.map(id => review.ids.get(id))).toEqual([2]);
    expect(events.some(e => e.type === 'damage' || e.type === 'heal' || e.type === 'projectile')).toBeFalse();
    expect(review.samples.find(s => s.t >= 2)!.vitals[2].shieldPct).toBeGreaterThan(0);
    expect(review.samples.at(-1)!.vitals[2].shieldPct).toBe(0);
    expect(review.samples.at(-1)!.vitals[3].shieldPct).toBe(0);
  });
});
