import { Cell, Side } from '../../core/models/unit';

export const BOARD_ROWS = 8;
export const BOARD_COLS = 7;
/** ครึ่งกระดานของแต่ละฝั่งมี 4 แถว */
export const SIDE_ROWS = 4;

/** ระยะแบบ 8 ทิศ (แนวทแยงนับเป็น 1 ช่อง) */
export const distance = (a: Cell, b: Cell) => Math.max(Math.abs(a.r - b.r), Math.abs(a.c - b.c));

/**
 * แปลงพิกัดในครึ่งกระดานของฝั่งนั้น (r=0 คือแถวหน้า) เป็นพิกัดจริงบนกระดาน 8x7
 * ศัตรูอยู่ครึ่งบน (แถว 0-3), ฝั่งเราอยู่ครึ่งล่าง (แถว 4-7)
 */
export function toBoard(side: Side, local: Cell): Cell {
  return side === 'ally'
    ? { r: SIDE_ROWS + local.r, c: local.c }
    : { r: SIDE_ROWS - 1 - local.r, c: local.c };
}

/** เก็บว่าช่องไหนมียูนิตยืนอยู่ */
export class Grid {
  private readonly occ = new Map<number, number>();

  static key(c: Cell): number {
    return c.r * BOARD_COLS + c.c;
  }

  static inBounds(c: Cell): boolean {
    return c.r >= 0 && c.r < BOARD_ROWS && c.c >= 0 && c.c < BOARD_COLS;
  }

  static neighbors(c: Cell): Cell[] {
    const out: Cell[] = [];
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const n = { r: c.r + dr, c: c.c + dc };
        if (Grid.inBounds(n)) out.push(n);
      }
    }
    return out;
  }

  isFree(c: Cell): boolean {
    return Grid.inBounds(c) && !this.occ.has(Grid.key(c));
  }

  occupant(c: Cell): number | undefined {
    return this.occ.get(Grid.key(c));
  }

  place(id: number, c: Cell): void {
    if (!this.isFree(c)) throw new Error(`Cell ${c.r},${c.c} is occupied`);
    this.occ.set(Grid.key(c), id);
  }

  move(id: number, from: Cell, to: Cell): void {
    this.occ.delete(Grid.key(from));
    this.place(id, to);
  }

  remove(c: Cell): void {
    this.occ.delete(Grid.key(c));
  }
}
