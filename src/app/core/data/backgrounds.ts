/**
 * ภาพพื้นหลังสนาม (public/backgrounds) — ภาพเดียวต่อฉาก ต่อซ้าย-ขวาได้ไร้รอยต่อ
 * (ทำด้วย tools/backgrounds/make_tile.py) · สนามตัดเป็น 2 ชั้นที่เส้น `cut` เพื่อเลื่อนแบบพาราแลกซ์:
 * ชั้นบน (ฟ้า ภูเขา ต้นไม้) เลื่อนช้า ชั้นพื้นหญ้าเลื่อนเต็มความเร็ว
 */
export interface BackgroundDef {
  file: string;
  /** Single fixed arena image; no repeating/parallax split during a stationary duel. */
  arena?: boolean;
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
  'ascension-aegis': {file:'backgrounds/ascension-aegis.webp',w:1672,h:941,cut:.5,zoom:1,arena:true,skyRows:.3,groundRows:.8},
  'ascension-jadecrest': {file:'backgrounds/ascension-jadecrest.webp',w:1672,h:941,cut:.48,zoom:1,arena:true},
  'ascension-solar': {file:'backgrounds/ascension-solar.webp',w:1672,h:941,cut:.52,zoom:1,arena:true,skyRows:.35,groundRows:.45},
  /** ป่าดอกซากุระกลางวัน (ชั้น 1-5) */
  'forest-1': { file: 'backgrounds/forest-1.webp', w: 1894, h: 809, cut: 0.569, zoom: 1.19 },
  /** ป่าสนธยา พระจันทร์ เห็ดเรืองแสง ตะเกียง (ชั้น 6-8) — ขอบหญ้าอยู่ 48% อยู่แล้ว ไม่ต้องขยาย */
  'twilight-1': { file: 'backgrounds/twilight-1.webp', w: 1894, h: 809, cut: 0.483, zoom: 1 },
  /** ป่ามืดหมอกลง ต้นไม้ตาย วิญญาณสีเขียว (ชั้น 9-10 บอสลิช) — ขอบหญ้าอยู่ 44% ไม่ต้องขยาย */
  'misty-1': { file: 'backgrounds/misty-1.webp', w: 1894, h: 809, cut: 0.447, zoom: 1 },
};
