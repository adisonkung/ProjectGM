/**
 * ข้อมูลแผ่น sprite และเอฟเฟกต์สกิล
 * ทุกแผ่นใช้ช่องกว้าง 132 px สูง 100 px (หรือ cellH), เท้าอยู่ 14 px เหนือขอบล่างช่อง, ตัวละครอยู่กลาง x=66 และหันขวา
 * เอฟเฟกต์ใช้สเกลพิกเซลเดียวกับตัวละคร (1 px ต้นฉบับ = 1.25% ของความกว้างช่องกระดาน)
 */

import { AnimationConfig, SemanticEvent } from '../models/monster';
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
  /**
   * choreography of an action clip: ms per `seq` step (hold key poses, drop odd art frames). With it, `events`
   * and `hit` count `seq` steps, not sheet frames, and the clip lasts the sum of `steps`.
   */
  steps?: number[];
  /** ท่าร่าย (castDriven): เฟรม CAST_START / SKILL_ACTIVATE (0-based) — เฟรมระหว่างนั้นยืดให้พอดีเวลาร่าย */
  castStart?: number;
  activate?: number;
  /**
   * Semantic events of a hero clip, as 0-based frames of THIS row (data only — gameplay listens to the events,
   * never to frame numbers): CAST_START, SKILL_ACTIVATE, VFX_SPAWN, PROJECTILE_SPAWN, DAMAGE (= `hit`), IMPACT,
   * RECOVERY_START, ANIMATION_END (default = the clip length). The engine turns them into seconds with `animEvents()`.
   */
  /** one frame (or step; fractions = inside a held step) per event, or a list for repeated events (multi-hit) */
  events?: Partial<Record<SemanticEvent, number | number[]>>;
  /** contact feel when this clip's skill lands (battle page + sprite lab): hit-stop + screen shake — a list = per hit */
  impact?: ImpactFeel | ImpactFeel[];
}

/** hit-stop (the whole board freezes for `hitStopMs` real ms) + a small screen shake */
export interface ImpactFeel {
  hitStopMs?: number;
  shakePx?: number;
  shakeMs?: number;
  /** brief white flash over the board (ms) */
  flashMs?: number;
}

export interface SheetDef {
  cols: number;
  rows: number;
  anims: Partial<Record<SpriteAnim, AnimDef>>;
  /** เอฟเฟกต์ที่เล่นตอนใช้สกิลแต่ละแบบ (คีย์ของ FX) — หลายชั้นได้ (ชาร์จ / VFX หลัก / กระทบ) แต่ละอันบอกเองว่าเกิดตอนไหน */
  fx?: Partial<Record<SkillKind, string | string[]>>;
  /**
   * named anchors on the hero, [dx, dy] in % of a board cell from the cell centre (same units as FX dx/dy; dx is
   * mirrored with the facing) — e.g. bodyCenter, weaponTip, skillOrigin. FX pick one with `FxDef.anchor`.
   */
  anchors?: Record<string, [number, number]>;
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
  /** nearest-neighbour rendering (pixel-art sheets) */
  pixelated?: boolean;
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
  /** เริ่มเล่นตอนเริ่มท่า (cast), ตอนดาเมจเข้า (impact, ค่าเริ่มต้น) หรือตอน event VFX_SPAWN ของท่า (vfx) */
  on?: 'cast' | 'impact' | 'vfx';
  /**
   * จุดหมุน/จุดยึดของภาพ เป็นสัดส่วนของเฟรม [x, y] (ค่าเริ่มต้น [0.5, 0.5] = กลาง) — จุดนี้วางตรง anchor (dx/dy)
   * และการกลับซ้าย-ขวา/หมุนทำรอบจุดนี้ (เช่น ลำมังกรของไป๋หลง = หางซ้ายกลาง [0.06, 0.5] เกาะปลายทวน)
   */
  pivot?: [number, number];
  /** nearest-neighbour rendering (pixel-art FX) */
  pixelated?: boolean;
  /** spawn on a semantic clip event instead (e.g. CHARGE_START, STRIKE_START) — `eventIndex` for repeated events */
  event?: SemanticEvent;
  eventIndex?: number;
  /** on 'impact': only the n-th hit of a multi-hit skill (0-based) */
  hitIndex?: number;
  /** on 'impact' at 'target': one copy on each unit the hit damaged, at most this many (primary first) */
  perHit?: number;
  /** placed on the owner's named anchor (SheetDef.anchors) + dx/dy */
  anchor?: string;
  /** a segment of a longer strip: first frame + total frames in the file (`frames` = this segment's length) */
  from?: number;
  stripFrames?: number;
  /** release-and-vanish: after the last frame, hold it and fade out over this many ms (no collapse frames) */
  fadeOutMs?: number;
  /** start this many ms after its trigger (hidden until then) — e.g. a contact burst that follows the bash pose */
  delayMs?: number;
  /** play the strip this many times back to back (a looping field, e.g. a bastion that lasts as long as its taunt) */
  repeat?: number;
  /** size the frame to this many board cells wide (e.g. an area burst matching the skill's hit area), instead of w × scale */
  fitCells?: number;
  /** 'under' = drawn below the units (ground aura), default above them */
  layer?: 'under' | 'over';
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
  // ศัตรู: แผ่นของมอนสเตอร์สร้างจาก MONSTERS[*].animation ด้านล่าง (monsterSheet) ไม่ต้องเขียนซ้ำที่นี่
  // ไป๋หลง (ทวนมังกรขาว) — tools/sprites/bailong.py จากภาพของผู้ใช้ (แผ่นตัวละคร ≠ แผ่น VFX)
  // ช่อง 220 × 132 (ทวนยื่นเกินตัวได้, สเกลพิกเซลเท่าเดิม) · root = เท้ากลางล่าง (110, 117) · หันขวา · ตัวใหญ่ขึ้น 10 % จากรอบแรก
  // แถว: 0 idle 6 · 1 walk 8 · 2 hurt 4 · 3 attack 6 (แทงทวน) · 4 die 7 · 5 Dragon Thrust 10
  //      6 Sweeping Moon 12 · 7 Nine Dragon Sequence 20 (ไอปราณรอบทวนวาดติดมากับตัว — เก็บแบบโปร่งแสง)
  // Yue Zheng — Iron Mountain Bastion (remodel #2, tools/sprites/yuezheng.py): base sheet + S1 (row 5) + S2 (row 6)
  // + ult (row 7). Cell 260 × 170 like Aurel v2
  // (the tower shield needs the width), feet 15 px above the cell bottom, idle body 78 px.
  'hero-yuezheng.png': {
    cols: 16, rows: 8, cellW: 260, cellH: 170, pixelated: true,
    anchors: { feet: [0, 27.25], bodyCenter: [0, -20] },
    anims: {
      idle: { row: 0, frames: 6 },
      walk: { row: 1, frames: 8, ms: 80 },
      hurt: { row: 2, frames: 4 },
      // ready → raise the dao (F2–F3) → slash extended F4 = damage → recover to the shield stance
      attack: { row: 3, frames: 7, ms: 95, events: { DAMAGE: 3, RECOVERY_START: 5 } },
      die: { row: 4, frames: 6, ms: 120 },
      // S1 Iron Wall Taunt — Timeline Sync Sheet (tools/sprites/yuezheng_s1.py, 60 FPS T000–T059 = 1.00 s):
      // A ready / brace C01–C02 · B anticipation C03–C05 (C05 held T020–T025) · C activation C06 held T026–T035 —
      // main VFX spawns T026, taunt + damage reduction T030 (DAMAGE at step 5.4) · D hold C07 T036–T047 · E recovery
      // C08–C10 from T048 · feet planted, no travel · shake 2 px, no hit-stop
      skill: {
        row: 5, frames: 10, ms: 100,
        seq: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
        steps: [100, 100, 83, 50, 100, 167, 200, 67, 67, 66],
        events: {
          CAST_START: 0, ANTICIPATION_PEAK: 4, SKILL_ACTIVATE: 5, VFX_SPAWN: 5, DAMAGE: 5.4, IMPACT: 5.4, RECOVERY_START: 7,
        },
        impact: { hitStopMs: 0, shakePx: 2, shakeMs: 50 },
      },
      // S2 Tiger Gate Ram — Timeline Sync Sheet (tools/sprites/yuezheng_s2.py, 60 FPS T000–T051 = 0.87 s):
      // A ready C01–C02 · B load C03–C04 (C04 = anticipation T014) · C charge C05–C07 from T018 (rush + main VFX) ·
      // D collision C08 held T032–T037 = damage + interrupt + knockback + stun, impact at the contact point ·
      // E push-through C09 · F recovery C10–C12 from T044 · shake up to 8 px peaking T036, no hit-stop
      skill2: {
        row: 6, frames: 12, ms: 80, move: 4,
        seq: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
        steps: [67, 67, 100, 67, 67, 50, 117, 100, 100, 50, 50, 32],
        events: {
          CAST_START: 0, ANTICIPATION_PEAK: 3, STRIKE_START: 4, VFX_SPAWN: 4, DAMAGE: 7, IMPACT: 7, RECOVERY_START: 9,
        },
        impact: { hitStopMs: 0, shakePx: 7, shakeMs: 130 },
      },
      // Ult Mountain Seal Bastion — Timeline Sync Sheet (tools/sprites/yuezheng_ult.py, 60 FPS T000–T131 = 2.20 s):
      // A guard C01–C03 · B shield raise C04–C06 · C charge from T040 (C06 → C07 overhead at T056, held to T095;
      // charge VFX peak T068–T078) · E descent C08–C10 T096–T099 · F GROUND CONTACT C11 T100 = master sync (interrupt +
      // shields + taunt, impact VFX) · G bastion T106 / full T116 · field loop from T118 · H recovery C14 T122
      ult: {
        row: 7, frames: 16, ms: 90,
        seq: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
        steps: [133,  83,  83,  133,  133,  367,  667,  17,  33,  17,  167,  100,  100,  67,  50,  50],
        events: {
          CAST_START: 0, CHARGE_START: 5.273, CHARGE_PEAK: 6.3, STRIKE_START: 7, DAMAGE: 10, IMPACT: 10,
          VFX_SPAWN: 10.6, RECOVERY_START: 13,
        },
        impact: { hitStopMs: 0, shakePx: 10, shakeMs: 200, flashMs: 120 },
      },
    },
    fx: {
      skill: ['yz-s1-main', 'yz-s1-impact'],
      skill2: ['yz-s2-main', 'yz-s2-impact'],
      ult: ['yz-ult-charge', 'yz-ult-impact', 'yz-ult-main-back', 'yz-ult-main-front', 'yz-ult-field-back', 'yz-ult-field-front'],
    },
  },
  'hero-bailong.png': {
    // 220 × 170 (feet 15 px above the cell bottom as before — bottom-anchored, nothing moves): room for the v3 ult leap
    cols: 19, rows: 8, cellW: 220, cellH: 170, pixelated: true,
    // % of a board cell from the cell centre (feet = +27.25 %: sheet bottom 4 % + 15 px × 1.25 %) — x mirrors with facing
    anchors: {
      feet: [0, 27.25],
      bodyCenter: [0, -21],
      // tip of the spear at the Dragon Thrust VFX_SPAWN frame (+85 px ahead of the feet, 48 px up — bailong.py report)
      weaponTip: [106.25, -32.75],
      skillOrigin: [33, -21],
      ultimateChargeOrigin: [0, 27.25],
      ultimateForwardOrigin: [150, -21],
      // v3 ult: spear tip on the thrust (F5) / sweep (F7) poses — the dragon's tail starts there · airborne body (F11–F14)
      ultTip1: [78.75, -29],
      ultTip2: [55, -24],
      ultAir: [8, -58],
    },
    anims: {
      idle: { row: 0, frames: 6 },
      walk: { row: 1, frames: 8, ms: 75 },
      hurt: { row: 2, frames: 4 },
      attack: { row: 3, frames: 6, events: { DAMAGE: 3, RECOVERY_START: 5 } },
      die: { row: 4, frames: 7, ms: 110 },
      // Dragon Thrust: 10 × 95 ms = 0.95 s · ตัวละครเล่นเอง ส่วนลำมังกรเป็น VFX แยกชั้น (FX 'bailong-dragon-thrust')
      skill: {
        row: 5, frames: 10, ms: 95,
        events: { CAST_START: 0, SKILL_ACTIVATE: 4, VFX_SPAWN: 6, DAMAGE: 8, IMPACT: 8, RECOVERY_START: 8 },
        impact: { hitStopMs: 50, shakePx: 3, shakeMs: 140 },
      },
      // Sweeping Moon: 12 × 95 ms = 1.14 s · F5 ง้างสุด · F7 เริ่มกวาด + ปล่อยจันทร์เสี้ยว · F8 กวาดสุด = ดาเมจ
      skill2: {
        row: 6, frames: 12, ms: 95,
        events: { CAST_START: 2, ANTICIPATION_PEAK: 4, SKILL_ACTIVATE: 6, VFX_SPAWN: 6, DAMAGE: 7, IMPACT: 7, RECOVERY_START: 9 },
        impact: { hitStopMs: 60, shakePx: 3, shakeMs: 150 },
      },
      // Nine Dragon Sequence (v3 art, 19 frames, 2 rows 9 + 10): ready → low dash F3–F4 → THRUST F5 (hit 1) → sweep F7
      // (hit 2) → leap F10 → air F11–F14 (overhead gather F14) → dive F15–F16 → GROUND CONTACT F17 (hit 3) → recover
      // · dragons on the board fx layer: hint (thrust) · emerge (sweep) · ascent (leap) · coil (air) · dive / impact /
      // residual on the target. Damage 25 / 30 / 45 % (kit repeat weights).
      ult: {
        row: 7, frames: 19, ms: 120,
        seq: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18],
        steps: [90, 90, 140, 80, 200, 100, 180, 100, 90, 140, 90, 90, 90, 200, 80, 120, 260, 120, 120],
        events: {
          CAST_START: 0, CHARGE_START: 1, ANTICIPATION_PEAK: 2, STRIKE_START: [3, 5, 9], VFX_SPAWN: [11, 14],
          FINAL_ANTICIPATION: 13, DAMAGE: [4, 6, 16], IMPACT: [4, 6, 16], RECOVERY_START: 17,
        },
        impact: [
          { hitStopMs: 30, shakePx: 2, shakeMs: 110 },
          { hitStopMs: 40, shakePx: 4, shakeMs: 150 },
          { hitStopMs: 100, shakePx: 7, shakeMs: 240, flashMs: 140 },
        ],
      },
    },
    fx: {
      skill: 'bailong-dragon-thrust',
      skill2: ['bailong-sweeping-moon', 'bailong-sweeping-moon-hit'],
      ult: ['bl3-hint', 'bl3-emerge', 'bl3-ascent', 'bl3-coil', 'bl3-dive', 'bl3-impact', 'bl3-residual'],
    },
  },
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
  'jade-quake': { file: 'fx-jade-quake.png', frames: 6, w: 192, h: 96, frameMs: 90, at: 'self', dy: -16, scale: 1.1 },
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
  'arrow-normal': { file: 'fx-arrow-normal.png', frames: 6, w: 92, h: 52, frameMs: 60, at: 'target', angle0: 0, scale: 0.7 },
  'lumina-orb': { file: 'fx-lumina-orb.png', frames: 5, w: 57, h: 63, frameMs: 60, at: 'target', angle0: 0, scale: 0.8 },
  // Alpha Howl (tools/sprites/fx_alpha_howl.py จากแผ่น 8 เฟรมของผู้ใช้): frame 5 = FX PEAK = SKILL_ACTIVATE,
  // started early by the engine's 'fx' event · wave origin sits at the wolf's raised mouth and travels forward
  'alpha-howl': { file: 'fx-alpha-howl.png', frames: 8, w: 141, h: 158, frameMs: 90, at: 'self', dx: 109, dy: -52, scale: 0.65 },
  // ลูกธนูก็อบลิน (ตัดจากเฟรมปล่อยสายในแผ่นก็อบลินพลธนู, tools/sprites/monster_sheet.py) · 1 เฟรม หัวชี้ขวา
  'goblin-arrow': { file: 'fx-goblin-arrow.png', frames: 1, w: 39, h: 12, frameMs: 60, at: 'target', angle0: 0, scale: 1.1 },
  // ลำมังกรของ Dragon Thrust (ภาพที่ 4: 2 คอลัมน์ × 7 แถว อ่านซ้าย→ขวา ทีละแถว = 14 เฟรม) — ชั้น VFX แยกจากตัวละคร
  // เกิดตอน event VFX_SPAWN ที่ปลายทวน (anchor weaponTip ของเฟรม 6)
  // pivot = หางมังกรซ้ายกลาง, พุ่งซ้าย→ขวา, กลับด้านตามผู้ใช้ · ไม่ถูกตัดด้วยกรอบตัวละคร (วาดบนชั้น fx ของกระดาน)
  'bailong-dragon-thrust': {
    file: 'fx-bailong-dragon-thrust.png', frames: 14, w: 401, h: 75, frameMs: 45, at: 'self', orient: 'flip', on: 'vfx',
    anchor: 'weaponTip', pivot: [0.06, 0.493], scale: 0.68, pixelated: true,
  },
  // Sweeping Moon — จันทร์เสี้ยวปราณ (13 เฟรม: โตขึ้น 7 แล้วสลาย 6) เกิดตอน VFX_SPAWN หน้าอก, pivot ขอบซ้ายกลาง พุ่ง/กวาดไปทางขวา
  'bailong-sweeping-moon': {
    file: 'fx-bailong-sweeping-moon.png', frames: 13, w: 171, h: 202, frameMs: 35, at: 'self', orient: 'flip', on: 'vfx',
    anchor: 'skillOrigin', pivot: [0.012, 0.5], scale: 0.6, pixelated: true,
  },
  // ประกายกระทบของ Sweeping Moon — บนตัวที่โดนจริง (สูงสุด 3 ตัว ตัวหลักก่อน) ไม่ใช่ตัวทำดาเมจ
  'bailong-sweeping-moon-hit': {
    file: 'fx-bailong-sweeping-moon-hit.png', frames: 8, w: 160, h: 145, frameMs: 55, at: 'target', orient: 'flip', on: 'impact',
    perHit: 3, dy: -16.5, scale: 0.43, pixelated: true,
  },
  // Nine Dragon — ชาร์จ: ออร่ามังกรรอบตัว (ใต้ยูนิต) CHARGE_START → หมดก่อนจังหวะแรก (10 × 65 ms = 0.65 วิ)
  'bailong-nine-dragon-charge': {
    file: 'fx-bailong-nine-dragon-charge.png', frames: 10, w: 164, h: 126, frameMs: 65, at: 'self', orient: 'flip',
    event: 'CHARGE_START', anchor: 'ultimateChargeOrigin', pivot: [0.5, 0.984], scale: 0.72, layer: 'under', pixelated: true,
  },
  // จังหวะ 1–2: แผ่นมังกรเดิม 28 เฟรม (ช่วงเฟรม 1–10 มังกรพุ่งตรง · 11–19 มังกรขดโค้ง) กลางอยู่ 1.5 ช่องหน้าตัว
  'bailong-nine-dragon-1': {
    file: 'fx-bailong-nine-dragon.png', from: 0, frames: 10, stripFrames: 28, w: 292, h: 173, frameMs: 45, at: 'self', orient: 'flip',
    event: 'STRIKE_START', eventIndex: 0, anchor: 'ultimateForwardOrigin', scale: 0.95, pixelated: true,
  },
  'bailong-nine-dragon-2': {
    file: 'fx-bailong-nine-dragon.png', from: 10, frames: 9, stripFrames: 28, w: 292, h: 173, frameMs: 63, at: 'self', orient: 'flip',
    event: 'STRIKE_START', eventIndex: 1, anchor: 'ultimateForwardOrigin', scale: 0.95, pixelated: true,
  },
  // จังหวะ 3 (ปิด): เก้ามังกร v2 เล่นครบ 8 เฟรม พีคเฟรม 5 ตรงดาเมจ แล้วสลายเอง
  'bailong-nine-dragon-3': {
    file: 'fx-bailong-nine-dragon-3.png', frames: 8, w: 277, h: 143, frameMs: 82, at: 'self', orient: 'flip',
    event: 'FINAL_ANTICIPATION', anchor: 'ultTip3', pivot: [0.068, 0.5], scale: 1.1, pixelated: true,
  },
  // ---- Bai Long ult v3 dragons (bailong.py VFX_SHEETS 'v3_*', strips cut at 0.5 of the 2172 × 724 sources) ----
  // thrust: thin dragon launches from the spear tip forward (tail = left pivot)
  'bl3-hint': {
    file: 'fx-bailong-v3-hint.png', frames: 6, w: 174, h: 238, frameMs: 45, at: 'self', orient: 'flip',
    event: 'STRIKE_START', eventIndex: 0, anchor: 'ultTip1', pivot: [0.011, 0.5], dy: -6, scale: 0.34, pixelated: true,
  },
  // sweep: swirl unfurls into the S dragon ahead of the sweep
  'bl3-emerge': {
    file: 'fx-bailong-v3-emerge.png', frames: 8, w: 144, h: 205, frameMs: 50, at: 'self', orient: 'flip',
    event: 'STRIKE_START', eventIndex: 1, anchor: 'ultTip2', pivot: [0.014, 0.5], scale: 0.4, pixelated: true,
  },
  // leap: dragon spirals up from his feet, under the unit
  'bl3-ascent': {
    file: 'fx-bailong-v3-ascent.png', frames: 8, w: 116, h: 308, frameMs: 55, at: 'self', orient: 'flip',
    event: 'STRIKE_START', eventIndex: 2, anchor: 'feet', pivot: [0.5, 0.994], scale: 0.36, layer: 'under', pixelated: true,
  },
  // air: the dragon coils around the airborne body
  'bl3-coil': {
    file: 'fx-bailong-v3-core.png', frames: 12, w: 100, h: 130, frameMs: 45, at: 'self', orient: 'flip',
    event: 'VFX_SPAWN', eventIndex: 0, anchor: 'ultAir', scale: 0.52, layer: 'under', pixelated: true,
  },
  // ground-targeted (the ult hits fixed cells): dive / impact / residual land on the cell in front (dx 100 % = 1 cell)
  // dive: dragon plunges head-first onto the front cell, lands with the spear (F15 → F17)
  'bl3-dive': {
    file: 'fx-bailong-v3-dive.png', frames: 8, w: 112, h: 334, frameMs: 30, at: 'self', orient: 'flip',
    event: 'VFX_SPAWN', eventIndex: 1, pivot: [0.5, 0.994], dx: 100, dy: 27.25, scale: 0.34, pixelated: true,
  },
  // final hit: roaring dragon pillar on the target (only the 3rd strike) + scattering residue after it
  'bl3-impact': {
    file: 'fx-bailong-v3-impact.png', frames: 10, w: 145, h: 354, frameMs: 55, at: 'self', orient: 'flip', on: 'impact',
    hitIndex: 2, pivot: [0.5, 0.994], dx: 100, dy: 27.25, scale: 0.36, pixelated: true,
  },
  // Yue Zheng S1 Iron Wall Taunt (tools/sprites/yuezheng_s1.py): both tracks baked in sync-sheet order at 30 FPS
  // (every 2nd timeline frame), atlas px (scale 1 / FX_SCALE) · main = Mountain Seal wall, pivot = shield front of the
  // activation pose (stable): grows T026–T031, shimmers through the hold, breaks at recovery · impact = taunt pressure
  // 14 px in front of the shield, peak T032 — not enemy damage
  'yz-s1-main': {
    file: 'fx-yuezheng-s1-main.png', frames: 17, w: 79, h: 101, frameMs: 33.33, at: 'self', orient: 'flip', on: 'vfx',
    pivot: [0.496, 0.4975], dx: 53.75, dy: -9.62, scale: 1 / 1.5, pixelated: true,
  },
  'yz-s1-impact': {
    file: 'fx-yuezheng-s1-impact.png', frames: 11, w: 70, h: 69, frameMs: 33.33, at: 'self', orient: 'flip', on: 'vfx',
    pivot: [0.5008, 0.4949], dx: 71.25, dy: -9.62, scale: 1 / 1.5, pixelated: true,
  },
  // Yue Zheng S2 Tiger Gate Ram (tools/sprites/yuezheng_s2.py), sync-sheet order at 30 FPS, atlas px: the shield wave
  // rides with Yue Zheng in front of him (pivot = feet; the engine's CHARGE relocation happens at cast start) · the
  // collision burst plays on the target, on the side Yue Zheng hits from (−0.25 cell)
  'yz-s2-main': {
    file: 'fx-yuezheng-s2-main.png', frames: 15, w: 119, h: 96, frameMs: 33.33, at: 'self', orient: 'flip', on: 'vfx',
    pivot: [0.3519, 0.7271], dx: 0, dy: 27.25, scale: 1 / 1.5, pixelated: true,
  },
  'yz-s2-impact': {
    file: 'fx-yuezheng-s2-impact.png', frames: 9, w: 96, h: 92, frameMs: 33.33, at: 'target', orient: 'flip', on: 'impact',
    pivot: [0.501, 0.7375], dx: -25, dy: 27.25, scale: 1 / 1.5, pixelated: true,
  },
  // Yue Zheng Ult Mountain Seal Bastion (tools/sprites/yuezheng_ult.py): painted VFX with soft alpha (not pixelated),
  // baked in sync-sheet order at 30 FPS, atlas px, pivot = Yue Zheng's feet (the bastion / impact are placed on the
  // shield contact point G inside the tile) · charge from CHARGE_START behind him · impact on the hit (T100) · bastion
  // on VFX_SPAWN (T106), split at the near ground ring (back under the units / ring over) · field loop 18 frames after
  // the hit (T118), 10 × 83 ms × 4 = 3.3 s ≈ the taunt, then fades — the FX stays where it spawned (world position)
  'yz-ult-charge': {
    file: 'fx-yuezheng-ult-charge.png', frames: 26, w: 133, h: 185, frameMs: 33.33, at: 'self', orient: 'flip',
    event: 'CHARGE_START', layer: 'under',
    pivot: [0.4496, 0.9751], dx: 0, dy: 27.25, scale: 1 / 1.5,
  },
  'yz-ult-impact': {
    file: 'fx-yuezheng-ult-impact.png', frames: 10, w: 141, h: 154, frameMs: 33.33, at: 'self', orient: 'flip',
    on: 'impact',
    pivot: [0.3048, 0.9828], dx: 0, dy: 27.25, scale: 1 / 1.5,
  },
  'yz-ult-main-back': {
    file: 'fx-yuezheng-ult-main-back.png', frames: 13, w: 216, h: 246, frameMs: 33.33, at: 'self', orient: 'flip',
    on: 'vfx', layer: 'under',
    pivot: [0.3727, 0.978], dx: 0, dy: 27.25, scale: 1 / 1.5,
  },
  'yz-ult-main-front': {
    file: 'fx-yuezheng-ult-main-front.png', frames: 13, w: 216, h: 246, frameMs: 33.33, at: 'self', orient: 'flip',
    on: 'vfx',
    pivot: [0.3727, 0.978], dx: 0, dy: 27.25, scale: 1 / 1.5,
  },
  'yz-ult-field-back': {
    file: 'fx-yuezheng-ult-field-back.png', frames: 10, w: 210, h: 274, frameMs: 83.33, at: 'self', orient: 'flip',
    on: 'impact', layer: 'under', delayMs: 300, repeat: 4, fadeOutMs: 400,
    pivot: [0.3557, 0.9741], dx: 0, dy: 27.25, scale: 1 / 1.5,
  },
  'yz-ult-field-front': {
    file: 'fx-yuezheng-ult-field-front.png', frames: 10, w: 210, h: 274, frameMs: 83.33, at: 'self', orient: 'flip',
    on: 'impact', delayMs: 300, repeat: 4, fadeOutMs: 400,
    pivot: [0.3557, 0.9741], dx: 0, dy: 27.25, scale: 1 / 1.5,
  },
  'bl3-residual': {
    file: 'fx-bailong-v3-residual.png', frames: 6, w: 190, h: 270, frameMs: 70, at: 'self', orient: 'flip', on: 'impact',
    hitIndex: 2, dx: 100, dy: -30, scale: 0.3, delayMs: 420, pixelated: true,
  },
  // กระแทกครั้งสุดท้าย — กว้างเท่าพื้นที่ที่โดน (ADJACENT_8 รอบเป้า = 3 ช่อง + ขอบ) — เฉพาะจังหวะที่ 3 ที่โดนจริง บนพื้นใต้เป้า
  'bailong-nine-dragon-impact': {
    file: 'fx-bailong-nine-dragon-impact.png', frames: 12, w: 202, h: 168, frameMs: 60, at: 'target', orient: 'flip', on: 'impact',
    hitIndex: 2, pivot: [0.5, 0.988], dy: 27.25, fitCells: 3.4, scale: 0.78, pixelated: true,
  },
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
export function animTiming(sprite: string | undefined, anim: 'attack' | SkillKind): { total: number; hit: number; move: number; hits: number[] } {
  const a = animOf(sprite, anim);
  if (!a) {
    const t = TOKEN_TIMING[anim];
    return { ...t, move: t.hit / 2, hits: [t.hit] };
  }
  const clk = clipClock(a);
  const dmg = a.events?.DAMAGE;
  const hits = (dmg == null ? [a.hit ?? Math.floor(clk.count / 2)] : Array.isArray(dmg) ? dmg : [dmg]).map(clk.at);
  const end = a.events?.ANIMATION_END;
  return { total: typeof end === 'number' ? clk.at(end) : clk.total, hit: hits[0], move: clk.at(a.move ?? 0), hits };
}

/**
 * clock of an action clip: start time (s, speed ×1) of each step — authored choreography (`seq` + `steps` ms)
 * or one sheet frame per step at `ms`. `art(step)` = the sheet frame shown (for logs).
 */
export function clipClock(a: AnimDef): { at: (step: number) => number; count: number; total: number; art: (step: number) => number } {
  if (a.seq && a.steps) {
    const starts = [0];
    for (const ms of a.steps) starts.push(starts[starts.length - 1] + ms / 1000);
    const seq = a.seq;
    // fractional steps = a point inside a held pose (e.g. a flurry of hits while the final lunge is held)
    const at = (i: number) => {
      const k = Math.min(Math.max(Math.floor(i), 0), starts.length - 1);
      return starts[k] + (k < a.steps!.length ? (i - k) * (a.steps![k] / 1000) : 0);
    };
    return { at, count: seq.length, total: starts[starts.length - 1], art: i => seq[Math.min(Math.floor(i), seq.length - 1)] };
  }
  const ms = (a.ms ?? FRAME_MS) / 1000;
  return { at: i => i * ms, count: a.frames, total: a.frames * ms, art: i => i };
}

/** the clip a sheet really plays for this action (ANIM_FALLBACK walked) */
export function animOf(sprite: string | undefined, anim: SpriteAnim): AnimDef | undefined {
  const sheet = sprite ? SHEETS[sprite] : undefined;
  let name: SpriteAnim | null = anim;
  while (sheet && name && !sheet.anims[name]) name = ANIM_FALLBACK[name];
  return name ? sheet?.anims[name] : undefined;
}

export interface ClipEvent {
  event: SemanticEvent;
  /** seconds at speed ×1 */
  t: number;
  frame: number;
  /** n-th occurrence of a repeated event (0-based) */
  index: number;
  /** sheet frame on screen at this event (0-based; differs from `frame` for choreographed clips) */
  art?: number;
}

/**
 * Semantic events of a hero clip in seconds (speed ×1), sorted by time — [] when the clip has no `events`
 * (every sheet without them keeps the old hit-frame timing). ANIMATION_END defaults to the clip length.
 * Same-time events keep their authored order (DAMAGE → IMPACT → RECOVERY_START).
 */
export function animEvents(sprite: string | undefined, anim: 'attack' | SkillKind): ClipEvent[] {
  const a = animOf(sprite, anim);
  if (!a?.events) return [];
  const clk = clipClock(a);
  const out: ClipEvent[] = [];
  for (const [event, v] of Object.entries(a.events) as [SemanticEvent, number | number[]][])
    (Array.isArray(v) ? v : [v]).forEach((frame, index) => out.push({ event, frame, index, t: clk.at(frame), art: clk.art(frame) }));
  if (!a.events.ANIMATION_END) out.push({ event: 'ANIMATION_END', frame: clk.count, index: 0, t: clk.total, art: -1 });
  return out.sort((x, y) => x.t - y.t);
}

/** hit-stop / shake of the clip a unit plays for this skill (per hit for multi-hit clips; none = no contact feel) */
export function impactFeelOf(sprite: string | undefined, anim: 'attack' | SkillKind, hit = 0): ImpactFeel | undefined {
  const f = animOf(sprite, anim)?.impact;
  return Array.isArray(f) ? f[Math.min(hit, f.length - 1)] : f;
}

/** every FX layer a sheet lists for a skill */
export function fxNames(sprite: string | undefined, kind: SkillKind): string[] {
  const v = sprite ? SHEETS[sprite]?.fx?.[kind] : undefined;
  return v == null ? [] : Array.isArray(v) ? v : [v];
}

export type FxTrigger = { on: 'cast' } | { on: 'impact'; hit?: number } | { on: 'event'; event: SemanticEvent; index?: number };

/**
 * FX layers of a skill that start on this trigger (shared by the battle page and the sprite lab).
 * 'cast' = the skill starts · 'impact' = a hit lands (`hitIndex` picks one hit) · 'event' = a clip event
 * (`on: 'vfx'` is VFX_SPAWN, or any `event`). Missing FX entries are skipped — never an error.
 */
export function fxFor(sprite: string | undefined, kind: SkillKind, trig: FxTrigger): string[] {
  return fxNames(sprite, kind).filter(name => {
    const d = FX[name];
    if (!d) return false;
    const ev = d.event ?? (d.on === 'vfx' ? 'VFX_SPAWN' : undefined);
    if (trig.on === 'event') return ev === trig.event && (d.eventIndex ?? 0) === (trig.index ?? 0);
    if (ev) return false;
    if (trig.on === 'cast') return d.on === 'cast';
    return (d.on ?? 'impact') === 'impact' && (d.hitIndex == null || d.hitIndex === (trig.hit ?? 0));
  });
}

/** where an FX sits on its owner: the named anchor (if any) + its own dx / dy, in % of a cell from the cell centre */
export function fxOffset(name: string, sprite?: string): [number, number] {
  const d = FX[name];
  if (!d) return [0, 0];
  const a = d.anchor && sprite ? SHEETS[sprite]?.anchors?.[d.anchor] : undefined;
  return [(a?.[0] ?? 0) + (d.dx ?? 0), (a?.[1] ?? 0) + (d.dy ?? 0)];
}
