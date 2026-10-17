import { FieldDefinition } from '../../core/models/combat';
import { FieldSystem } from './fields';

describe('generic persistent fields', () => {
  const definition: FieldDefinition = { area: 'ADJACENT_8', duration: 3, interval: 1, effects: [] };

  it('keeps its original cell, delays the first pulse, includes the final boundary, then expires once', () => {
    const changes: string[] = [];
    const fields = new FieldSystem((f, state) => changes.push(`${f.id}:${state}`));
    const center = { r: 1, c: 7 };
    let pulses = 0;
    fields.add(1, center, definition, () => pulses++, () => true);
    center.c = 12;
    expect(fields.active[0].center).toEqual({ r: 1, c: 7 });
    fields.tick(0.9);
    expect(pulses).toBe(0);
    fields.tick(0.1);
    expect(pulses).toBe(1);
    fields.tick(2);
    expect(pulses).toBe(3);
    expect(fields.active.length).toBe(0);
    fields.tick(10);
    expect(pulses).toBe(3);
    expect(changes).toEqual(['1:start', '1:end']);
  });

  it('cancels on source death; clear cancels every remaining zone with no late pulses', () => {
    const fields = new FieldSystem();
    let alive = true;
    let pulses = 0;
    fields.add(1, { r: 0, c: 0 }, definition, () => pulses++, () => alive);
    fields.add(2, { r: 2, c: 9 }, definition, () => pulses++, () => true);
    alive = false;
    fields.tick(1);
    expect(pulses).toBe(1);
    expect(fields.active.map(f => f.sourceId)).toEqual([2]);
    fields.clear();
    fields.tick(20);
    expect(pulses).toBe(1);
    expect(fields.active.length).toBe(0);
  });

  it('rejects invalid periods rather than hanging the pulse loop', () => {
    const fields = new FieldSystem();
    for (const interval of [0, -1, NaN, Infinity]) {
      expect(() => fields.add(1, { r: 0, c: 0 }, { ...definition, interval }, () => undefined, () => true)).toThrow();
    }
  });

  it('reports expiry, source death and clear distinctly without changing pulse behavior', () => {
    const reasons: string[] = [];
    let alive = true;
    const fields = new FieldSystem((_f, state, reason) => { if (state === 'end') reasons.push(reason!); });
    fields.add(1, { r: 1, c: 7 }, definition, () => undefined, () => true);
    fields.tick(3);
    fields.add(2, { r: 1, c: 7 }, definition, () => undefined, () => alive);
    alive = false; fields.tick(0.05);
    fields.add(3, { r: 1, c: 7 }, definition, () => undefined, () => true);
    fields.clear(); fields.clear();
    expect(reasons).toEqual(['EXPIRED', 'SOURCE_DIED', 'CLEARED']);
  });
});
