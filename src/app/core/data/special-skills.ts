/**
 * Player special skills — a separate button, not part of any hero's kit (heroes, gauges and skill ranks are
 * untouched). The player plays a short mini-game; its grade scales the damage. Bots / AUTO / the balance tools never
 * use it, so floor balance does not depend on it — it is a skill bonus on top.
 */
export type SlashGrade = 'PERFECT' | 'GOOD' | 'OK' | 'MISS';

export interface SlashTraceDefinition {
  id: string;
  name: string;
  description: string;
  kind: 'SLASH_TRACE';
  /** sword trails per use */
  strokes: number;
  /** seconds to draw each trail (the next one lights up after) */
  strokeWindow: number;
  /** COMBAT seconds to charge from empty · charge at stage start (0–1) */
  chargeTime: number;
  startCharge: number;
  /** damage of one trail = team average final ATK × this × grade multiplier, to every enemy on the field */
  strokeAtkPct: number;
  damageType: 'PHYSICAL';
  /** grade → multiplier of that trail */
  gradeMultiplier: Record<SlashGrade, number>;
  /** trail score (0–1) needed for a grade */
  gradeAt: { PERFECT: number; GOOD: number; OK: number };
  /** accuracy tolerance: fraction of the field's smaller side */
  tolerance: number;
}

export const BLADE_TRACE: SlashTraceDefinition = {
  id: 'blade_trace',
  name: 'ดาบพันรอย',
  description: 'ลากตามรอยดาบให้ทันทีละเส้น — แม่นและทัน = ดาเมจเต็ม · ช้า/ลากผิดทาง/หลุดเส้น = ดาเมจลด · ฟันศัตรูทุกตัวบนสนาม',
  kind: 'SLASH_TRACE',
  strokes: 4,
  strokeWindow: 1.3,
  chargeTime: 30,
  startCharge: 0.5,
  strokeAtkPct: 0.75,
  damageType: 'PHYSICAL',
  gradeMultiplier: { PERFECT: 1.2, GOOD: 1, OK: 0.65, MISS: 0.3 },
  gradeAt: { PERFECT: 0.85, GOOD: 0.6, OK: 0.3 },
  tolerance: 0.08,
};

export const SPECIAL_SKILLS: Record<string, SlashTraceDefinition> = { [BLADE_TRACE.id]: BLADE_TRACE };
