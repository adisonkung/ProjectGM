import { distance, Grid } from './grid';
import { nextStep } from './pathfinding';

describe('nextStep', () => {
  it('steps toward a goal around blockers', () => {
    const g = new Grid();
    g.place(9, { r: 1, c: 4 });
    const step = nextStep(g, { r: 1, c: 5 }, c => distance(c, { r: 1, c: 1 }) <= 1);
    expect(step).not.toBeNull();
    expect(g.isFree(step!)).toBeTrue();
    expect(step!.c).toBe(4);
  });

  it('returns null when already in range', () => {
    expect(nextStep(new Grid(), { r: 2, c: 2 }, () => true)).toBeNull();
  });
});
