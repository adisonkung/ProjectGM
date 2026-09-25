import type { RulePreset, StageBattleRules } from '../../battle/engine/stage/rules';
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
  /** แผ่น sprite ใน public/sprites (ไม่มี = โทเคน) — วาดหันขวาเหมือนฮีโร่ */
  sprite?: string;
  /** สกิลร่าย (คีย์ใน ENEMY_SKILLS) */
  castSkills?: string[];
  /** เตรียมไว้สำหรับบอส (Break Gauge ในอนาคต) — ตอนนี้ยังไม่ใช้ */
  interruptResistance?: number;
}

export interface EnemyPlacement extends Cell {
  enemy: string;
}

/** A team formation slot: depth 0–5 (0 = front, next to the neutral zone) × lane 0–2 */
export interface FormationSlotRef {
  depth: number;
  lane: number;
}

/** One enemy of a Wave: which monster, which enemy-formation slot, optional fine offset (cells) */
export interface EnemySpawn {
  monsterId: string;
  formationSlot: FormationSlotRef;
  offset?: { x: number; y: number };
}

/** One enemy encounter inside a Stage */
export interface WaveDefinition {
  spawns: EnemySpawn[];
}

export interface StageDef {
  floor: number;
  /** stable id for results / analytics (default `floor-N`) */
  id?: string;
  /** transition rules preset (default: story for eliminate, defense for survive) + overrides */
  rulePreset?: RulePreset;
  rules?: Partial<StageBattleRules>;
  /** explicit waves (overrides enemies + rounds when given) */
  waveDefs?: WaveDefinition[];
  /** display name, e.g. "Normal Forest — Forest Entrance" */
  name?: string;
  /** multiplies data-driven monster HP/ATK (default 1 = the definition's values) */
  monsterScale?: number;
  mode: WinCondition;
  /** วินาที: ด่านกำจัดคือเวลาจำกัด, ด่านเอาตัวรอดคือเวลาที่ต้องรอด */
  timeLimit: number;
  /** ศัตรูเวฟแรก */
  enemies: EnemyPlacement[];
  /**
   * เฉพาะโหมดกำจัด: เวฟถัดไป (ชุดละหนึ่งเวฟ = เวฟ 2, 3 …) — เคลียร์เวฟแล้วทีมเดินหน้า (Advance) จัดแถว (Regroup)
   * แล้วศัตรูเวฟใหม่บุกเข้ามา · เลือด/เกจ/คูลดาวน์/บัฟ/ความตายติดตัวไปด้วย (ดู StageBattleRules)
   */
  rounds?: EnemyPlacement[][];
  /** คีย์ของพื้นหลังใน BACKGROUNDS (ไม่ใส่ = ฉากวาดด้วย CSS) */
  background?: string;
  /** เฉพาะโหมดเอาตัวรอด: เรียกศัตรูเสริมทุก ๆ กี่วินาที */
  waveEvery?: number;
  /** รายชื่อศัตรูที่จะวนเกิดในระลอกเสริม */
  waves?: string[];
}

/** Waves of a stage as generic WaveDefinitions (the combat code never special-cases "wave 1/2/3") */
export function wavesOf(stage: StageDef): WaveDefinition[] {
  if (stage.waveDefs?.length) return stage.waveDefs;
  const toWave = (list: EnemyPlacement[]): WaveDefinition => ({
    spawns: list.map(p => ({ monsterId: p.enemy, formationSlot: { depth: p.r, lane: p.c } })),
  });
  const first = toWave(stage.enemies);
  return stage.mode === 'eliminate' ? [first, ...(stage.rounds ?? []).map(toWave)] : [first];
}

export const stageIdOf = (stage: StageDef): string => stage.id ?? `floor-${stage.floor}`;
