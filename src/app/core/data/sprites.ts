/**
 * ข้อมูลแผ่น sprite และเอฟเฟกต์สกิล
 * ทุกแผ่นใช้ช่องขนาด 132x100 px, เท้าอยู่ที่ y=86, ตัวละครอยู่กลาง x=66 และหันขวา
 * เอฟเฟกต์ใช้สเกลพิกเซลเดียวกับตัวละคร (1 px ต้นฉบับ = 1.25% ของความกว้างช่องกระดาน)
 */

export type SpriteAnim = 'idle' | 'walk' | 'attack' | 'skill' | 'skill2' | 'ult' | 'hurt' | 'die';
export type SkillKind = 'skill' | 'skill2' | 'ult';

/** หนึ่งท่าในแผ่น */
export interface AnimDef {
  row: number;
  frames: number;
  /** เวลาต่อเฟรม (ms) ค่าเริ่มต้น FRAME_MS (ท่ายืน IDLE_FRAME_MS) */
  ms?: number;
  /** เฟรมที่ดาเมจเข้า (ตัวเลขดาเมจ/เอฟเฟกต์ที่เป้าขึ้นตรงนี้) */
  hit?: number;
  /** เฟรมที่ตัวละครย้ายตำแหน่ง (วาร์ป) */
  move?: number;
  /** ลำดับเฟรมที่เล่นจริง (ใช้กับท่ายืน: ตัดเฟรมที่กระตุกออกและเรียงให้ต่อเนื่อง) */
  seq?: number[];
}

export interface SheetDef {
  cols: number;
  rows: number;
  anims: Partial<Record<SpriteAnim, AnimDef>>;
  /** เอฟเฟกต์ที่เล่นตอนใช้สกิลแต่ละแบบ (คีย์ของ FX) */
  fx?: Partial<Record<SkillKind, string>>;
  /** เอฟเฟกต์ที่ตัวเพื่อนตอนได้โล่จากตัวนี้ */
  shieldFx?: string;
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
  /** เริ่มเล่นตอนเริ่มท่า (cast) หรือตอนดาเมจเข้า (impact, ค่าเริ่มต้น) */
  on?: 'cast' | 'impact';
}

/** เวลาต่อเฟรมปกติ และของท่ายืน (ช้ากว่า ไม่เร่งตามความเร็วการต่อสู้) */
export const FRAME_MS = 85;
export const IDLE_FRAME_MS = 150;

/** สเกลแสดงผล: ความกว้าง 1 px ต้นฉบับ เทียบกับความกว้างช่องกระดาน (%) */
export const PX_TO_CELL = 165 / 132;

export const SHEETS: Record<string, SheetDef> = {
  'hero-draken.png': {
    // v2: แถว 2-4 (run, jump, fall) ยังไม่ได้ใช้
    cols: 11,
    rows: 11,
    anims: {
      idle: { row: 0, frames: 8, seq: [0, 4, 3, 5, 6, 7] },
      walk: { row: 1, frames: 9 },
      hurt: { row: 5, frames: 7 },
      die: { row: 6, frames: 9 },
      attack: { row: 7, frames: 9, hit: 1 },
      skill: { row: 8, frames: 7, hit: 1 },
      skill2: { row: 9, frames: 6, hit: 2 },
      ult: { row: 10, frames: 11, hit: 8 },
    },
    fx: { skill: 'draken-slash', skill2: 'draken-dash', ult: 'draken-ult' },
  },
  'hero-aurel.png': {
    cols: 8,
    rows: 8,
    anims: {
      idle: { row: 0, frames: 8, seq: [1, 2, 5, 6, 7, 4] },
      walk: { row: 1, frames: 8 },
      hurt: { row: 2, frames: 8 },
      attack: { row: 3, frames: 8, hit: 4 },
      skill: { row: 4, frames: 8, hit: 3 },
      skill2: { row: 5, frames: 8, hit: 3 },
      ult: { row: 6, frames: 8, hit: 4 },
      die: { row: 7, frames: 8 },
    },
    fx: { skill: 'aurel-defense', skill2: 'aurel-charge', ult: 'aurel-ult' },
    shieldFx: 'aurel-ward',
  },
  'hero-shade.png': {
    cols: 9,
    rows: 8,
    anims: {
      idle: { row: 0, frames: 9, seq: [0, 2, 6, 4, 5, 7] },
      walk: { row: 1, frames: 9 },
      hurt: { row: 2, frames: 9 },
      die: { row: 3, frames: 8 },
      attack: { row: 4, frames: 9, hit: 4 },
      skill: { row: 5, frames: 9, move: 2, hit: 4 },
      skill2: { row: 6, frames: 9, hit: 4 },
      ult: { row: 7, frames: 9, move: 2, hit: 5 },
    },
    fx: { skill: 'shade-teleport', skill2: 'shade-smoke', ult: 'shade-phantom' },
  },
};

export const FX: Record<string, FxDef> = {
  'aurel-defense': { file: 'fx-aurel-defense.png', frames: 7, w: 57, h: 85, frameMs: 75, at: 'self', dx: 22, dy: -12 },
  'aurel-charge': { file: 'fx-aurel-charge.png', frames: 5, w: 84, h: 76, frameMs: 80, at: 'target' },
  'draken-slash': { file: 'fx-draken-slash.png', frames: 4, w: 178, h: 96, frameMs: 80, at: 'target', orient: 'flip', dy: -10, scale: 0.9 },
  'draken-dash': { file: 'fx-draken-dash.png', frames: 4, w: 178, h: 96, frameMs: 80, at: 'target', orient: 'flip', dy: -8, scale: 0.9 },
  'draken-ult': { file: 'fx-draken-ult.png', frames: 4, w: 200, h: 96, frameMs: 120, at: 'target', orient: 'flip', dy: -20 },
  'shade-teleport': { file: 'fx-shade-teleport.png', frames: 8, w: 140, h: 131, frameMs: 80, at: 'target', orient: 'flip', dy: -14, on: 'cast' },
  'shade-smoke': { file: 'fx-shade-smoke.png', frames: 8, w: 131, h: 84, frameMs: 90, at: 'target', orient: 'flip', dy: -8 },
  'shade-phantom': { file: 'fx-shade-phantom.png', frames: 8, w: 134, h: 132, frameMs: 95, at: 'target', orient: 'flip', dy: -16, scale: 1.15 },
  // โล่ที่เพื่อนได้จากท่าไม้ตายออเรล: ใช้แผ่นเดียวกัน ย่อลง
  'aurel-ward': { file: 'fx-aurel-ult.png', frames: 5, w: 94, h: 92, frameMs: 120, at: 'self', dy: -14, scale: 0.85 },
  'aurel-ult': { file: 'fx-aurel-ult.png', frames: 5, w: 94, h: 92, frameMs: 140, at: 'self', dy: -14, scale: 1.4 },
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

/** ท่าที่ไม่มีแผ่น sprite (โทเคน): ความยาวท่า และจุดที่ดาเมจเข้า (วินาที) */
const TOKEN_TIMING: Record<'attack' | SkillKind, { total: number; hit: number }> = {
  attack: { total: 0.3, hit: 0.15 },
  skill: { total: 0.45, hit: 0.2 },
  skill2: { total: 0.45, hit: 0.2 },
  ult: { total: 0.6, hit: 0.3 },
};

/**
 * จังหวะของท่า (วินาที ที่ความเร็ว x1) ให้เอนจินรอดาเมจเข้าตรงเฟรม hit และล็อกตัวจนท่าจบ
 * total = ความยาวท่า, hit = เวลาที่ดาเมจเข้า, move = เวลาที่ย้ายตำแหน่ง (วาร์ป)
 */
export function animTiming(sprite: string | undefined, anim: 'attack' | SkillKind): { total: number; hit: number; move: number } {
  const sheet = sprite ? SHEETS[sprite] : undefined;
  let name: SpriteAnim | null = anim;
  while (sheet && name && !sheet.anims[name]) name = ANIM_FALLBACK[name];
  const a = name ? sheet?.anims[name] : undefined;
  if (!a) {
    const t = TOKEN_TIMING[anim];
    return { ...t, move: t.hit / 2 };
  }
  const ms = (a.ms ?? FRAME_MS) / 1000;
  const hit = (a.hit ?? Math.floor(a.frames / 2)) * ms;
  return { total: a.frames * ms, hit, move: (a.move ?? 0) * ms };
}
