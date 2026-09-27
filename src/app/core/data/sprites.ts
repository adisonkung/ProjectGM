/**
 * ข้อมูลแผ่น sprite และเอฟเฟกต์สกิล
 * ทุกแผ่นใช้ช่องกว้าง 132 px สูง 100 px (หรือ cellH), เท้าอยู่ 14 px เหนือขอบล่างช่อง, ตัวละครอยู่กลาง x=66 และหันขวา
 * เอฟเฟกต์ใช้สเกลพิกเซลเดียวกับตัวละคร (1 px ต้นฉบับ = 1.25% ของความกว้างช่องกระดาน)
 */

import { AnimationConfig } from '../models/monster';
import { MONSTERS, PROJECTILES } from './monsters';

/** `cast` = a monster's cast clip, driven by the cast time (see AnimDef.castStart / activate) */
export type SpriteAnim = 'idle' | 'walk' | 'attack' | 'skill' | 'skill2' | 'ult' | 'hurt' | 'die' | 'cast';
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
  /** ท่าร่าย (castDriven): เฟรม CAST_START / SKILL_ACTIVATE (0-based) — เฟรมระหว่างนั้นยืดให้พอดีเวลาร่าย */
  castStart?: number;
  activate?: number;
}

export interface SheetDef {
  cols: number;
  rows: number;
  anims: Partial<Record<SpriteAnim, AnimDef>>;
  /** เอฟเฟกต์ที่เล่นตอนใช้สกิลแต่ละแบบ (คีย์ของ FX) */
  fx?: Partial<Record<SkillKind, string>>;
  /** เอฟเฟกต์ที่ตัวเพื่อนตอนได้โล่จากตัวนี้ */
  shieldFx?: string;
  /** เอฟเฟกต์ที่ตัวเพื่อนตอนได้รับฮีลจากตัวนี้ */
  healFx?: string;
  /** กระสุน (คีย์ของ FX) ของการยิงแต่ละแบบ */
  projectile?: Partial<Record<'attack' | SkillKind, string>>;
  /** ความสูงช่อง (ค่าเริ่มต้น 100) — แผ่นที่มีท่ายกอาวุธสูงใช้ 120 */
  cellH?: number;
  /** ความกว้างช่อง (ค่าเริ่มต้น 132) — บอสตัวใหญ่ใช้ช่องกว้างกว่า สเกลพิกเซลเท่าเดิม */
  cellW?: number;
  /** ท่าร่ายแยกตาม clip ของสกิล (มอนสเตอร์ที่มีหลายสกิล) — ไม่มี = ใช้ anims.cast */
  casts?: Record<string, AnimDef>;
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
  /** กระสุน: ทิศที่ภาพวาดชี้อยู่ (องศา, 0 = ขวา, 90 = ลง) — เฟรมสุดท้ายคือตอนกระทบ */
  angle0?: number;
  /** กระสุน: เอฟเฟกต์ที่เล่นเพิ่มตรงเป้าเมื่อกระทบ */
  hitFx?: string;
}

/** เวลาต่อเฟรมปกติ และของท่ายืน (ช้ากว่า ไม่เร่งตามความเร็วการต่อสู้) */
export const FRAME_MS = 85;
export const IDLE_FRAME_MS = 150;

/** สเกลแสดงผล: ความกว้าง 1 px ต้นฉบับ เทียบกับความกว้างช่องกระดาน (%) */
export const PX_TO_CELL = 165 / 132;
/** ขยายเอฟเฟกต์สกิลทั้งหมด และกระสุน (ลูกธนู/ลูกแสง) ให้เห็นชัดบนสนาม */
export const FX_SCALE = 1.5;
export const PROJECTILE_SCALE = 1.3;

export const SHEETS: Record<string, SheetDef> = {
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
  'hero-jin.png': {
    cols: 8,
    rows: 8,
    cellH: 120,
    anims: {
      idle: { row: 0, frames: 8, seq: [0, 1, 7, 5, 3, 4] },
      walk: { row: 1, frames: 8 },
      hurt: { row: 2, frames: 8 },
      die: { row: 3, frames: 7 },
      attack: { row: 4, frames: 8, hit: 5 },
      skill: { row: 5, frames: 8, hit: 4 },
      skill2: { row: 6, frames: 8, hit: 4 },
      ult: { row: 7, frames: 8, hit: 6 },
    },
    fx: { skill: 'jin-spin', skill2: 'jin-thrust', ult: 'jin-dragon' },
  },
  'hero-sylvie.png': {
    cols: 8,
    rows: 8,
    cellH: 120,
    anims: {
      idle: { row: 0, frames: 8, seq: [0, 2, 5, 7, 1, 6] },
      walk: { row: 1, frames: 8 },
      hurt: { row: 2, frames: 8 },
      die: { row: 3, frames: 8 },
      attack: { row: 4, frames: 8, hit: 5 },
      skill: { row: 5, frames: 8, hit: 3 },
      skill2: { row: 6, frames: 8, hit: 4 },
      ult: { row: 7, frames: 8, hit: 5 },
    },
    fx: { skill: 'sylvie-rapid', skill2: 'sylvie-volley' },
    // ท่าไม้ตาย: วงเวทสวรรค์ขึ้นที่ศัตรูทุกตัวผ่าน hitFx ของลูกธนูสวรรค์
    projectile: { attack: 'arrow-normal', skill: 'arrow-rapid', skill2: 'arrow-volley', ult: 'arrow-celestial' },
  },
  'hero-lumina.png': {
    cols: 8,
    rows: 7,
    cellH: 120,
    anims: {
      idle: { row: 0, frames: 8, seq: [0, 1, 5, 3, 7, 2, 4, 6] },
      walk: { row: 1, frames: 8 },
      hurt: { row: 2, frames: 8 },
      // ไม่มีแถวท่าตาย: ใช้ท่าโดนตี (หลับตาทรุด) ค้างไว้
      die: { row: 2, frames: 8 },
      attack: { row: 3, frames: 7, hit: 2 },
      skill: { row: 4, frames: 8, hit: 4 },
      skill2: { row: 5, frames: 8, hit: 4 },
      ult: { row: 6, frames: 8, hit: 5 },
    },
    fx: { skill: 'lumina-prayer', skill2: 'lumina-bless', ult: 'lumina-rez' },
    healFx: 'lumina-heal',
    projectile: { attack: 'lumina-orb' },
  },
  'hero-morgan.png': {
    cols: 8,
    rows: 8,
    cellH: 120,
    anims: {
      idle: { row: 0, frames: 8, seq: [0, 3, 5, 2, 1, 6] },
      walk: { row: 1, frames: 8 },
      hurt: { row: 2, frames: 8 },
      die: { row: 3, frames: 8 },
      attack: { row: 4, frames: 8, hit: 4 },
      skill: { row: 5, frames: 8, hit: 3 },
      skill2: { row: 6, frames: 8, hit: 4 },
      ult: { row: 7, frames: 8, hit: 4 },
    },
    fx: { skill: 'morgan-s1', skill2: 'morgan-s2', ult: 'morgan-ult' },
    shieldFx: 'morgan-ward',
  },
  'hero-ragnar.png': {
    cols: 8,
    rows: 8,
    cellH: 120,
    anims: {
      idle: { row: 0, frames: 8, seq: [1, 3, 2, 5, 4, 6] },
      walk: { row: 1, frames: 8 },
      hurt: { row: 2, frames: 8 },
      die: { row: 3, frames: 8 },
      attack: { row: 4, frames: 8, hit: 4 },
      skill: { row: 6, frames: 8, hit: 4 },
      skill2: { row: 5, frames: 8, hit: 3 },
      ult: { row: 7, frames: 8, hit: 5 },
    },
    // แผ่นวาด Skill 1 = คำราม (โทสะเลือด = skill2 ในเกม), Skill 2 = พายุขวาน (= skill ในเกม)
    fx: { skill: 'ragnar-whirl', skill2: 'ragnar-rage', ult: 'ragnar-ult' },
  },
  'hero-corvin.png': {
    cols: 8,
    rows: 8,
    cellH: 120,
    anims: {
      idle: { row: 0, frames: 8, seq: [0, 3, 1, 4, 2, 7] },
      walk: { row: 1, frames: 8 },
      hurt: { row: 2, frames: 8 },
      die: { row: 3, frames: 8 },
      attack: { row: 4, frames: 8, hit: 4 },
      skill: { row: 5, frames: 8, hit: 4 },
      skill2: { row: 6, frames: 8, hit: 4 },
      ult: { row: 7, frames: 8, hit: 5 },
    },
    fx: { skill: 'corvin-s1', skill2: 'corvin-s2', ult: 'corvin-ult' },
    healFx: 'corvin-heal',
  },
  'hero-nox.png': {
    cols: 8,
    rows: 8,
    cellH: 120,
    anims: {
      idle: { row: 0, frames: 8, seq: [1, 3, 2, 4, 5, 6] },
      walk: { row: 1, frames: 8 },
      hurt: { row: 2, frames: 8 },
      die: { row: 3, frames: 8 },
      attack: { row: 4, frames: 8, hit: 3 },
      skill: { row: 5, frames: 8, move: 2, hit: 5 },
      skill2: { row: 6, frames: 8, hit: 4 },
      ult: { row: 7, frames: 8, move: 2, hit: 4 },
    },
    fx: { skill: 'nox-s1', skill2: 'nox-s2', ult: 'nox-ult' },
  },
  'hero-velma.png': {
    cols: 8,
    rows: 8,
    cellH: 120,
    anims: {
      idle: { row: 0, frames: 8, seq: [0, 2, 1, 3, 4, 5] },
      walk: { row: 1, frames: 8 },
      hurt: { row: 2, frames: 8 },
      die: { row: 3, frames: 8 },
      attack: { row: 4, frames: 8, hit: 3 },
      skill: { row: 5, frames: 8, hit: 4 },
      skill2: { row: 6, frames: 8, hit: 3 },
      ult: { row: 7, frames: 8, hit: 3 },
    },
    fx: { skill: 'velma-s1', skill2: 'velma-s2', ult: 'velma-ult' },
    projectile: { ult: 'velma-beam' },
  },
  // ศัตรู: แผ่นของมอนสเตอร์สร้างจาก MONSTERS[*].animation ด้านล่าง (monsterSheet) ไม่ต้องเขียนซ้ำที่นี่
};

/** ชื่อ clip ในข้อมูลมอนสเตอร์ → ท่าของ unit-sprite */
const CLIP_ANIM: Record<string, SpriteAnim> = { idle: 'idle', move: 'walk', hurt: 'hurt', death: 'die', attack: 'attack' };

/**
 * แผ่น sprite ของมอนสเตอร์จาก AnimationConfig (แถว/เฟรมเลขบนแผ่นอาร์ต เริ่ม 1 → 0-based)
 * attack.hit = เฟรมของ event ที่ตัดสินการโจมตี · clip ร่าย (castDriven) → ท่า `cast` พร้อม castStart/activate
 */
export function monsterSheet(anim: AnimationConfig, attackEvent?: string, projectile?: string): SheetDef {
  const anims: SheetDef['anims'] = {};
  const casts: Record<string, AnimDef> = {};
  let cols = 0, rows = 0;
  for (const [name, c] of Object.entries(anim.clips)) {
    cols = Math.max(cols, c.frames);
    rows = Math.max(rows, c.row);
    const ev = (e: string) => c.events?.find(m => m.event === e)?.frame;
    if (c.castDriven) {
      const a: AnimDef = { row: c.row - 1, frames: c.frames, ms: c.frameMs, castStart: (ev('CAST_START') ?? 1) - 1, activate: (ev('SKILL_ACTIVATE') ?? c.frames) - 1 };
      anims.cast ??= a;
      (casts[name] = a);
      continue;
    }
    const key = CLIP_ANIM[name];
    if (!key) continue;
    const hitFrame = name === 'attack' && attackEvent ? ev(attackEvent) : undefined;
    anims[key] = {
      row: c.row - 1,
      frames: c.frames,
      ...(c.frameMs !== FRAME_MS && key !== 'idle' ? { ms: c.frameMs } : {}),
      ...(hitFrame ? { hit: hitFrame - 1 } : {}),
    };
  }
  return {
    cols, rows, anims, ...(anim.cellH ? { cellH: anim.cellH } : {}), ...(anim.cellW ? { cellW: anim.cellW } : {}),
    ...(Object.keys(casts).length > 1 ? { casts } : {}), ...(projectile ? { projectile: { attack: projectile } } : {}),
  };
}

for (const m of Object.values(MONSTERS)) {
  const sheet = m.animation.sheet;
  if (!sheet || SHEETS[sheet]) continue;
  const proj = m.attack.projectileId ? PROJECTILES[m.attack.projectileId]?.fx : undefined;
  SHEETS[sheet] = monsterSheet(m.animation, m.attack.event, proj);
}

export const FX: Record<string, FxDef> = {
  // ---- special-dungeon monsters (tools/sprites/dungeon/fx.py: 6 frames × 64 px, directional ones point right)
  'triple-volley': { file: 'fx-triple-volley.png', frames: 6, w: 64, h: 64, frameMs: 60, at: 'target', orient: 'flip', dy: -10, scale: 0.9 },
  'rally-whistle': { file: 'fx-rally-whistle.png', frames: 6, w: 64, h: 64, frameMs: 90, at: 'self', dx: 22, dy: -30, scale: 1.2 },
  'lions-roar': { file: 'fx-lions-roar.png', frames: 6, w: 160, h: 96, frameMs: 90, at: 'self', dx: 128, dy: -34, scale: 0.94 },
  'crescent-iaido': { file: 'fx-crescent-iaido.png', frames: 6, w: 223, h: 72, frameMs: 70, at: 'target', orient: 'flip', dy: -20, scale: 0.75 },
  'mirror-stance': { file: 'fx-mirror-stance.png', frames: 6, w: 152, h: 96, frameMs: 110, at: 'self', dy: -47, scale: 1.02 },
  starfall: { file: 'fx-starfall.png', frames: 6, w: 121, h: 192, frameMs: 80, at: 'target', dy: -65, scale: 0.9 },
  'judgement-beam': { file: 'fx-judgement-beam.png', frames: 6, w: 140, h: 192, frameMs: 90, at: 'target', dy: -63, scale: 0.6 },
  'crystal-shell': { file: 'fx-crystal-shell.png', frames: 6, w: 64, h: 64, frameMs: 90, at: 'self', dy: -14, scale: 1 },
  devour: { file: 'fx-devour.png', frames: 6, w: 64, h: 64, frameMs: 70, at: 'target', dy: -18, scale: 1 },
  'smoke-pouch': { file: 'fx-smoke-pouch.png', frames: 6, w: 64, h: 64, frameMs: 80, at: 'self', dy: -14, scale: 1.1 },
  'rune-bolt': { file: 'fx-rune-bolt.png', frames: 6, w: 64, h: 64, frameMs: 60, at: 'target', orient: 'flip', dy: -18, scale: 0.9 },
  'page-barrier': { file: 'fx-page-barrier.png', frames: 6, w: 64, h: 64, frameMs: 100, at: 'self', dy: -22, scale: 1.2 },
  'arcane-seal': { file: 'fx-arcane-seal.png', frames: 6, w: 64, h: 64, frameMs: 90, at: 'target', dy: -28, scale: 1 },
  'dummy-bolt': { file: 'fx-dummy-bolt.png', frames: 1, w: 22, h: 7, frameMs: 60, at: 'target', angle0: 0, scale: 1 },
  'star-bolt': { file: 'fx-star-bolt.png', frames: 1, w: 18, h: 14, frameMs: 60, at: 'target', angle0: 0, scale: 1.2 },
  'rune-orb': { file: 'fx-rune-orb.png', frames: 1, w: 14, h: 14, frameMs: 60, at: 'target', angle0: 0, scale: 1.1 },
  'chalk-bolt': { file: 'fx-chalk-bolt.png', frames: 1, w: 14, h: 8, frameMs: 60, at: 'target', angle0: 0, scale: 1.1 },
  // ---- โมร์แกน / แร็กนาร์ / คอร์วิน / น็อกซ์ / เวลมา (tools/sprites/h5/fx.py)
  'morgan-s1': { file: 'fx-morgan-s1.png', frames: 8, w: 107, h: 76, frameMs: 70, at: 'self', dy: -8, scale: 1.3 },
  'morgan-s2': { file: 'fx-morgan-s2.png', frames: 8, w: 116, h: 67, frameMs: 60, at: 'target', orient: 'flip', dx: -25, dy: -10, scale: 1.2 },
  'morgan-ult': { file: 'fx-morgan-ult.png', frames: 8, w: 114, h: 74, frameMs: 85, at: 'self', dy: -6, scale: 1.5 },
  'morgan-ward': { file: 'fx-morgan-ult.png', frames: 8, w: 114, h: 74, frameMs: 70, at: 'self', dy: -4, scale: 0.75 },
  'ragnar-whirl': { file: 'fx-ragnar-s2.png', frames: 8, w: 134, h: 104, frameMs: 60, at: 'self', dy: -4, scale: 1.1 },
  'ragnar-rage': { file: 'fx-ragnar-s1.png', frames: 8, w: 113, h: 105, frameMs: 75, at: 'self', dy: -14, scale: 1.05, on: 'cast' },
  'ragnar-ult': { file: 'fx-ragnar-ult.png', frames: 8, w: 156, h: 127, frameMs: 75, at: 'target', dy: -18, scale: 1.1 },
  'corvin-s1': { file: 'fx-corvin-s1.png', frames: 8, w: 102, h: 92, frameMs: 75, at: 'self', dy: -12, scale: 1.15, on: 'cast' },
  'corvin-heal': { file: 'fx-corvin-s1.png', frames: 8, w: 102, h: 92, frameMs: 60, at: 'self', dy: -12, scale: 0.6 },
  'corvin-s2': { file: 'fx-corvin-s2.png', frames: 8, w: 155, h: 84, frameMs: 80, at: 'target', dy: -10, scale: 1.15 },
  'corvin-ult': { file: 'fx-corvin-ult.png', frames: 8, w: 118, h: 105, frameMs: 90, at: 'target', dy: -16, scale: 1.3 },
  'nox-s1': { file: 'fx-nox-s1.png', frames: 8, w: 115, h: 74, frameMs: 70, at: 'target', orient: 'flip', dy: -10, scale: 1.15, on: 'cast' },
  'nox-s2': { file: 'fx-nox-s2.png', frames: 8, w: 176, h: 71, frameMs: 60, at: 'target', orient: 'flip', dx: -35, dy: -10, scale: 1.05 },
  'nox-ult': { file: 'fx-nox-ult.png', frames: 8, w: 182, h: 81, frameMs: 80, at: 'target', orient: 'flip', dy: -14, scale: 1.15 },
  'velma-s1': { file: 'fx-velma-s1.png', frames: 8, w: 137, h: 89, frameMs: 75, at: 'target', dy: -12, scale: 1.05 },
  'velma-s2': { file: 'fx-velma-s2.png', frames: 8, w: 130, h: 94, frameMs: 75, at: 'target', dy: -16, scale: 1.05 },
  'velma-ult': { file: 'fx-velma-ult.png', frames: 4, w: 204, h: 125, frameMs: 90, at: 'self', dx: 20, dy: -20, scale: 0.65, on: 'cast' },
  'velma-beam': { file: 'fx-velma-beam.png', frames: 2, w: 409, h: 93, frameMs: 80, at: 'target', angle0: 0, scale: 0.6 },
  'jin-spin': { file: 'fx-jin-spin.png', frames: 8, w: 113, h: 92, frameMs: 60, at: 'self', dy: -14, scale: 1.55 },
  'jin-thrust': { file: 'fx-jin-thrust.png', frames: 8, w: 137, h: 66, frameMs: 55, at: 'target', orient: 'flip', dx: -40, dy: -12, scale: 1.35 },
  'jin-dragon': { file: 'fx-jin-dragon.png', frames: 8, w: 278, h: 88, frameMs: 75, at: 'target', orient: 'flip', dx: -35, dy: -16, scale: 1.05 },
  'sylvie-rapid': { file: 'fx-sylvie-rapid.png', frames: 8, w: 132, h: 84, frameMs: 55, at: 'self', dx: 45, dy: -16, scale: 1.1, on: 'cast' },
  'sylvie-volley': { file: 'fx-sylvie-volley.png', frames: 8, w: 124, h: 86, frameMs: 70, at: 'target', dy: -14, scale: 1.3, on: 'cast' },
  'sylvie-celestial': { file: 'fx-sylvie-celestial.png', frames: 8, w: 125, h: 88, frameMs: 65, at: 'target', dy: -14, scale: 1.2 },
  'arrow-normal': { file: 'fx-arrow-normal.png', frames: 6, w: 92, h: 52, frameMs: 60, at: 'target', angle0: 0, scale: 0.7 },
  'arrow-rapid': { file: 'fx-arrow-rapid.png', frames: 6, w: 84, h: 45, frameMs: 50, at: 'target', angle0: 0, scale: 0.65 },
  'arrow-volley': { file: 'fx-arrow-volley.png', frames: 6, w: 86, h: 73, frameMs: 60, at: 'target', angle0: 40, scale: 0.75 },
  'arrow-celestial': { file: 'fx-arrow-celestial.png', frames: 6, w: 83, h: 102, frameMs: 60, at: 'target', angle0: 90, hitFx: 'sylvie-celestial', scale: 0.8 },
  'lumina-prayer': { file: 'fx-lumina-prayer.png', frames: 8, w: 87, h: 98, frameMs: 80, at: 'self', dy: -12, scale: 1.1, on: 'cast' },
  'lumina-bless': { file: 'fx-lumina-bless.png', frames: 8, w: 91, h: 86, frameMs: 80, at: 'target', dy: -10 },
  'lumina-rez': { file: 'fx-lumina-rez.png', frames: 8, w: 84, h: 98, frameMs: 100, at: 'target', dy: -14, scale: 1.3 },
  // ฮีลที่เพื่อนได้รับจากลูมิน่า: แผ่นบทสวด ย่อลง
  'lumina-heal': { file: 'fx-lumina-prayer.png', frames: 8, w: 87, h: 98, frameMs: 60, at: 'self', dy: -12, scale: 0.6 },
  'lumina-orb': { file: 'fx-lumina-orb.png', frames: 5, w: 57, h: 63, frameMs: 60, at: 'target', angle0: 0, scale: 0.8 },
  'aurel-defense': { file: 'fx-aurel-defense.png', frames: 8, w: 112, h: 90, frameMs: 70, at: 'self', dx: 18, dy: -14, scale: 1.25 },
  'aurel-charge': { file: 'fx-aurel-charge.png', frames: 8, w: 131, h: 78, frameMs: 60, at: 'target', orient: 'flip', dx: -20, dy: -8, scale: 1.2 },
  'shade-teleport': { file: 'fx-shade-teleport.png', frames: 8, w: 140, h: 131, frameMs: 80, at: 'target', orient: 'flip', dy: -14, on: 'cast' },
  'shade-smoke': { file: 'fx-shade-smoke.png', frames: 8, w: 131, h: 84, frameMs: 90, at: 'target', orient: 'flip', dy: -8 },
  'shade-phantom': { file: 'fx-shade-phantom.png', frames: 8, w: 134, h: 132, frameMs: 95, at: 'target', orient: 'flip', dy: -16, scale: 1.15 },
  // โล่ที่เพื่อนได้จากท่าไม้ตายออเรล: ใช้แผ่นเดียวกัน ย่อลง
  'aurel-ward': { file: 'fx-aurel-ult.png', frames: 8, w: 123, h: 90, frameMs: 80, at: 'self', dy: -16, scale: 0.85 },
  // Alpha Howl (tools/sprites/fx_alpha_howl.py จากแผ่น 8 เฟรมของผู้ใช้): frame 5 = FX PEAK = SKILL_ACTIVATE,
  // started early by the engine's 'fx' event · wave origin sits at the wolf's raised mouth and travels forward
  'alpha-howl': { file: 'fx-alpha-howl.png', frames: 8, w: 141, h: 158, frameMs: 90, at: 'self', dx: 109, dy: -52, scale: 0.65 },
  // ลูกธนูก็อบลิน (ตัดจากเฟรมปล่อยสายในแผ่นก็อบลินพลธนู, tools/sprites/monster_sheet.py) · 1 เฟรม หัวชี้ขวา
  'goblin-arrow': { file: 'fx-goblin-arrow.png', frames: 1, w: 39, h: 12, frameMs: 60, at: 'target', angle0: 0, scale: 1.1 },
  'aurel-ult': { file: 'fx-aurel-ult.png', frames: 8, w: 123, h: 90, frameMs: 95, at: 'self', dy: -18, scale: 1.55 },
};

/** กระสุนของสายระยะไกลที่ไม่มีแผ่น sprite (ศัตรู/ฮีโร่โทเคน) */
export const CLASS_PROJECTILE: Partial<Record<string, string>> = {
  archer: 'arrow-normal',
  mage: 'lumina-orb',
  healer: 'lumina-orb',
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
  cast: 'skill',
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
