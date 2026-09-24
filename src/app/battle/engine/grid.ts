import { Cell, Side } from '../../core/models/unit';

/**
 * สนามรบแนวนอน 3 เลน x 12 คอลัมน์: ฝั่งเราอยู่ซ้าย (คอลัมน์ 0-5) ศัตรูอยู่ขวา (คอลัมน์ 6-11)
 * (หน้าจอวาดฉากเพิ่มด้านบนอีก SCENERY_ROWS แถวเพื่อความสูง แต่เอนจินไม่รู้จักแถวเหล่านั้น)
 * ตัวละครเป็นภาพด้านข้าง ฝั่งเราหันขวา ศัตรูหันซ้าย
 */
export const BOARD_ROWS = 3;
export const BOARD_COLS = 12;
/** ความลึกของแต่ละฝั่ง (จำนวนคอลัมน์ นับจากเส้นกลาง) */
export const SIDE_DEPTH = 6;
/** จำนวนเลน (แถว) ที่ยืนได้ */
export const LANES = BOARD_ROWS;
/** แถวฉากด้านบน (แสดงผลอย่างเดียว วางตัวไม่ได้) */
export const SCENERY_ROWS = 2;
/** ระหว่างสู้ ยืนซ้อนกันในช่องเดียวได้กี่ตัว (ตอนเริ่มยังช่องละ 1 ตัว) */
export const STACK_CAP = Infinity;

/**
 * แนวรบ (STEP 8 Formation): ความลึก 0–2 = แถวหน้า (FRONT), 3–5 = แถวหลัง (BACK) ของแต่ละฝั่ง
 * ใช้เลือกเป้า (สายประชิดตีแถวหน้าก่อน, นักฆ่าพุ่งหาแถวหลัง) — ไม่ได้ล็อกสาย วางตัวไหนแถวไหนก็ได้
 */
export const FRONT_DEPTH = 3;
export type Line = 'front' | 'back';
export const lineOf = (depth: number): Line => (depth < FRONT_DEPTH ? 'front' : 'back');

/** ระยะแบบ 8 ทิศ (แนวทแยงนับเป็น 1 ช่อง) */
export const distance = (a: Cell, b: Cell) => Math.max(Math.abs(a.r - b.r), Math.abs(a.c - b.c));

/**
 * แปลงพิกัดในฝั่งตัวเอง เป็นพิกัดจริงบนสนาม
 * พิกัดในฝั่ง: r = ความลึก (0 = คอลัมน์หน้าสุด ติดเส้นกลาง, 5 = หลังสุด), c = เลน 0-2 (บนลงล่าง)
 */
export function toBoard(side: Side, local: Cell): Cell {
  return side === 'ally'
    ? { r: local.c, c: SIDE_DEPTH - 1 - local.r }
    : { r: local.c, c: SIDE_DEPTH + local.r };
}

/** ช่องนี้อยู่ฝั่งไหนของสนาม */
export const sideOf = (cell: Cell): Side => (cell.c < SIDE_DEPTH ? 'ally' : 'enemy');

/** พิกัดในฝั่งอยู่ในขอบเขตไหม */
export const validLocal = (p: Cell) => p.r >= 0 && p.r < SIDE_DEPTH && p.c >= 0 && p.c < LANES;

/** เก็บว่าช่องไหนมียูนิตยืนอยู่ (ยืนซ้อนกันได้ไม่เกิน cap ตัว) */
export class Grid {
  private readonly occ = new Map<number, number[]>();

  /** cap = จำนวนตัวที่เดินเข้าช่องเดียวกันได้ (ค่าเริ่ม 1 = ห้ามซ้อน) */
  constructor(private readonly cap = 1) {}

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

  /** ช่องว่างจริง ๆ (ใช้ตอนวางตัวเริ่มต้น/เกิดใหม่) */
  isFree(c: Cell): boolean {
    return Grid.inBounds(c) && !this.occ.get(Grid.key(c))?.length;
  }

  /** เดินเข้าได้ไหม (ยังไม่เต็มตามจำนวนที่ซ้อนได้) */
  canEnter(c: Cell): boolean {
    return Grid.inBounds(c) && (this.occ.get(Grid.key(c))?.length ?? 0) < this.cap;
  }

  occupant(c: Cell): number | undefined {
    return this.occ.get(Grid.key(c))?.[0];
  }

  occupants(c: Cell): readonly number[] {
    return this.occ.get(Grid.key(c)) ?? [];
  }

  place(id: number, c: Cell): void {
    if (!this.canEnter(c)) throw new Error(`Cell ${c.r},${c.c} is full`);
    const k = Grid.key(c);
    this.occ.set(k, [...(this.occ.get(k) ?? []), id]);
  }

  move(id: number, from: Cell, to: Cell): void {
    this.remove(id, from);
    this.place(id, to);
  }

  remove(id: number, c: Cell): void {
    const k = Grid.key(c);
    const list = (this.occ.get(k) ?? []).filter(x => x !== id);
    if (list.length) this.occ.set(k, list);
    else this.occ.delete(k);
  }
}
