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

/**
 * In-wave reinforcements (sustained fights without extra transitions): the group walks in from the back of the
 * enemy zone once the wave's required enemies still standing drop to `whenAliveAtMost`. Groups trigger in order;
 * the wave is cleared only after every group has arrived and been defeated.
 */
export interface WaveReinforcement {
  whenAliveAtMost: number;
  spawns: EnemySpawn[];
}

/** One enemy encounter inside a Stage */
export interface WaveDefinition {
  spawns: EnemySpawn[];
  reinforcements?: WaveReinforcement[];
}

/**
 * Special stage modes (farm dungeons): the same combat engine with a different goal. Pure data — the stage flow
 * reads it; nothing checks a dungeon id.
 *   STORY      normal waves (tower floors)
 *   SURVIVAL   hold out until the timer ends while enemies keep arriving (score = kills)
 *   BOSS_DUEL  one boss in an arena; it enrages after `enrage.at` seconds of combat
 *   TREASURE   treasure carriers flee off the right edge — only the ones you kill drop loot (score = carriers killed)
 *   CHALLENGE  normal fight + rules that fail the stage (e.g. let too many enemy casts complete)
 */
export type StageModeKind = 'STORY' | 'SURVIVAL' | 'BOSS_DUEL' | 'TREASURE' | 'CHALLENGE';

export type ChallengeRule =
  /** the stage fails when more than `max` enemy casts complete (optionally only these skill ids) */
  | { type: 'CAST_LIMIT'; max: number; skills?: string[]; label: string }
  /** the stage fails when a `monsterId` unit is still alive `seconds` after it spawned */
  | { type: 'KILL_BEFORE'; monsterId: string; seconds: number; label: string };

export interface StageModeRules {
  kind: StageModeKind;
  /** SURVIVAL: every `every` s of combat the next group (cycled) walks in while fewer than `maxAlive` enemies stand */
  horde?: { every: number; maxAlive: number; groups: EnemySpawn[][] };
  /** BOSS_DUEL: after `at` s of combat every boss / elite enemy gets `status` (soft time limit) */
  enrage?: { at: number; status: string };
  /** CHALLENGE: fail conditions */
  challenge?: ChallengeRule[];
  /** SURVIVAL: kills needed for 2★ / 3★ */
  killStars?: [number, number];
  /** short goal text for the HUD / tower list */
  goal: string;
}

export interface StageDef {
  floor: number;
  /** special mode (farm dungeons) — default STORY */
  special?: StageModeRules;
  /** stable id for results / analytics (default `floor-N`) */
  id?: string;
  /** transition rules preset (default: story for eliminate, defense for survive) + overrides */
  rulePreset?: RulePreset;
  rules?: Partial<StageBattleRules>;
  /** explicit waves (overrides enemies + rounds when given) */
  waveDefs?: WaveDefinition[];
  /** display name, e.g. "Normal Forest — Forest Entrance" */
  name?: string;
  /**
   * small per-stage stat tuning of data-driven monsters (1 = the definition's values). Difficulty must come from
   * mechanics — the engine clamps these to HP ≤ 1.40, ATK ≤ 1.25, DEF ≤ 1.30 (MONSTER_TUNING_LIMITS)
   */
  monsterTuning?: { hp?: number; atk?: number; def?: number };
  /** recommended hero level (UI / balance sims) */
  recommendedLevel?: number;
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
