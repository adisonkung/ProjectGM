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
  /**
   * feel played when one of this clip's events fires (battle page + sprite lab), independent of a hit landing — e.g. a
   * sword slamming the ground on the release of a travelling wave whose damage only lands later
   */
  eventFeel?: Partial<Record<SemanticEvent, ImpactFeel>>;
  /**
   * runtime opacity of the character while this clip plays: [step (fractions ok, same unit as `events`), opacity 0–1]
   * keys, linear between them (e.g. Phantom Step vanishing / reappearing). A blink inside such a clip skips the
   * board's own blink-in fade — the clip draws it.
   */
  opacity?: [number, number][];
  /**
   * runtime root motion of the character while this clip plays: [step, dx, dy] keys in atlas px (dx = forward along
   * the facing, dy = down, so a leap is negative), linear between keys (sample a curve densely for a smooth arc).
   * Moves the drawn sprite only — the unit's cell / the engine never see it (e.g. Thousand Petal leap + dive).
   */
  root?: [number, number, number][];
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
  /** 'allies' = centre of the caster's living team formation (team-wide field, e.g. a healer's ritual) */
  at: 'self' | 'target' | 'allies';
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
  /** with perHit: leave the primary out (e.g. the light splash heal around the healed ally — the primary has its own FX) */
  exceptPrimary?: boolean;
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
  /** กระสุน: ไม่หมุนตามทิศที่บิน (ดอกบัวลอยตั้งตรงเสมอ) */
  noRotate?: boolean;
  /** กระสุน: เอฟเฟกต์ที่เล่นเพิ่มตรงเป้าเมื่อกระทบ */
  hitFx?: string;
  /**
   * กระสุน: บินเลยเป้าไปอีกกี่ช่องด้วยความเร็วเดิม (ภาพเท่านั้น — ดาเมจยังลงตอนถึงเป้า) เช่นมีดทะลวงแนว
   * ที่ทะลุไปหาตัวหลัง · เฟรมสุดท้าย (จาง) แสดงที่ปลายทาง
   */
  overshoot?: number;
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
      // shields + taunt, impact VFX held to T130) · G impact sustain + field rise · field loop from T118 · H recovery C14 T122
      ult: {
        row: 7, frames: 16, ms: 90,
        seq: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
        steps: [133,  83,  83,  133,  133,  367,  667,  17,  33,  17,  167,  100,  100,  67,  50,  50],
        events: {
          CAST_START: 0, CHARGE_START: 5.273, CHARGE_PEAK: 6.3, STRIKE_START: 7, DAMAGE: 10, IMPACT: 10,
          RECOVERY_START: 13,
        },
        impact: { hitStopMs: 0, shakePx: 10, shakeMs: 200, flashMs: 120 },
      },
    },
    fx: {
      skill: ['yz-s1-main', 'yz-s1-impact'],
      skill2: ['yz-s2-main', 'yz-s2-impact'],
      ult: ['yz-ult-charge', 'yz-ult-impact', 'yz-ult-field-back', 'yz-ult-field-front'],
    },
  },
  // Mo Ye — Shadow Orchid Blade (remodel #3, tools/sprites/moye.py): base sheet + S1 (row 5) — S2 / Ult fall back to
  // the attack clip until their sheets arrive in rows 6–7. Cell 260 × 170 like Yue Zheng (the big blade overhead /
  // extended), feet 15 px above the cell bottom, idle body 74 px · walk = a run (flight frames keep their height)
  'hero-moye.png': {
    cols: 16, rows: 8, cellW: 260, cellH: 170, pixelated: true,
    anchors: { feet: [0, 27.25], bodyCenter: [0, -20] },
    anims: {
      idle: { row: 0, frames: 6 },
      walk: { row: 1, frames: 8, ms: 70 },
      hurt: { row: 2, frames: 4 },
      // ready → step in → big blade raised F3 → cut extended F4 = damage → small-blade follow-through F5–F7 → guard F8
      attack: { row: 3, frames: 8, ms: 80, events: { DAMAGE: 3, RECOVERY_START: 6 } },
      die: { row: 4, frames: 7, ms: 120 },
      // S1 Orchid Sever — Timeline Sync Sheet (tools/sprites/moye_s1.py, 60 FPS T000–T047 = 0.80 s): ready C01–C02 ·
      // big blade raised C03 (T006) · step-in C04 (T008) · big-blade cut C05 = hit 1 T012 · twist C06 (T020) ·
      // small-blade cut C07 = hit 2 T024 · follow-through C08 (T032) · recovery C09–C10 (T040) · root +12 px baked
      skill: {
        row: 5, frames: 10, ms: 80,
        seq: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
        steps: [67, 33, 33, 50, 117, 83, 150, 133, 67, 67],
        events: {
          CAST_START: 0, ANTICIPATION_PEAK: 2, STRIKE_START: [3, 5.4], VFX_SPAWN: 4.143,
          DAMAGE: [4.143, 6.111], IMPACT: [4.143, 6.111], RECOVERY_START: 8,
        },
        impact: [{ hitStopMs: 17, shakePx: 2, shakeMs: 50 }, { hitStopMs: 33, shakePx: 3, shakeMs: 50 }],
      },
      // S2 Phantom Step — Timeline Sync Sheet (tools/sprites/moye_s2.py, 60 FPS T000–T057 ≈ 0.97 s): ready C01–C02 ·
      // crouch C03 (T006) · push-off C04 = VANISH_START T008 · low dash C05 (0–15 % opacity) · airborne C06 — the engine's
      // blink moves her at T025 (`move`) · REAPPEAR T028 → full T032 on the landing crouch C03 · wind-up C04 (T036) ·
      // big-blade lunge C07 = damage T040 · flourish C08 = recovery T046 · C09–C10. Opacity is runtime (`opacity`).
      skill2: {
        row: 6, frames: 10, ms: 80,
        seq: [0, 1, 2, 3, 4, 5, 2, 3, 6, 7, 8, 9],
        steps: [67, 33, 33, 67, 133, 200, 67, 50, 117, 83, 67, 50],
        move: 5.417,
        events: {
          CAST_START: 0, ANTICIPATION_PEAK: 2, VANISH_START: 3, VFX_SPAWN: 3.5, REAPPEAR_START: 5.667,
          STRIKE_START: 7, DAMAGE: 8.143, IMPACT: 8.143, RECOVERY_START: 9,
        },
        opacity: [[0, 1], [2.5, 1], [3, 0.8], [3.5, 0.45], [4, 0.12], [5.333, 0.08], [5.417, 0.2], [5.667, 0.55], [5.833, 0.8], [6, 1]],
        impact: { hitStopMs: 50, shakePx: 5, shakeMs: 70 },
      },
      // Ult Thousand Petal Execution — Timeline Sync Sheet (tools/sprites/moye_ult.py, 60 FPS T000–T125 = 2.10 s):
      // lock C01–C02 (T008) · vanish C03 (T012, blink T024) · reappear C04 (T028) · slash 1 C05 big blade T032 ·
      // slash 2 C06 small blade T048 · slash 3 C07 T064 · load C08 · leap C09 (T072) · airborne C10 (T080) · aerial
      // raise C11 (T088) · descent C12–C13 (T096) · FINAL HIT C14 T104 (critical) · land T110 · recovery C15–C16 (T118).
      // Root X (6–24 px between hits) + the leap / dive arc (−62 px at T094) + the vanish are runtime (`root`, `opacity`).
      ult: {
        row: 7, frames: 16, ms: 80,
        seq: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
        steps: [100, 100, 267, 33, 233, 233, 133, 100, 133, 133, 133, 67, 67, 233, 67, 68],
        move: 2.75,
        events: {
          CAST_START: 0, ANTICIPATION_PEAK: 1.333, VANISH_START: 2, VFX_SPAWN: 2.25, REAPPEAR_START: 3,
          STRIKE_START: [4, 5, 6, 11], DAMAGE: [4.143, 5.286, 6.75, 13], IMPACT: [4.143, 5.286, 6.75, 13],
          CHARGE_START: 9, FINAL_ANTICIPATION: 10, RECOVERY_START: 14,
        },
        opacity: [[0.0, 1], [1.833, 1], [2.0, 0.7], [2.125, 0.3], [2.25, 0.08], [2.688, 0.05], [2.75, 0.25], [2.875, 0.6], [3.0, 1], [16.0, 1]],
        root: [[0.0, 0.0, 0.0], [0.333, 0.0, 0.0], [0.667, 0.0, 0.0], [1.0, 0.0, 0.0], [1.333, 0.0, 0.0], [1.667, 0.0, 0.0], [2.0, 0.0, 0.0], [2.125, 0.0, 0.0], [2.25, 0.0, 0.0], [2.375, 0.0, 0.0], [2.5, 0.0, 0.0], [2.625, 0.0, 0.0], [2.75, 0.0, 0.0], [2.875, 0.0, 0.0], [3.0, 0.0, 0.0], [4.0, 3.0, 0.0], [4.143, 6.0, 0.0], [4.286, 5.9, 0.0], [4.429, 5.5, 0.0], [4.571, 5.0, 0.0], [4.714, 4.5, 0.0], [4.857, 4.1, 0.0], [5.0, 4.0, 0.0], [5.143, 7.0, 0.0], [5.286, 10.0, 0.0], [5.429, 9.8, 0.0], [5.571, 9.3, 0.0], [5.714, 8.7, 0.0], [5.857, 8.2, 0.0], [6.0, 8.0, 0.0], [6.25, 10.1, 0.0], [6.5, 13.9, 0.0], [6.75, 16.0, 0.0], [7.0, 15.4, 0.0], [7.333, 14.0, 0.0], [7.667, 12.6, 0.0], [8.0, 12.0, 0.0], [8.25, 12.1, -3.3], [8.5, 12.3, -10.5], [8.75, 12.6, -18.0], [9.0, 13.0, -24.5], [9.25, 13.4, -31.2], [9.5, 13.7, -38.0], [9.75, 13.9, -45.6], [10.0, 14.0, -52.0], [10.25, 14.0, -56.6], [10.5, 14.0, -60.4], [10.75, 14.0, -62.0], [11.0, 14.0, -61.0], [11.5, 16.0, -49.9], [12.0, 18.0, -32.0], [12.5, 21.0, -12.2], [13.0, 24.0, 0.0], [13.143, 23.5, 0.0], [13.286, 22.5, 0.0], [13.429, 22.0, 0.0], [13.571, 20.4, 0.0], [13.714, 17.0, 0.0], [13.857, 13.6, 0.0], [14.0, 12.0, 0.0], [14.5, 9.6, 0.0], [15.0, 4.7, 0.0], [15.5, 0.7, 0.0], [16.0, 0.0, 0.0]],
        impact: [{ hitStopMs: 33, shakePx: 2, shakeMs: 50 }, { hitStopMs: 33, shakePx: 2, shakeMs: 50 }, { hitStopMs: 50, shakePx: 3, shakeMs: 60 }, { hitStopMs: 100, shakePx: 9, shakeMs: 200 }],
      },
    },
    fx: {
      skill: ['my-s1-main', 'my-s1-impact1', 'my-s1-impact2'],
      skill2: ['my-s2-main', 'my-s2-reappear', 'my-s2-impact'],
      ult: ['my-ult-trail', 'my-ult-arc1', 'my-ult-arc2', 'my-ult-arc3', 'my-ult-aura', 'my-ult-descent', 'my-ult-impact', 'my-ult-residual'],
    },
  },
  // ถังซวิ่น — Whispering Blade (remodel #4, tools/sprites/tangxun.py): base sheet · cell 260 × 170, root (130, 155),
  // idle body 78 px · rows 5–7 reserved for S1 / S2 / Ult · the knife in flight is the projectile (fx-tangxun-knife)
  'hero-tangxun.png': {
    cols: 17, rows: 8, cellW: 260, cellH: 170, pixelated: true,
    anchors: { feet: [0, 27.25], bodyCenter: [0, -22] },
    anims: {
      idle: { row: 0, frames: 6 },
      walk: { row: 1, frames: 8, ms: 70 },
      hurt: { row: 2, frames: 3, ms: 110 },
      // ready → draw F2 → wind-up F3 → arm extended F4 → release F5 (the knife leaves = projectile spawns) → recover F6–F8
      attack: { row: 3, frames: 8, ms: 80, events: { DAMAGE: 4, RECOVERY_START: 6 } },
      die: { row: 4, frames: 6, ms: 130 },
      // S1 Piercing Fang — Timeline Sync Sheet (tools/sprites/tangxun_s1.py, 60 FPS T000–T045 ≈ 0.77 s): ready C01 ·
      // draw C02–C03 (T007) · elbow back C04 = anticipation T012 · throw C05 (T016) · release C06 = DAMAGE (the projectile
      // leaves the fingertip) T019 · arm held C07 while the one blade pierces the line (T030 / T034 / T036) · C08–C10 ·
      // root ≤ 6 px (runtime) · the blade = projectile fx 'tx-s1-fang' with overshoot (keeps flying through the line)
      skill: {
        row: 5, frames: 10, ms: 80,
        seq: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
        steps: [117, 50, 33, 67, 50, 83, 233, 50, 50, 34],
        events: { CAST_START: 0, ANTICIPATION_PEAK: 3, STRIKE_START: 4, DAMAGE: 5, RECOVERY_START: 8 },
        root: [[0.0, 0.0, 0], [0.429, 0.0, 0], [0.857, 0.0, 0], [1.667, 0.0, 0], [3.0, 0.0, 0], [3.75, 0.0, 0], [4.0, 0.0, 0], [4.667, 2.2, 0], [5.0, 3.0, 0], [5.4, 3.7, 0], [6.0, 5.0, 0], [6.214, 4.9, 0], [6.429, 4.6, 0], [6.643, 4.3, 0], [6.857, 4.1, 0], [7.0, 4.0, 0], [7.333, 3.8, 0], [8.333, 1.6, 0], [10.0, 0.0, 0]],
        // target 1: 2-frame hit-stop + 3 px · pierced targets 2 / 3: no hit-stop, 1 px
        impact: [{ hitStopMs: 33, shakePx: 3, shakeMs: 50 }, { shakePx: 1, shakeMs: 40 }, { shakePx: 1, shakeMs: 40 }],
      },
      // S2 Severing Chain — Timeline Sync Sheet (tools/sprites/tangxun_s2.py, 60 FPS T000–T071 = 1.20 s): ready C01 ·
      // prepare C02 (T006) · three throws of ONE blade each: throw C03 (T010) → release C05 (T014) · C07 (T026) → C09 (T030) ·
      // C11 (T040) → C13 (T045) = the three DAMAGE events (the engine fires one projectile 'tx-s2-blade' per throw) ·
      // finish C14 (T056) · recovery C15 (T064) · root ≤ 10 px (runtime) · hits T020 / T036 / T052 (in game: flight time)
      skill2: {
        row: 6, frames: 16, ms: 75,
        seq: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
        steps: [100, 67, 50, 17, 83, 117, 50, 17, 83, 83, 50, 33, 183, 133, 67, 67],
        events: { CAST_START: 0, ANTICIPATION_PEAK: 1.0, STRIKE_START: [2.0, 6.0, 10.0], DAMAGE: [4.0, 8.0, 12.0], RECOVERY_START: 14.0 },
        root: [[0.0, 0.0, 0], [0.667, 0.0, 0], [1.5, 0.0, 0], [2.0, 0.0, 0], [2.667, 1.5, 0], [4.0, 3.0, 0], [4.4, 2.8, 0], [5.143, 2.2, 0], [5.429, 2.0, 0], [5.714, 2.0, 0], [6.0, 2.0, 0], [6.667, 3.5, 0], [8.0, 5.0, 0], [8.4, 4.8, 0], [9.2, 4.2, 0], [9.6, 4.0, 0], [10.0, 4.0, 0], [11.5, 7.6, 0], [12.0, 8.0, 0], [12.273, 8.8, 0], [12.636, 10.0, 0], [13.0, 9.5, 0], [13.5, 9.0, 0], [14.0, 6.0, 0], [15.0, 2.4, 0], [16.0, 0.0, 0]],
        // hit-stop 1 / 1 / 3 frames · shake 1 / 1 / 4 px (throw 3 = interrupt + Open Wound)
        impact: [{ hitStopMs: 17, shakePx: 1, shakeMs: 40 }, { hitStopMs: 17, shakePx: 1, shakeMs: 50 }, { hitStopMs: 50, shakePx: 4, shakeMs: 90 }],
      },
      // Ult Heaven-Snaring Blade Array — Timeline Sync Sheet (tools/sprites/tangxun_ult.py, 60 FPS T000–T149 = 2.50 s):
      // ready C01 · draw C02 (T010) · arms spread C03 = charge T018–T039 (peak T036) · release signal C04 = VFX_SPAWN
      // T040 (the array forms at the locked target) · control C05 · raised hand / light hop C06–C08 (scan T068, lock
      // T080) · command C09–C10 (compression) · guide C11–C13 = 4 minor cuts T108 / T112 / T116 / T120 · gather C14
      // (T124) · decisive command C15 (T128) = finisher T130 · settle C16 · recovery C17 (T146) · root ≤ 12 px
      ult: {
        row: 7, frames: 17, ms: 100,
        seq: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16],
        steps: [167, 133, 367, 200, 133, 133, 167, 100, 200, 133, 133, 133, 67, 67, 200, 100, 67],
        events: {
          CAST_START: 0, ANTICIPATION_PEAK: 1.0, CHARGE_START: 2.0, CHARGE_PEAK: 2.818, VFX_SPAWN: 3.0,
          FINAL_ANTICIPATION: 13.0, STRIKE_START: 14.0, DAMAGE: [10.5, 11.0, 11.5, 12.0, 14.167], IMPACT: [10.5, 11.0, 11.5, 12.0, 14.167], RECOVERY_START: 16.0,
        },
        root: [[0.0, 0.0, 0], [0.6, 0.0, 0], [1.25, 0.0, 0], [2.0, 0.0, 0], [2.273, 0.0, 0], [2.545, 0.0, 0], [2.818, 0.0, 0], [3.0, 0.0, 0], [3.167, 2.0, 0], [3.333, 4.0, 0], [3.667, 3.0, 0], [4.0, 2.0, 0], [4.25, 1.7, 0], [5.0, 0.0, 0], [5.75, 0.0, 0], [6.4, 0.0, 0], [7.0, 0.0, 0], [8.0, 0.0, 0], [8.333, 5.0, 0], [8.5, 5.0, 0], [9.0, 4.5, 0], [9.75, 4.0, 0], [10.0, 4.0, 0], [10.5, 3.8, 0], [11.25, 3.0, 0], [12.0, 2.2, 0], [13.0, 2.0, 0], [13.5, 5.0, 0], [14.0, 8.0, 0], [14.333, 12.0, 0], [14.833, 10.3, 0], [15.0, 10.0, 0], [15.667, 6.3, 0], [16.0, 5.0, 0], [17.0, 0.0, 0]],
        // minor cuts: 1-frame hit-stop, 1–2 px · finisher: 6 frames, 8 px + flash
        impact: [{ hitStopMs: 17, shakePx: 1, shakeMs: 40 }, { hitStopMs: 17, shakePx: 1, shakeMs: 40 }, { hitStopMs: 17, shakePx: 1, shakeMs: 40 }, { hitStopMs: 17, shakePx: 2, shakeMs: 50 }, { hitStopMs: 100, shakePx: 8, shakeMs: 240, flashMs: 180 }],
      },
    },
    projectile: { attack: 'tangxun-knife', skill: 'tx-s1-fang', skill2: 'tx-s2-blade' },
    fx: {
      skill: ['tx-s1-impact1', 'tx-s1-impact2', 'tx-s1-impact3'],
      skill2: ['tx-s2-impact1', 'tx-s2-impact2', 'tx-s2-impact3'],
      ult: ['tx-ult-charge', 'tx-ult-surround', 'tx-ult-main', 'tx-ult-spark0', 'tx-ult-spark1', 'tx-ult-spark2', 'tx-ult-spark3', 'tx-ult-impact', 'tx-ult-shock', 'tx-ult-residual'],
    },
  },
  'hero-garrick.png': {
    // Garrick Stoneward (The Iron Bell) base rows from the user's sheet (tools/sprites/garrick.py) — skill rows 5–7 reserved
    cols: 14, rows: 8, cellW: 260, cellH: 170, pixelated: true,
    anchors: { feet: [0, 27.25], bodyCenter: [0, -22] },
    anims: {
      idle: { row: 0, frames: 5, ms: 170 },
      walk: { row: 1, frames: 7, ms: 95 },
      hurt: { row: 2, frames: 4, ms: 100 },
      // ready F1 → wind back F2 → hammer overhead F3–F4 → slam into the ground F5 (spark) → follow-through F6–F7
      attack: { row: 3, frames: 7, ms: 85, events: { DAMAGE: 4, RECOVERY_START: 5 } },
      die: { row: 4, frames: 6, ms: 140 },
      // S1 Brace for Impact — production Timeline Sync Sheet (tools/sprites/garrick_s1.py, 60 FPS F00–F65 = 1.10 s):
      // preparation C01–C03 (lowers his centre of gravity) · guard activation C04–C06 (BRACE START F18, Main VFX rises
      // F20, hammer planted F27) · SKILL ACTIVATION F30 = DR + taunt + counter armed + Guard Aura loop (C07–C08) ·
      // settle C09–C10 (F50 → cast complete F65) · the aura keeps looping for the 3 s guard · root 0 · no shake
      skill: {
        row: 5, frames: 10, ms: 110,
        seq: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
        steps: [100, 100, 100, 83, 67, 50, 133, 200, 133, 134],
        events: {
          CAST_START: 0, ANTICIPATION_PEAK: 2.0, STRIKE_START: 3.0, VFX_SPAWN: 3.4, SKILL_ACTIVATE: 6.0, DAMAGE: 6.0,
          RECOVERY_START: 8.0,
        },
      },
      // S2 Hammerfall — production Timeline Sync Sheet (tools/sprites/garrick_s2.py, 60 FPS F00–F53 = 0.90 s): ready /
      // weight shift C01–C02 · heavy wind-up C03–C05 (ANTICIPATION START F10) · ATTACK RELEASE F24 (C06, Main VFX at the
      // hammer's contact point) · DAMAGE + BREAK 70 + KNOCKBACK + IMPACT F31 (C07, hammer head on the ground) ·
      // RECOVERY F37 (C08–C10) · root 0 · hit-stop 50 ms + shake 4 px
      skill2: {
        row: 6, frames: 10, ms: 90,
        seq: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
        steps: [83, 83, 100, 67, 67, 117, 100, 100, 83, 100],
        events: {
          CAST_START: 0, ANTICIPATION_PEAK: 2.0, STRIKE_START: 5.0, VFX_SPAWN: 5.0, DAMAGE: 6.0, IMPACT: 6.0, RECOVERY_START: 7.0,
        },
        impact: { hitStopMs: 50, shakePx: 4, shakeMs: 120 },
      },
      // Ult Hold the Gate — production Timeline Sync Sheet (tools/sprites/garrick_ult.py, 60 FPS F00–F95 = 1.60 s):
      // resolve C01–C03 · bastion summoning C04–C06 (ULTIMATE CAST START F18, Main VFX) · FORTRESS MANIFESTATION F36
      // (C07–C08) · ULTIMATE ACTIVATION F48 = team DR + interception + taunt + stagger resistance (C09–C10) · settle
      // C11–C12 (Main → Aura F60) · recovery C13–C14 (F78 → F95) · the 6 s buff + aura outlive the clip · root 0
      ult: {
        row: 7, frames: 14, ms: 115,
        seq: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13],
        steps: [100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 150, 150, 150, 150],
        events: {
          CAST_START: 0, CHARGE_START: 3.0, VFX_SPAWN: 3.0, CHARGE_PEAK: 6.0, SKILL_ACTIVATE: 8.0, DAMAGE: 8.0,
          RECOVERY_START: 12.0,
        },
        impact: { hitStopMs: 60, shakePx: 2, shakeMs: 120 },
      },
    },
    fx: {
      skill: ['gr-s1-main', 'gr-s1-aura'], skill2: ['gr-s2-main', 'gr-s2-impact', 'gr-s2-shock'],
      ult: ['gr-ult-main', 'gr-ult-aura'],
    },
  },
  'hero-kael.png': {
    // Kael Ashen Vanguard (tools/sprites/kael.py, sources = assets/heroes/Kael): base rows cut per connected figure ·
    // row 5 = S1 Sundering Edge · row 6 = S2 Relentless Cross (14 frames → 14 columns) · row 7 = Ult Ashen Rupture
    cols: 14, rows: 8, cellW: 260, cellH: 170, pixelated: true,
    anchors: { feet: [0, 27.25], bodyCenter: [0, -22] },
    anims: {
      idle: { row: 0, frames: 5, ms: 170 },
      walk: { row: 1, frames: 7, ms: 85 },
      hurt: { row: 2, frames: 4, ms: 100 },
      // ready F1 → sword raised F2 → overhead cut F3 (arc) → forward thrust F4 (arc = contact) → extended F5 → recover F6–F7
      attack: { row: 3, frames: 7, ms: 80, events: { DAMAGE: 3, RECOVERY_START: 5 } },
      die: { row: 4, frames: 6, ms: 140 },
      // S1 Sundering Edge — kael_timeline_v2 skill_1 (tools/sprites/kael_s1.py, 12 FPS provisional = 83.3 ms / frame,
      // 0.83 s): READY F1 · LOWER F2 · DRAW_BACK F3 · WIND_UP F4 · MAX_ANTICIPATION F5 · ATTACK_RELEASE F6 (Main VFX) ·
      // HIT_1 F7 (damage once + Impact VFX) · FOLLOW_THROUGH F8 · RECOVERY F9 · READY_END F10 · root 0 · light shake
      skill: {
        row: 5, frames: 10, ms: 83,
        seq: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
        steps: [83, 83, 83, 83, 83, 83, 83, 83, 83, 86],
        events: {
          CAST_START: 0, ANTICIPATION_PEAK: 4, STRIKE_START: 5, VFX_SPAWN: 5, DAMAGE: 6, IMPACT: 6, RECOVERY_START: 8,
        },
        impact: { hitStopMs: 0, shakePx: 2, shakeMs: 90 },
      },
      // S2 Relentless Cross — kael_timeline_v2 skill_2 (tools/sprites/kael_s2.py, 14 frames 2 × 7, 12 FPS provisional =
      // 1.17 s): RELEASE_HORIZONTAL F4 (main 1) · HIT_1 horizontal cut F5 · FOLLOW_THROUGH F6 (F4–F6 blade redrawn as
      // a horizontal sweep, kael_s2_edit.py) · RELEASE_RISING F9 (main 2) · HIT_2 rising reverse diagonal F10 ·
      // RECOVERY F13 — two DAMAGE events = kit repeat 2 (each hit index resolves once)
      skill2: {
        row: 6, frames: 14, ms: 83,
        seq: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13],
        steps: [83, 83, 83, 83, 83, 83, 83, 83, 83, 83, 83, 83, 83, 88],
        events: {
          CAST_START: 0, ANTICIPATION_PEAK: 2, STRIKE_START: [3, 8], VFX_SPAWN: [3, 8], DAMAGE: [4, 9], IMPACT: [4, 9],
          RECOVERY_START: 12,
        },
        impact: [{ hitStopMs: 0, shakePx: 2, shakeMs: 80 }, { hitStopMs: 0, shakePx: 3, shakeMs: 110 }],
      },
      // Ult Ashen Rupture — kael_timeline_v2 ultimate (tools/sprites/kael_ult.py, 10 frames held per frame = 1.57 s —
      // user 2026-10: bigger, slower, a longer charge): READY F1 · CHARGE F2–F5 (ember vortex from CHARGE_START) · F6
      // held 0.3 s at the peak (CHARGE_PEAK) · a fast cut F7 · RELEASE F8 = the ground wave spawns AND the travelling
      // DAMAGE starts (kit `travel` 7 cells/s: front line cell 1 → 4, each unit hit once as the wave reaches it, one
      // impact per collision, the last one hardest + flash) · RECOVERY F9–F10
      ult: {
        row: 7, frames: 10, ms: 83,
        seq: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
        steps: [83, 133, 133, 150, 167, 300, 67, 167, 167, 200],
        events: {
          CAST_START: 0, CHARGE_START: 1, CHARGE_PEAK: 5, STRIKE_START: 6, VFX_SPAWN: 7, DAMAGE: 7, RECOVERY_START: 8,
        },
        // F8 the sword slams the ground (+ the S1 burst, `kl-ult-slam`) — felt before the wave's first collision
        eventFeel: { VFX_SPAWN: { hitStopMs: 50, shakePx: 7, shakeMs: 180, flashMs: 80 } },
        impact: [
          { hitStopMs: 0, shakePx: 4, shakeMs: 120 }, { hitStopMs: 0, shakePx: 4, shakeMs: 120 },
          { hitStopMs: 0, shakePx: 5, shakeMs: 140 }, { hitStopMs: 60, shakePx: 8, shakeMs: 220, flashMs: 120 },
        ],
      },
    },
    fx: {
      skill: ['kl-s1-main', 'kl-s1-impact'], skill2: ['kl-s2-main1', 'kl-s2-main2', 'kl-s2-impact1', 'kl-s2-impact2'],
      ult: ['kl-ult-charge', 'kl-ult-slam', 'kl-ult-wave', 'kl-ult-impact'],
    },
  },
  'hero-linxue.png': {
    // Lin Xue (Lotus Spirit Physician) base rows from the user's sheet (tools/sprites/linxue.py) — rows 6–7 reserved
    cols: 21, rows: 8, cellW: 260, cellH: 170, pixelated: true,
    anchors: { feet: [0, 27.25], bodyCenter: [0, -22] },
    anims: {
      idle: { row: 0, frames: 3, ms: 180 },
      walk: { row: 1, frames: 6, ms: 90 },
      hurt: { row: 2, frames: 3, ms: 110 },
      // raise staff F1–F3 → lotus released F4 (projectile) → recover F5–F6
      attack: { row: 3, frames: 6, ms: 85, events: { DAMAGE: 3, RECOVERY_START: 4 } },
      die: { row: 4, frames: 5, ms: 140 },
      // S1 Lotus Prayer — production Timeline Sync Sheet (tools/sprites/linxue_s1.py, 60 FPS T000–T044 ≈ 0.75 s):
      // target / ready C01 (find lowest-HP ally T002, lock T006) · prayer C02–C04 (T008, peak T014) · release C05–C07
      // (T018, staff / hand release point T022) · hold C08: Heal Burst spawns on the primary T024 → PRIMARY HEAL T025 →
      // peak T027 → nearby check T030 → SPLASH HEAL T031 · recovery C09 (T036) · C10 · root ≤ 2 px · no shake / zoom
      skill: {
        row: 5, frames: 10, ms: 75,
        seq: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
        steps: [117, 50, 67, 67, 33, 33, 33, 200, 83, 67],
        events: {
          CAST_START: 0, ANTICIPATION_PEAK: 3.0, STRIKE_START: 4.0, SKILL_ACTIVATE: 6.0, VFX_SPAWN: 7.0,
          DAMAGE: [7.083, 7.583], RECOVERY_START: 8.0,
        },
        root: [[0.0, 0.0, 0], [4.0, 0.0, 0], [5.0, 1.0, 0], [6.0, 2.0, 0], [7.917, 2.0, 0], [8.0, 1.9, 0], [8.8, 0.8, 0], [10.0, 0.0, 0]],
      },
      // S2 Spirit Mend — production Timeline Sync Sheet (tools/sprites/linxue_s2.py, 60 FPS T000–T062 = 1.05 s):
      // ready C01 (select T003, lock T008) · raise staff C02 (cast T010) · channel C03 · gather C04 (peak T017) · release
      // C05 = Main VFX spawns ON the ally T020 (seal T024, sweep T028) → CLEANSE T030 · follow-through C06: heal burst
      // T036 → EMERGENCY HEAL T038 → Qi Guard forms T044 → QI GUARD T048 → stabilise T052 · recovery C07 (T054) – C10 ·
      // root <= 4 px · no impact VFX, no shake / zoom
      skill2: {
        row: 6, frames: 10, ms: 105,
        seq: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
        steps: [150, 67, 67, 50, 267, 300, 50, 33, 33, 33],
        events: {
          CAST_START: 0, STRIKE_START: 1.25, ANTICIPATION_PEAK: 3.0, SKILL_ACTIVATE: 4.0, VFX_SPAWN: 4.0,
          DAMAGE: [4.625, 5.111, 5.667], RECOVERY_START: 6.0,
        },
        root: [[0.0, 0.0, 0], [3.0, 0.0, 0], [3.333, 0.8, 0], [4.0, 3.0, 0], [4.25, 4.0, 0], [5.944, 4.0, 0], [6.0, 3.7, 0], [7.5, 1.0, 0], [8.5, 0.5, 0], [10.0, 0.0, 0]],
      },
      // Ult Returning Spring Rite — production Timeline Sync Sheet (tools/sprites/linxue_ult.py, 60 FPS T000–T143 = 2.40 s):
      // ready C01 · eyes close C02 (T008) · raise staff C03 (T016, charge VFX T018) · invoke C04 · channel C05–C09
      // (build T030, high T044, peak T052) · release C10 (T060) · follow-through C11 = ULTIMATE_RELEASE T064, Main VFX on
      // the formation T070 · C12: TEAM HEAL T092, TEAM CLEANSE T104 · C13: revival light on the chosen ally T114 → REVIVE
      // T118 (REVIVE delay), blessing T124 · recovery C14–C21 (T134) · root <= 2 px · no hit-stop / shake
      ult: {
        row: 7, frames: 21, ms: 115,
        seq: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
        steps: [133, 133, 100, 133, 100, 133, 67, 100, 100, 67, 400, 367, 400, 33, 17, 17, 33, 17, 17, 17, 16],
        events: {
          CAST_START: 0, ANTICIPATION_PEAK: 1.0, CHARGE_START: 2.333, CHARGE_PEAK: 7.667,
          FINAL_ANTICIPATION: 9.0, SKILL_ACTIVATE: 10.0, VFX_SPAWN: 10.25,
          DAMAGE: [11.182, 11.727, 12.167], RECOVERY_START: 13.0,
        },
        root: [[0.0, 0.0, 0], [1.5, 0.0, 0], [3.25, 0.0, 0], [5.0, 0.0, 0], [7.0, 0.0, 0], [9.0, 0.0, 0], [10.0, 2.0, 0], [10.333, 2.0, 0], [10.833, 2.0, 0], [11.364, 2.0, 0], [11.909, 2.0, 0], [12.417, 2.0, 0], [12.917, 2.0, 0], [12.958, 2.0, 0], [21.0, 0.0, 0]],
      },
    },
    projectile: { attack: 'linxue-lotus' },
    fx: { skill: ['lx-s1-bloom', 'lx-s1-splash'], skill2: ['lx-s2-main', 'lx-s2-guard'], ult: ['lx-ult-charge', 'lx-ult-main', 'lx-ult-revive'] },
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
  // Tang Xun S1 Piercing Fang (tools/sprites/tangxun_s1.py): the ONE flying blade = projectile sprite (tip on the frame
  // centre, 8 frames: release flash → blade + narrow jade trail → wind ring → fade) flying past the target (`overshoot`)
  // · impact on each pierced unit at its contact point: target 1 full, 2 / 3 smaller + fainter (hitIndex 1 / 2)
  'tx-s1-fang': { file: 'fx-tangxun-s1-fang.png', frames: 8, w: 188, h: 26, frameMs: 33, at: 'target', angle0: 0, scale: 1 / 1.3, overshoot: 2.2, pixelated: true },
  'tx-s1-impact1': {
    file: 'fx-tangxun-s1-impact1.png', frames: 4, w: 72, h: 49, frameMs: 33.33, at: 'target', orient: 'flip', on: 'impact', hitIndex: 0, delayMs: 17,
    pivot: [0.4998, 0.5018], dx: -17.5, dy: -25.25, scale: 1 / 1.5, pixelated: true,
  },
  'tx-s1-impact2': {
    file: 'fx-tangxun-s1-impact2.png', frames: 3, w: 48, h: 33, frameMs: 33.33, at: 'target', orient: 'flip', on: 'impact', hitIndex: 1, delayMs: 17,
    pivot: [0.4946, 0.4949], dx: -17.5, dy: -25.25, scale: 1 / 1.5, pixelated: true,
  },
  'tx-s1-impact3': {
    file: 'fx-tangxun-s1-impact3.png', frames: 3, w: 37, h: 26, frameMs: 33.33, at: 'target', orient: 'flip', on: 'impact', hitIndex: 2, delayMs: 17,
    pivot: [0.4998, 0.4921], dx: -17.5, dy: -25.25, scale: 1 / 1.5, pixelated: true,
  },
  // Tang Xun S2 Severing Chain: ONE blade per throw (spawned three times) — f1 spawn sparkle … f7 trail · f8 contact sparkle
  'tx-s2-blade': { file: 'fx-tangxun-s2-blade.png', frames: 8, w: 152, h: 36, frameMs: 33, at: 'target', angle0: 0, scale: 1 / 1.3, pixelated: true },
  'tx-s2-impact1': {
    file: 'fx-tangxun-s2-impact1.png', frames: 5, w: 43, h: 93, frameMs: 33.33, at: 'target', orient: 'flip', on: 'impact', hitIndex: 0,
    pivot: [0.6409, 0.5355], dx: -12.5, dy: -27.75, scale: 1 / 1.5,
  },
  'tx-s2-impact2': {
    file: 'fx-tangxun-s2-impact2.png', frames: 5, w: 49, h: 105, frameMs: 33.33, at: 'target', orient: 'flip', on: 'impact', hitIndex: 1,
    pivot: [0.6302, 0.5324], dx: -12.5, dy: -27.75, scale: 1 / 1.5,
  },
  'tx-s2-impact3': {
    file: 'fx-tangxun-s2-impact3.png', frames: 6, w: 54, h: 116, frameMs: 33.33, at: 'target', orient: 'flip', on: 'impact', hitIndex: 2,
    pivot: [0.6333, 0.5345], dx: -12.5, dy: -27.75, scale: 1 / 1.5,
  },
  // Tang Xun Ult Heaven-Snaring Blade Array (painted VFX, 30 FPS strips in timeline order — not pixelated):
  // charge around him (CHARGE_START T018, behind, ends streaming toward the target) · the array at the locked target's
  // feet (VFX_SPAWN T040 → fades T124–T129) · small jade sparks on the 4 minor cuts · impact (hit 5, peak T133) · residual (T140)
  'tx-ult-charge': {
    file: 'fx-tangxun-ult-charge.png', frames: 18, w: 306, h: 151, frameMs: 33.33, at: 'self', orient: 'flip', event: 'CHARGE_START', layer: 'under',
    pivot: [0.2523, 0.7998], dy: 27.25, scale: 1 / 1.5,
  },
  'tx-ult-main': {
    file: 'fx-tangxun-ult-main.png', frames: 37, w: 162, h: 175, frameMs: 33.33, at: 'target', orient: 'flip', on: 'vfx', delayMs: 267,
    pivot: [0.4994, 0.7819], dy: 24.75, scale: 1 / 1.5,
  },
  'tx-ult-spark0': {
    file: 'fx-tangxun-s1-impact3.png', frames: 3, w: 37, h: 26, frameMs: 33.33, at: 'target', orient: 'flip', on: 'impact', hitIndex: 0,
    dx: -12.5, dy: -40.25, scale: 1 / 1.5, pixelated: true,
  },
  'tx-ult-spark1': {
    file: 'fx-tangxun-s1-impact3.png', frames: 3, w: 37, h: 26, frameMs: 33.33, at: 'target', orient: 'flip', on: 'impact', hitIndex: 1,
    dx: 7.5, dy: -55.25, scale: 1 / 1.5, pixelated: true,
  },
  'tx-ult-spark2': {
    file: 'fx-tangxun-s1-impact3.png', frames: 3, w: 37, h: 26, frameMs: 33.33, at: 'target', orient: 'flip', on: 'impact', hitIndex: 2,
    dx: -5.0, dy: -20.25, scale: 1 / 1.5, pixelated: true,
  },
  'tx-ult-spark3': {
    file: 'fx-tangxun-s1-impact3.png', frames: 3, w: 37, h: 26, frameMs: 33.33, at: 'target', orient: 'flip', on: 'impact', hitIndex: 3,
    dx: 12.5, dy: -32.75, scale: 1 / 1.5, pixelated: true,
  },
  // the 8 thrown blades (S2 single-blade art) fly in from Tang Xun's side and ring the target T040–T065 (60 FPS, landing T052) — the
  // storm / array ('tx-ult-main') forms only after they surround it (+267 ms = T056, frames cross-fade) · jade ground shockwave from T130
  'tx-ult-surround': {
    file: 'fx-tangxun-ult-surround.png', frames: 26, w: 333, h: 154, frameMs: 16.67, at: 'target', orient: 'flip', on: 'vfx',
    pivot: [0.6667, 0.5649], dy: -22.75, scale: 1 / 1.5,
  },
  'tx-ult-shock': {
    file: 'fx-tangxun-ult-shock.png', frames: 6, w: 296, h: 115, frameMs: 33.33, at: 'target', orient: 'flip', on: 'impact', hitIndex: 4, layer: 'under',
    pivot: [0.5, 0.5], dy: 24.75, scale: 1 / 1.5,
  },
  'tx-ult-impact': {
    file: 'fx-tangxun-ult-impact.png', frames: 5, w: 182, h: 117, frameMs: 33.33, at: 'target', orient: 'flip', on: 'impact', hitIndex: 4,
    pivot: [0.5008, 0.4943], dy: -22.75, scale: 1 / 1.5,
  },
  'tx-ult-residual': {
    file: 'fx-tangxun-ult-residual.png', frames: 9, w: 134, h: 90, frameMs: 33.33, at: 'target', orient: 'flip', on: 'impact', hitIndex: 4,
    delayMs: 167, pivot: [0.4998, 0.5019], dy: -22.75, scale: 1 / 1.5,
  },
  // Tang Xun's throwing knife (reference sheet, tools/sprites/tangxun.py) — points right, 1 frame (no impact frame)
  'tangxun-knife': { file: 'fx-tangxun-knife.png', frames: 1, w: 28, h: 4, frameMs: 60, at: 'target', angle0: 0, scale: 0.9, pixelated: true },
  // Lin Xue S1 Lotus Prayer (tools/sprites/linxue_s1.py): the bloom on the healed ally (spark → bud → peak at the heal →
  // petals scatter, 12 fr 30 FPS from VFX_SPAWN) · the same lotus at 55 % on each ally the splash heal reached
  // Lin Xue S1 Lotus Prayer (tools/sprites/linxue_s1.py, 60 FPS strips): the Heal Burst on the primary at 100 % (spawn
  // T024 → peak T027 → petals → gone T043) · the same asset from the bud (f3) at 65 % scale / 60 % opacity on each
  // ally the splash heal reached (hit 1 = T031), never on the primary
  // Garrick S1 Brace for Impact (tools/sprites/garrick_s1.py): the Main VFX once at his feet (F20 rune ring → F30 peak
  // crystal guard + golden sword crest → breaks → fades F53) · the Guard Aura from the activation (F30): 8 frames ×
  // 93.75 ms, 4 loops = the 3 s guard, then fades · both drawn IN FRONT of him (user 2026-10; the dome is see-through)
  // Kael S1 Sundering Edge (tools/sprites/kael_s1.py, 60 FPS strips): Main VFX = the slash arc at the sword swing, F6 →
  // peak at the hit F7 · Impact VFX = burst at the target's contact side, F7 (after the damage resolved)
  'kl-s1-main': {
    file: 'fx-kael-s1-main.png', frames: 23, w: 138, h: 92, frameMs: 16.67, at: 'self', orient: 'flip', on: 'vfx',
    pivot: [0.5768, 0.9792], dx: 70, dy: 27.25, scale: 1 / 1.5,
  },
  'kl-s1-impact': {
    file: 'fx-kael-s1-impact.png', frames: 22, w: 113, h: 91, frameMs: 16.67, at: 'target', orient: 'flip', on: 'impact',
    hitIndex: 0, pivot: [0.4665, 0.9731], dx: -12.5, dy: 27.25, scale: 1 / 1.5,
  },
  // Kael S2 Relentless Cross (tools/sprites/kael_s2.py, 60 FPS strips): main 1 = horizontal arc at blade height F4 → peak (S2 VFX ×1.35 of the drawn scale, user 2026-10)
  // on hit 1 · main 2 = rising diagonal arc scooping up off the ground F9 → peak on hit 2 · impact 1 / 2 at the target's contact side
  'kl-s2-main1': {
    file: 'fx-kael-s2-main1.png', frames: 17, w: 175, h: 64, frameMs: 16.67, at: 'self', orient: 'flip',
    event: 'VFX_SPAWN', eventIndex: 0, dx: 65, dy: 12.25, scale: 1 / 1.5,
    pivot: [0.5231, 0.9606],
  },
  'kl-s2-main2': {
    file: 'fx-kael-s2-main2.png', frames: 17, w: 139, h: 110, frameMs: 16.67, at: 'self', orient: 'flip',
    event: 'VFX_SPAWN', eventIndex: 1, dx: 65, dy: 27.25, scale: 1 / 1.5,
    pivot: [0.5778, 0.9799],
  },
  'kl-s2-impact1': {
    file: 'fx-kael-s2-impact1.png', frames: 16, w: 114, h: 92, frameMs: 16.67, at: 'target', orient: 'flip',
    on: 'impact', hitIndex: 0, dx: -12.5, dy: 27.25, scale: 1 / 1.5,
    pivot: [0.4499, 0.9763],
  },
  'kl-s2-impact2': {
    file: 'fx-kael-s2-impact2.png', frames: 16, w: 121, h: 106, frameMs: 16.67, at: 'target', orient: 'flip',
    on: 'impact', hitIndex: 1, dx: -12.5, dy: 27.25, scale: 1 / 1.5,
    pivot: [0.481, 0.981],
  },
  // Kael Ult Ashen Rupture (tools/sprites/kael_ult.py, every layer with an ember bloom — user 2026-10: bigger, an
  // ultimate): the charge vortex behind him from CHARGE_START (30 FPS, ~2.4 × his width, its biggest frame held still
  // through the held F6 — user 2026-10, drawn into the sword on the cut) · the ground wave from VFX_SPAWN (30 FPS strip, ~1.9 × his height, its travel along
  // the front line baked in at the kit's 7 cells/s — leading edge reaches cell k at (k − 0.5) / 7 s, when that cell's
  // damage resolves) · a burst (~1.6 × body) on every unit each collision hit (one impact event per cell)
  'kl-ult-charge': {
    file: 'fx-kael-ult-charge.png', frames: 30, w: 232, h: 268, frameMs: 33.33, at: 'self', orient: 'flip',
    event: 'CHARGE_START', layer: 'under', pivot: [0.5007, 0.9395], dy: 27.25, scale: 1 / 1.5,
  },
  // F8 ground slam (user 2026-10): the S1 impact burst (kael_s1_impact_vfx.png) reused at the blade's ground contact,
  // ~1.7 × his width with the ember bloom, drawn under the wave
  'kl-ult-slam': {
    file: 'fx-kael-ult-slam.png', frames: 27, w: 170, h: 141, frameMs: 16.67, at: 'self', orient: 'flip', on: 'vfx',
    pivot: [0.472, 0.8996], dx: 65, dy: 27.25, scale: 1 / 1.5,
  },
  'kl-ult-wave': {
    file: 'fx-kael-ult-wave.png', frames: 20, w: 446, h: 175, frameMs: 33.33, at: 'self', orient: 'flip', on: 'vfx',
    pivot: [0.1081, 0.9211], dx: 50, dy: 27.25, scale: 1 / 1.5,
  },
  'kl-ult-impact': {
    file: 'fx-kael-ult-impact.png', frames: 8, w: 156, h: 177, frameMs: 50, at: 'target', orient: 'flip', on: 'impact',
    perHit: 6, pivot: [0.5013, 0.5009], dx: -7.5, dy: -12.75, scale: 1 / 1.5,
  },
  'gr-s1-main': {
    file: 'fx-garrick-s1-main.png', frames: 34, w: 129, h: 159, frameMs: 16.67, at: 'self', orient: 'flip', on: 'vfx',
    pivot: [0.4945, 0.6589], dy: 27.25, scale: 1 / 1.5,
  },
  'gr-s1-aura': {
    file: 'fx-garrick-s1-aura.png', frames: 8, w: 100, h: 91, frameMs: 93.75, at: 'self', orient: 'flip', on: 'impact',
    hitIndex: 0, repeat: 4, fadeOutMs: 300, pivot: [0.4963, 0.7614], dy: 27.25, scale: 1 / 1.5,
  },
  // Garrick S2 Hammerfall (tools/sprites/garrick_s2.py, 60 FPS): the Main VFX 20 px ahead of the hammer's ground contact
  // (+50 px in front of his feet — user: the swing + first burst read too close to him; F24 dust → swing arc → STONE BURST F31 → shock ring → fades F53, over him) · the Impact VFX
  // at the primary's feet (F31 → peak F33 → dust ring F52) · the shock = the impact at 55 % / 60 % on every other unit hit
  'gr-s2-main': {
    file: 'fx-garrick-s2-main.png', frames: 30, w: 141, h: 113, frameMs: 16.67, at: 'self', orient: 'flip', on: 'vfx',
    pivot: [0.4526, 0.8015], dx: 62.5, dy: 27.25, scale: 1 / 1.5,
  },
  'gr-s2-impact': {
    file: 'fx-garrick-s2-impact.png', frames: 22, w: 99, h: 131, frameMs: 16.67, at: 'target', orient: 'flip', on: 'impact',
    hitIndex: 0, pivot: [0.5089, 0.8149], dy: 27.25, scale: 1 / 1.5,
  },
  'gr-s2-shock': {
    file: 'fx-garrick-s2-shock.png', frames: 15, w: 55, h: 73, frameMs: 16.67, at: 'target', orient: 'flip', on: 'impact',
    hitIndex: 0, perHit: 6, exceptPrimary: true, pivot: [0.512, 0.8104], dy: 27.25, scale: 1 / 1.5,
  },
  // Garrick Ult Hold the Gate (tools/sprites/garrick_ult.py): the lion fortress once at his feet (F18 seal → F36 gates →
  // F48 full fortress → recedes → gone F78, 30 FPS) · the lighter persistent aura from F60 (activation + 200 ms) for the
  // 6 s buff (125 ms steps: seal → gates rise → breathe → sink) · both BEHIND him — he stands inside the bastion
  'gr-ult-main': {
    file: 'fx-garrick-ult-main.png', frames: 30, w: 202, h: 203, frameMs: 33.33, at: 'self', orient: 'flip', on: 'vfx',
    layer: 'under', pivot: [0.5185, 0.8322], dy: 27.25, scale: 1 / 1.5,
  },
  'gr-ult-aura': {
    file: 'fx-garrick-ult-aura.png', frames: 46, w: 139, h: 146, frameMs: 125, at: 'self', orient: 'flip', on: 'impact',
    hitIndex: 0, layer: 'under', delayMs: 200, fadeOutMs: 300, pivot: [0.4979, 0.767], dy: 27.25, scale: 1 / 1.5,
  },
  'lx-s1-bloom': {
    file: 'fx-linxue-s1-bloom.png', frames: 20, w: 86, h: 99, frameMs: 16.67, at: 'target', orient: 'flip', on: 'vfx',
    pivot: [0.5082, 0.5021], dy: -22.75, scale: 1 / 1.5,
  },
  'lx-s1-splash': {
    file: 'fx-linxue-s1-splash.png', frames: 12, w: 57, h: 65, frameMs: 16.67, at: 'target', orient: 'flip', on: 'impact',
    hitIndex: 1, perHit: 8, exceptPrimary: true, pivot: [0.5045, 0.5024], dy: -17.75, scale: 1 / 1.5,
  },
  // Lin Xue S2 Spirit Mend (tools/sprites/linxue_s2.py, 60 FPS): the whole revised Main VFX on the ally's feet (seal >
  // sweep > lock > heal burst > Qi Guard dome > stabilise > residual > fade, T020–T067, cross-faded holds) — no impact
  // VFX · then the runtime Qi Guard shell: the stabilised dome at 35–48 % breathing every 0.5 s from T058 for the
  // rest of the 4 s guard (repeat 7 + fade) instead of keeping the Main VFX alive
  'lx-s2-main': {
    file: 'fx-linxue-s2-main.png', frames: 48, w: 131, h: 132, frameMs: 16.67, at: 'target', orient: 'flip', on: 'vfx',
    pivot: [0.5016, 0.9218], dy: 27.25, scale: 1 / 1.5,
  },
  'lx-s2-guard': {
    file: 'fx-linxue-s2-guard.png', frames: 30, w: 126, h: 127, frameMs: 16.67, at: 'target', orient: 'flip', on: 'impact',
    hitIndex: 2, delayMs: 167, repeat: 7, fadeOutMs: 300, pivot: [0.5006, 0.9198], dy: 27.25, scale: 1 / 1.5,
  },
  // Lin Xue Ult Returning Spring Rite (tools/sprites/linxue_ult.py, 60 FPS): the Charge VFX around her feet (wide, low;
  // T018 → peak T052 → drains T064–T073) · the Main VFX = the ritual field on the centre of the living allied formation
  // (`at: 'allies'`, T070–T143: spring → lotus → team blessing / heal wave → cleanse sweep → revival light → peak aura →
  // fade; baked at half resolution, scale ×2) · the revival cue = the Main VFX revival light, localized on the dead ally
  // the REVIVE beat picked (T114 → peak on the revive T118 → gone T125) · no impact VFX, no per-ally heal pulse
  'lx-ult-charge': {
    file: 'fx-linxue-ult-charge.png', frames: 56, w: 123, h: 112, frameMs: 16.67, at: 'self', orient: 'flip', event: 'CHARGE_START',
    layer: 'under', pivot: [0.5053, 0.8963], dx: 5, dy: 27.25, scale: 1 / 1.5,
  },
  'lx-ult-main': {
    file: 'fx-linxue-ult-main.png', frames: 74, w: 151, h: 129, frameMs: 16.67, at: 'allies', orient: 'flip', on: 'vfx',
    layer: 'under', pivot: [0.5029, 0.8979], dy: 27.25, scale: 2 / 1.5,
  },
  'lx-ult-revive': {
    file: 'fx-linxue-ult-revive.png', frames: 12, w: 90, h: 80, frameMs: 16.67, at: 'target', orient: 'flip', on: 'impact',
    hitIndex: 2, perHit: 1, exceptPrimary: true, pivot: [0.4968, 0.8935], dy: 27.25, scale: 1 / 1.5,
  },
  'linxue-lotus': { file: 'fx-linxue-lotus.png', frames: 1, w: 22, h: 14, frameMs: 60, at: 'target', angle0: 0, scale: 1.3, noRotate: true, pixelated: true },
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
  // Mo Ye S1 Orchid Sever (tools/sprites/moye_s1.py): tracks baked in sync-sheet order at 30 FPS, atlas px, on the
  // TARGET (dx toward Mo Ye): main = the cut on the enemy's body centre from hit 1 (crescent of the big blade → the
  // crossing slash peaks with hit 2) · impact per hit at the blade contact (hit 1 small, hit 2 stronger)
  'my-s1-main': {
    file: 'fx-moye-s1-main.png', frames: 13, w: 67, h: 87, frameMs: 33.33, at: 'target', orient: 'flip', on: 'impact',
    hitIndex: 0, pivot: [0.6658, 0.5006], dx: -7.5, dy: -22.75, scale: 1 / 1.5, pixelated: true,
  },
  'my-s1-impact1': {
    file: 'fx-moye-s1-impact1.png', frames: 4, w: 36, h: 43, frameMs: 33.33, at: 'target', orient: 'flip', on: 'impact',
    hitIndex: 0, delayMs: 33, pivot: [0.5336, 0.4965], dx: -17.5, dy: -25.25, scale: 1 / 1.5, pixelated: true,
  },
  'my-s1-impact2': {
    file: 'fx-moye-s1-impact2.png', frames: 7, w: 51, h: 61, frameMs: 33.33, at: 'target', orient: 'flip', on: 'impact',
    hitIndex: 1, delayMs: 17, pivot: [0.5389, 0.5016], dx: -17.5, dy: -25.25, scale: 1 / 1.5, pixelated: true,
  },
  // Mo Ye S2 Phantom Step (tools/sprites/moye_s2.py), 30 FPS strips in timeline order: the dash trail at her ORIGIN
  // (VFX_SPAWN T010, pivot = left-centre on her body, stretched 2 tiles along the path, gone by T035) · the shadow /
  // petal cluster where she comes back (REAPPEAR_START T028, after the blink) · the X burst on the target (T040, peak T042)
  'my-s2-main': {
    file: 'fx-moye-s2-main.png', frames: 13, w: 168, h: 80, frameMs: 33.33, at: 'self', on: 'vfx', layer: 'under',
    pivot: [0.006, 0.4981], dx: 5, dy: -20.25, scale: 1 / 1.5, pixelated: true,
  },
  'my-s2-reappear': {
    file: 'fx-moye-s2-reappear.png', frames: 3, w: 72, h: 43, frameMs: 33.33, at: 'self', event: 'REAPPEAR_START',
    pivot: [0.5, 0.4186], dx: 5, dy: -22.75, scale: 1 / 1.5, pixelated: true,
  },
  'my-s2-impact': {
    file: 'fx-moye-s2-impact.png', frames: 8, w: 91, h: 91, frameMs: 33.33, at: 'target', orient: 'flip', on: 'impact',
    pivot: [0.5167, 0.4989], dx: -17.5, dy: -25.25, scale: 1 / 1.5, pixelated: true,
  },
  // Mo Ye Ult Thousand Petal Execution (tools/sprites/moye_ult.py), 30 FPS strips in timeline order: vanish trail at
  // her origin (VFX_SPAWN T016) · slash arcs on the target per STRIKE_START (T030 / T046 / T060, arc 2 mirrored) ·
  // petal vortex around her at the top of the leap (CHARGE_START = AIRBORNE T080, grows to the dive) · descending
  // crescent over the target (T096) · final impact on the target's ground contact (T104) · residual from T114 (no damage)
  'my-ult-trail': {
    file: 'fx-moye-ult-trail.png', frames: 6, w: 132, h: 58, frameMs: 33.33, at: 'self', on: 'vfx', layer: 'under',
    pivot: [0.0076, 0.5637], dx: 5.0, dy: -20.25, scale: 1 / 1.5, pixelated: true,
  },
  'my-ult-arc1': {
    file: 'fx-moye-ult-arc1.png', frames: 5, w: 115, h: 82, frameMs: 33.33, at: 'target', orient: 'flip', event: 'STRIKE_START', eventIndex: 0,
    pivot: [0.5354, 0.5593], dx: -7.5, dy: -22.75, scale: 1 / 1.5, pixelated: true,
  },
  'my-ult-arc2': {
    file: 'fx-moye-ult-arc2.png', frames: 4, w: 116, h: 87, frameMs: 33.33, at: 'target', orient: 'flip', event: 'STRIKE_START', eventIndex: 1, delayMs: 33,
    pivot: [0.5336, 0.4577], dx: -7.5, dy: -22.75, scale: 1 / 1.5, pixelated: true,
  },
  'my-ult-arc3': {
    file: 'fx-moye-ult-arc3.png', frames: 5, w: 124, h: 83, frameMs: 33.33, at: 'target', orient: 'flip', event: 'STRIKE_START', eventIndex: 2, delayMs: 33,
    pivot: [0.5352, 0.5082], dx: -7.5, dy: -22.75, scale: 1 / 1.5, pixelated: true,
  },
  'my-ult-aura': {
    file: 'fx-moye-ult-aura.png', frames: 10, w: 124, h: 74, frameMs: 33.33, at: 'self', event: 'CHARGE_START', layer: 'under',
    pivot: [0.5, 0.5], dx: 17.5, dy: -85.25, scale: 1 / 1.5, pixelated: true,
  },
  'my-ult-descent': {
    file: 'fx-moye-ult-descent.png', frames: 6, w: 88, h: 125, frameMs: 33.33, at: 'target', orient: 'flip', event: 'STRIKE_START', eventIndex: 3,
    pivot: [0.4593, 0.536], dx: -27.5, dy: -45.25, scale: 1 / 1.5, pixelated: true,
  },
  'my-ult-impact': {
    file: 'fx-moye-ult-impact.png', frames: 7, w: 151, h: 152, frameMs: 33.33, at: 'target', orient: 'flip', on: 'impact', hitIndex: 3,
    pivot: [0.5499, 0.9868], dx: -12.5, dy: 27.25, scale: 1 / 1.5, pixelated: true,
  },
  'my-ult-residual': {
    file: 'fx-moye-ult-residual.png', frames: 15, w: 120, h: 78, frameMs: 33.33, at: 'target', orient: 'flip', on: 'impact', hitIndex: 3, delayMs: 167,
    pivot: [0.5, 0.5], dx: -10.0, dy: -10.25, scale: 1 / 1.5, pixelated: true,
  },
  'yz-s2-impact': {
    file: 'fx-yuezheng-s2-impact.png', frames: 9, w: 96, h: 92, frameMs: 33.33, at: 'target', orient: 'flip', on: 'impact',
    pivot: [0.501, 0.7375], dx: -25, dy: 27.25, scale: 1 / 1.5, pixelated: true,
  },
  // Yue Zheng Ult Mountain Seal Bastion (tools/sprites/yuezheng_ult.py): painted VFX with soft alpha (not pixelated),
  // baked in sync-sheet order at 30 FPS, atlas px, pivot = Yue Zheng's feet · charge (2.7 body heights) from
  // CHARGE_START behind him · impact on the hit (T100), placed 14 px ahead of the shield contact point G and held to
  // T130 (replaces the old Main/bastion sheet) · field loop centred on his feet 18 frames after the hit (T118), split at
  // the near ground ring (back under the units / ring over), 10 × 83 ms × 4 = 3.3 s ≈ the taunt, then fades —
  // the FX stays where it spawned (world position)
  'yz-ult-charge': {
    file: 'fx-yuezheng-ult-charge.png', frames: 26, w: 156, h: 216, frameMs: 33.33, at: 'self', orient: 'flip',
    event: 'CHARGE_START', layer: 'under',
    pivot: [0.45, 0.9796], dx: 0, dy: 27.25, scale: 1 / 1.5,
  },
  'yz-ult-impact': {
    file: 'fx-yuezheng-ult-impact.png', frames: 16, w: 141, h: 154, frameMs: 33.33, at: 'self', orient: 'flip',
    on: 'impact',
    pivot: [0.2056, 0.9828], dx: 0, dy: 27.25, scale: 1 / 1.5,
  },
  'yz-ult-field-back': {
    file: 'fx-yuezheng-ult-field-back.png', frames: 10, w: 210, h: 274, frameMs: 83.33, at: 'self', orient: 'flip',
    on: 'impact', layer: 'under', delayMs: 300, repeat: 4, fadeOutMs: 400,
    pivot: [0.489, 0.9741], dx: 0, dy: 27.25, scale: 1 / 1.5,
  },
  'yz-ult-field-front': {
    file: 'fx-yuezheng-ult-field-front.png', frames: 10, w: 210, h: 274, frameMs: 83.33, at: 'self', orient: 'flip',
    on: 'impact', delayMs: 300, repeat: 4, fadeOutMs: 400,
    pivot: [0.489, 0.9741], dx: 0, dy: 27.25, scale: 1 / 1.5,
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

/** the feel bound to a clip event (`AnimDef.eventFeel`), if any */
export function eventFeelOf(sprite: string | undefined, anim: 'attack' | SkillKind, event: SemanticEvent): ImpactFeel | undefined {
  return animOf(sprite, anim)?.eventFeel?.[event];
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
