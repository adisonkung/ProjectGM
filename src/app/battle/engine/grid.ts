import { Cell, Side } from '../../core/models/unit';

/**
 * กระดานแนวนอน 7 แถว x 10 คอลัมน์: ฝั่งเราอยู่ซ้าย (คอลัมน์ 0-4) ศัตรูอยู่ขวา (คอลัมน์ 5-9)
 * ตัวละครเป็นภาพด้านข้าง ฝั่งเราหันขวา ศัตรูหันซ้าย
 */
export const BOARD_ROWS = 7;
export const BOARD_COLS = 10;
/** ความลึกของแต่ละฝั่ง (จำนวนคอลัมน์ นับจากเส้นกลาง) */
export const SIDE_DEPTH = 5;
/** จำนวนเลน (แถว) ของแต่ละฝั่ง */
export const LANES = 7;

/** ระยะแบบ 8 ทิศ (แนวทแยงนับเป็น 1 ช่อง) */
export const distance = (a: Cell, b: Cell) => Math.max(Math.abs(a.r - b.r), Math.abs(a.c - b.c));

/**
 * แปลงพิกัดในฝั่งตัวเอง เป็นพิกัดจริงบนกระดาน
 * พิกัดในฝั่ง: r = ความลึก (0 = คอลัมน์หน้าสุด ติดเส้นกลาง, 4 = หลังสุด), c = เลน 0-6 (บนลงล่าง)
 */
export function toBoard(side: Side, local: Cell): Cell {
  return side === 'ally'
    ? { r: local.c, c: SIDE_DEPTH - 1 - local.r }
    : { r: local.c, c: SIDE_DEPTH + local.r };
}

/** ช่องนี้อยู่ฝั่งไหนของกระดาน */
export const sideOf = (cell: Cell): Side => (cell.c < SIDE_DEPTH ? 'ally' : 'enemy');

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
