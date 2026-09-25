import { StageDef } from '../models/stage';
import { STAGES } from './stages';

/**
 * The pre-Stage-4–10 floors 4–10 (old token enemies: slime/goblin/mage/archer/orc/shaman/rogue/lich, survive floors 6 and 8).
 * Kept only as a TEST FIXTURE for the generic engine specs (legacy cast skills, survive mode, reinforcements).
 * Index = floor − 1, like STAGES (floors 1–3 are the current ones).
 */
export const LEGACY_STAGES: StageDef[] = [
  ...STAGES.slice(0, 3),
  { floor: 4, background: 'forest-1', mode: 'eliminate', timeLimit: 100, enemies: [
    { enemy: 'slime', r: 0, c: 1 }, { enemy: 'goblin', r: 1, c: 0 }, { enemy: 'goblin', r: 1, c: 2 },
  ], rounds: [
    [{ enemy: 'goblin', r: 0, c: 0 }, { enemy: 'goblin', r: 0, c: 2 }, { enemy: 'mage', r: 4, c: 1 }],
    [{ enemy: 'slime', r: 0, c: 0 }, { enemy: 'slime', r: 0, c: 2 }, { enemy: 'goblin', r: 1, c: 1 },
      { enemy: 'mage', r: 4, c: 0 }, { enemy: 'archer', r: 4, c: 2 }],
  ] },
  { floor: 5, background: 'forest-1', mode: 'eliminate', timeLimit: 110, enemies: [
    { enemy: 'goblin', r: 0, c: 0 }, { enemy: 'goblin', r: 0, c: 2 }, { enemy: 'archer', r: 4, c: 1 },
  ], rounds: [
    [{ enemy: 'slime', r: 0, c: 1 }, { enemy: 'goblin', r: 1, c: 0 }, { enemy: 'mage', r: 4, c: 2 }],
    [{ enemy: 'orc', r: 0, c: 1 }, { enemy: 'goblin', r: 1, c: 0 }, { enemy: 'goblin', r: 1, c: 2 }, { enemy: 'shaman', r: 4, c: 0 }, { enemy: 'archer', r: 4, c: 2 }],
  ] },
  { floor: 6, background: 'twilight-1', mode: 'survive', timeLimit: 30, waveEvery: 7, waves: ['goblin', 'mage', 'slime', 'goblin'], enemies: [
    { enemy: 'slime', r: 0, c: 1 }, { enemy: 'goblin', r: 1, c: 0 }, { enemy: 'goblin', r: 1, c: 2 },
    { enemy: 'mage', r: 4, c: 1 },
  ] },
  { floor: 7, background: 'twilight-1', mode: 'eliminate', timeLimit: 100, enemies: [
    { enemy: 'goblin', r: 0, c: 1 }, { enemy: 'archer', r: 4, c: 0 },
  ], rounds: [
    [{ enemy: 'slime', r: 0, c: 1 }, { enemy: 'rogue', r: 1, c: 0 }, { enemy: 'mage', r: 4, c: 2 }],
    [{ enemy: 'slime', r: 0, c: 0 }, { enemy: 'slime', r: 0, c: 2 }, { enemy: 'goblin', r: 1, c: 1 },
      { enemy: 'mage', r: 4, c: 0 }, { enemy: 'mage', r: 4, c: 2 }],
  ] },
  { floor: 8, background: 'twilight-1', mode: 'survive', timeLimit: 30, waveEvery: 7, waves: ['goblin', 'rogue', 'archer', 'mage'], enemies: [
    { enemy: 'goblin', r: 0, c: 0 }, { enemy: 'goblin', r: 0, c: 2 },
    { enemy: 'archer', r: 4, c: 0 }, { enemy: 'archer', r: 4, c: 2 }, { enemy: 'mage', r: 5, c: 1 },
  ] },
  { floor: 9, background: 'misty-1', mode: 'eliminate', timeLimit: 100, enemies: [
    { enemy: 'goblin', r: 0, c: 0 }, { enemy: 'goblin', r: 0, c: 2 },
  ], rounds: [
    [{ enemy: 'slime', r: 0, c: 1 }, { enemy: 'shaman', r: 3, c: 1 }, { enemy: 'archer', r: 4, c: 0 }, { enemy: 'archer', r: 4, c: 2 }],
    [{ enemy: 'slime', r: 0, c: 1 }, { enemy: 'goblin', r: 1, c: 0 }, { enemy: 'goblin', r: 1, c: 2 },
      { enemy: 'rogue', r: 2, c: 1 }, { enemy: 'archer', r: 4, c: 1 }, { enemy: 'mage', r: 5, c: 0 }, { enemy: 'mage', r: 5, c: 2 }],
  ] },
  { floor: 10, background: 'misty-1', mode: 'eliminate', timeLimit: 130, enemies: [
    { enemy: 'goblin', r: 0, c: 1 }, { enemy: 'mage', r: 4, c: 1 },
  ], rounds: [
    [{ enemy: 'slime', r: 0, c: 0 }, { enemy: 'slime', r: 0, c: 2 }, { enemy: 'archer', r: 4, c: 1 }],
    [{ enemy: 'lich', r: 5, c: 1 }, { enemy: 'slime', r: 0, c: 0 }, { enemy: 'slime', r: 0, c: 2 },
      { enemy: 'mage', r: 3, c: 0 }, { enemy: 'archer', r: 3, c: 2 }],
  ] },
];
