import { SHEETS } from '../../core/data/sprites';
import { unitGeometry } from './unit-geometry';

describe('feet-anchored character scale', () => {
  it('enlarges Jadecrest 25% without moving its feet at desktop or mobile cell sizes', () => {
    const def = SHEETS['enemy-jadecrest-guardian.png'];
    for (const cell of [44,80,100]) {
      const old = unitGeometry({...def,displayScale:1},cell), scaled = unitGeometry(def,cell);
      expect(scaled.width / old.width).toBeCloseTo(1.25,8);
      expect(scaled.height / old.height).toBeCloseTo(1.25,8);
      expect(scaled.bottomY - 14*scaled.k).toBeCloseTo(old.bottomY - 14*old.k,8);
    }
    expect(SHEETS['enemy-aegis-sentinel.png'].displayScale).toBeUndefined();
  });
});
