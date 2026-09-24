import { distance, Grid } from './grid';
import { nextStep } from './pathfinding';

describe('nextStep', () => {
  it('steps toward a goal around blockers', () => {
    const g = new Grid();
    g.place(9, { r: 3, c: 3 });
    const step = nextStep(g, { r: 4, c: 3 }, c => distance(c, { r: 1, c: 3 }) <= 1);
    expect(step).not.toBeNull();
    expect(g.isFree(step!)).toBeTrue();
    expect(step!.r).toBe(3);
  });

  it('returns null when already in range', () => {
    expect(nextStep(new Grid(), { r: 2, c: 2 }, () => true)).toBeNull();
  });
});
