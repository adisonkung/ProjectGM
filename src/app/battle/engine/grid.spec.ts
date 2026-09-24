import { distance, Grid, toBoard } from './grid';

describe('Grid', () => {
  it('measures 8-direction distance', () => {
    expect(distance({ r: 0, c: 0 }, { r: 3, c: 2 })).toBe(3);
  });

  it('maps each side to its own half of the board', () => {
    expect(toBoard('ally', { r: 0, c: 3 })).toEqual({ r: 4, c: 3 });
    expect(toBoard('enemy', { r: 0, c: 3 })).toEqual({ r: 3, c: 3 });
    expect(toBoard('enemy', { r: 3, c: 0 })).toEqual({ r: 0, c: 0 });
  });

  it('tracks occupied cells', () => {
    const g = new Grid();
    g.place(1, { r: 2, c: 2 });
    expect(g.isFree({ r: 2, c: 2 })).toBeFalse();
    g.move(1, { r: 2, c: 2 }, { r: 3, c: 2 });
    expect(g.isFree({ r: 2, c: 2 })).toBeTrue();
    expect(g.occupant({ r: 3, c: 2 })).toBe(1);
  });
});
