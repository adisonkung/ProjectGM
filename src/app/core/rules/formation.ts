import { LANES, Line, lineOf } from '../../battle/engine/grid';
import { TeamSlot } from '../models/game-state';

/**
 * ช่องฟอร์เมชัน (STEP 8): แถวหน้า/หลัง + เลน 0–2 (index)
 * เก็บจริงใน TeamSlot เป็น r = ความลึก 0–5, c = เลน — แถวหน้า = ความลึก 0–2 (ติดศัตรู), แถวหลัง = 3–5
 * ฟอร์เมชันคือ "ตำแหน่งเริ่ม + แนวรบที่ใช้เลือกเป้า" ไม่ใช่ช่องตายตัว หลังเริ่มสู้ฮีโร่เดินได้อิสระ
 */
export interface FormationSlot {
  row: Line;
  index: number;
}

export function toFormation(slot: Pick<TeamSlot, 'r' | 'c'>): FormationSlot {
  return { row: lineOf(slot.r), index: Math.min(LANES - 1, Math.max(0, slot.c)) };
}
