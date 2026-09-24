import { HeroClass } from './hero';
import { Cell } from './unit';

export type WinCondition = 'eliminate' | 'survive';

export interface EnemyTemplate {
  id: string;
  name: string;
  cls: HeroClass;
  hp: number;
  atk: number;
  def: number;
  boss?: boolean;
  /** สกิลร่าย (คีย์ใน ENEMY_SKILLS) */
  castSkills?: string[];
  /** เตรียมไว้สำหรับบอส (Break Gauge ในอนาคต) — ตอนนี้ยังไม่ใช้ */
  interruptResistance?: number;
}

export interface EnemyPlacement extends Cell {
  enemy: string;
}

export interface StageDef {
  floor: number;
  mode: WinCondition;
  /** วินาที: ด่านกำจัดคือเวลาจำกัด, ด่านเอาตัวรอดคือเวลาที่ต้องรอด */
  timeLimit: number;
  /** ศัตรูเวฟแรก */
  enemies: EnemyPlacement[];
  /**
   * เฉพาะโหมดกำจัด: เวฟถัดไป (ชุดละหนึ่งเวฟ) — เคลียร์เวฟแล้วทีมเดินหน้าไปจุดถัดไป
   * แผนที่เลื่อนตาม แล้วศัตรูเวฟใหม่บุกเข้ามา · เลือด/มานา/สถานะติดตัวไปด้วย
   */
  rounds?: EnemyPlacement[][];
  /** คีย์ของพื้นหลังใน BACKGROUNDS (ไม่ใส่ = ฉากวาดด้วย CSS) */
  background?: string;
  /** เฉพาะโหมดเอาตัวรอด: เรียกศัตรูเสริมทุก ๆ กี่วินาที */
  waveEvery?: number;
  /** รายชื่อศัตรูที่จะวนเกิดในระลอกเสริม */
  waves?: string[];
}
