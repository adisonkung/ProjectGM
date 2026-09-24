/**
 * ข้อมูลแผ่น sprite และเอฟเฟกต์สกิล
 * ทุกแผ่นใช้ช่องขนาด 132x100 px, เท้าอยู่ที่ y=86, ตัวละครอยู่กลาง x=66 และหันขวา
 * เอฟเฟกต์ใช้สเกลพิกเซลเดียวกับตัวละคร (1 px ต้นฉบับ = 1.25% ของความกว้างช่องกระดาน)
 */

export type SpriteAnim = 'idle' | 'walk' | 'attack' | 'skill' | 'skill2' | 'ult' | 'hurt' | 'die';
export type SkillKind = 'skill' | 'skill2' | 'ult';

export interface SheetDef {
  cols: number;
  rows: number;
  anims: Partial<Record<SpriteAnim, { row: number; frames: number }>>;
  /** เอฟเฟกต์ที่เล่นตอนใช้สกิลแต่ละแบบ (คีย์ของ FX) */
  fx?: Partial<Record<SkillKind, string>>;
}

export interface FxDef {
  file: string;
  frames: number;
  /** ขนาดช่องของเอฟเฟกต์ในแผ่น (px ต้นฉบับ) */
  w: number;
  h: number;
  frameMs: number;
  /** เล่นที่ตัวผู้ใช้ หรือที่เป้าหมาย (หมุนตามทิศที่พุ่งไป) */
  at: 'self' | 'target';
  /** เลื่อนจากกลางช่อง เป็น % ของช่อง (+x ขวา, +y ลง) */
  dx?: number;
  dy?: number;
  /** ขยายเพิ่มจากสเกลปกติ */
  scale?: number;
  /** เอฟเฟกต์ที่เป้าหมาย: หมุนตามทิศ (ค่าเริ่มต้น) หรือแค่กลับซ้าย/ขวาตามทิศผู้ใช้ */
  orient?: 'rotate' | 'flip';
}

/** สเกลแสดงผล: ความกว้าง 1 px ต้นฉบับ เทียบกับความกว้างช่องกระดาน (%) */
export const PX_TO_CELL = 165 / 132;

export const SHEETS: Record<string, SheetDef> = {
  'hero-draken.png': {
    cols: 10,
    rows: 6,
    anims: {
      idle: { row: 0, frames: 10 },
      hurt: { row: 1, frames: 6 },
      die: { row: 2, frames: 6 },
      attack: { row: 3, frames: 7 },
      skill: { row: 4, frames: 7 },
      skill2: { row: 5, frames: 5 },
    },
  },
  'hero-aurel.png': {
    cols: 8,
    rows: 8,
    anims: {
      idle: { row: 0, frames: 8 },
      walk: { row: 1, frames: 8 },
      hurt: { row: 2, frames: 8 },
      attack: { row: 3, frames: 8 },
      skill: { row: 4, frames: 8 },
      skill2: { row: 5, frames: 8 },
      ult: { row: 6, frames: 8 },
      die: { row: 7, frames: 8 },
    },
    fx: { skill: 'aurel-defense', skill2: 'aurel-charge', ult: 'aurel-ult' },
  },
  'hero-shade.png': {
    cols: 9,
    rows: 8,
    anims: {
      idle: { row: 0, frames: 9 },
      walk: { row: 1, frames: 9 },
      hurt: { row: 2, frames: 9 },
      die: { row: 3, frames: 9 },
      attack: { row: 4, frames: 9 },
      skill: { row: 5, frames: 9 },
      skill2: { row: 6, frames: 9 },
      ult: { row: 7, frames: 9 },
    },
    fx: { skill: 'shade-teleport', skill2: 'shade-smoke', ult: 'shade-phantom' },
  },
};

export const FX: Record<string, FxDef> = {
  'aurel-defense': { file: 'fx-aurel-defense.png', frames: 7, w: 48, h: 76, frameMs: 75, at: 'self', dx: 22, dy: -12 },
  'aurel-charge': { file: 'fx-aurel-charge.png', frames: 5, w: 74, h: 68, frameMs: 80, at: 'target' },
  'shade-teleport': { file: 'fx-shade-teleport.png', frames: 8, w: 150, h: 121, frameMs: 80, at: 'target', orient: 'flip', dy: -14 },
  'shade-smoke': { file: 'fx-shade-smoke.png', frames: 8, w: 150, h: 74, frameMs: 90, at: 'target', orient: 'flip', dy: -8 },
  'shade-phantom': { file: 'fx-shade-phantom.png', frames: 8, w: 150, h: 122, frameMs: 95, at: 'target', orient: 'flip', dy: -16, scale: 1.15 },
  'aurel-ult': { file: 'fx-aurel-ult.png', frames: 5, w: 85, h: 76, frameMs: 140, at: 'self', dy: -14, scale: 1.4 },
};

/** ท่าที่แผ่นไม่มี ให้ใช้ท่าไหนแทน (null = ข้ามไปเลย) */
export const ANIM_FALLBACK: Record<SpriteAnim, SpriteAnim | null> = {
  idle: null,
  walk: null,
  attack: 'idle',
  skill: 'attack',
  skill2: 'skill',
  ult: 'skill',
  hurt: null,
  die: 'idle',
};
