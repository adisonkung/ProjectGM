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
  /** เฉพาะโหมดเอาตัวรอด: เรียกศัตรูเสริมทุก ๆ กี่วินาที */
  waveEvery?: number;
  /** รายชื่อศัตรูที่จะวนเกิดในระลอกเสริม */
  waves?: string[];
}
