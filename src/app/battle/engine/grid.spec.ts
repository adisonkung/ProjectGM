import { BOARD_COLS, distance, Grid, toBoard, zoneOf } from './grid';

describe('Grid', () => {
  it('measures 8-direction distance', () => {
    expect(distance({ r: 0, c: 0 }, { r: 3, c: 2 })).toBe(3);
  });

  it('maps each side to its own half of the board', () => {
    // แนวนอน 3 เลน x 16: ฝั่งเราซ้าย (0-5) โซนกลาง (6-9) ศัตรูขวา (10-15), r ในฝั่ง = ความลึก, c = เลน
    expect(BOARD_COLS).toBe(16);
    expect(toBoard('ally', { r: 0, c: 1 })).toEqual({ r: 1, c: 5 });
    expect(toBoard('ally', { r: 5, c: 0 })).toEqual({ r: 0, c: 0 });
    expect(toBoard('enemy', { r: 0, c: 1 })).toEqual({ r: 1, c: 10 });
    expect(toBoard('enemy', { r: 5, c: 2 })).toEqual({ r: 2, c: 15 });
    expect([0, 5, 6, 9, 10, 15].map(c => zoneOf({ r: 0, c }))).toEqual(['ally', 'ally', 'neutral', 'neutral', 'enemy', 'enemy']);
  });

  it('tracks occupied cells', () => {
    const g = new Grid();
    g.place(1, { r: 2, c: 2 });
    expect(g.isFree({ r: 2, c: 2 })).toBeFalse();
    g.move(1, { r: 2, c: 2 }, { r: 1, c: 2 });
    expect(g.isFree({ r: 2, c: 2 })).toBeTrue();
    expect(g.occupant({ r: 1, c: 2 })).toBe(1);
    expect(g.occupant({ r: 3 - 1, c: 2 })).toBeUndefined();
  });

  it('allows stacking up to the cap', () => {
    const g = new Grid(2);
    g.place(1, { r: 1, c: 4 });
    expect(g.isFree({ r: 1, c: 4 })).toBeFalse();
    expect(g.canEnter({ r: 1, c: 4 })).toBeTrue();
    g.place(2, { r: 1, c: 4 });
    expect(g.canEnter({ r: 1, c: 4 })).toBeFalse();
    g.remove(1, { r: 1, c: 4 });
    expect(g.occupants({ r: 1, c: 4 })).toEqual([2]);
  });
});
