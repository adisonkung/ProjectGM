/**
 * ภาพพื้นหลังสนาม (public/backgrounds) — arena ใช้ภาพฉากเดียว ไม่วาดซ้ำ
 * ภาพแบบเก่าที่ไม่ใช่ arena ต่อซ้าย-ขวาได้ไร้รอยต่อ (tools/backgrounds/make_tile.py)
 * และแยกพาราแลกซ์ที่เส้น cut: ชั้นบนเลื่อนช้า ชั้นพื้นเลื่อนเต็มความเร็ว
 */
export interface BackgroundDef {
  file: string;
  /** Single fixed arena image; no repeating/parallax split during a stationary duel. */
  arena?: boolean;
  /** Authored full-screen art: tree-line fraction, used to fit all three lanes above the party dock. */
  battlefieldCut?: number;
  /** Decorative room allocation for a fixed arena. Combat rows and cell size stay independent. */
  skyRows?: number;
  groundRows?: number;
  /** ขนาดภาพ (px) ใช้คำนวณสัดส่วน */
  w: number;
  h: number;
  /** เส้นแบ่งชั้นบน/พื้น เป็นสัดส่วนความสูงภาพ (ใต้แนวดอกไม้/พุ่มไม้ ตรงที่หญ้าเริ่ม) */
  cut: number;
  /** ขยายภาพเทียบความสูงสนาม โดยชิดขอบล่าง (1.19 = ขอบหญ้าขึ้นมาอยู่ราว 48% ของสนาม) */
  zoom: number;
}

export const BACKGROUNDS: Record<string, BackgroundDef> = {
  'ascension-aegis': {file:'backgrounds/ascension-aegis.webp',w:1672,h:941,cut:.5,zoom:1,arena:true,skyRows:1.4,groundRows:.8},
  'ascension-jadecrest': {file:'backgrounds/ascension-jadecrest.webp',w:1672,h:941,cut:.48,zoom:1,arena:true},
  'ascension-solar': {file:'backgrounds/ascension-solar.webp',w:1672,h:941,cut:.52,zoom:1,arena:true,skyRows:.35,groundRows:.45},
  /** ป่าดอกซากุระกลางวัน — ภาพเต็มจอจากผู้ใช้ 2026-11-18 */
  'forest-1': { file: 'backgrounds/forest-1.webp', w: 1672, h: 941, cut: .57, zoom: 1, arena: true, battlefieldCut: .57 },
  /** ป่าสนธยา พระจันทร์ เห็ดเรืองแสง ตะเกียง — ภาพเต็มจอจากผู้ใช้ */
  'twilight-1': { file: 'backgrounds/twilight-1.webp', w: 1672, h: 941, cut: .565, zoom: 1, arena: true, battlefieldCut: .565 },
  /** ป่ามืดหมอกลง ต้นไม้ตาย วิญญาณสีเขียว — ภาพเต็มจอจากผู้ใช้ */
  'misty-1': { file: 'backgrounds/misty-1.webp', w: 1672, h: 941, cut: .56, zoom: 1, arena: true, battlefieldCut: .56 },
};
