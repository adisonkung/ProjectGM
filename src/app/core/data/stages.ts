import { StageDef } from '../models/stage';

/**
 * ตำแหน่งศัตรูเป็นพิกัดในฝั่งศัตรู (ลึก 6 x 3 เลน)
 * r = ความลึก: 0 คือหน้าสุด (ติดเส้นกลาง), 5 คือหลังสุด · c = เลน 0 (บน) - 2 (ล่าง)
 */
export const STAGES: StageDef[] = [
  { floor: 1, mode: 'eliminate', timeLimit: 60, enemies: [
    { enemy: 'slime', r: 0, c: 1 }, { enemy: 'goblin', r: 1, c: 0 }, { enemy: 'goblin', r: 1, c: 2 },
  ] },
  { floor: 2, mode: 'eliminate', timeLimit: 60, enemies: [
    { enemy: 'slime', r: 0, c: 1 }, { enemy: 'goblin', r: 1, c: 0 },
    { enemy: 'archer', r: 4, c: 0 }, { enemy: 'archer', r: 4, c: 2 },
  ] },
  { floor: 3, mode: 'survive', timeLimit: 30, waveEvery: 7, waves: ['goblin', 'archer', 'goblin'], enemies: [
    { enemy: 'goblin', r: 0, c: 0 }, { enemy: 'goblin', r: 0, c: 2 }, { enemy: 'archer', r: 4, c: 1 },
  ] },
  { floor: 4, mode: 'eliminate', timeLimit: 60, enemies: [
    { enemy: 'slime', r: 0, c: 0 }, { enemy: 'slime', r: 0, c: 2 }, { enemy: 'goblin', r: 1, c: 1 },
    { enemy: 'mage', r: 4, c: 0 }, { enemy: 'archer', r: 4, c: 2 },
  ] },
  { floor: 5, mode: 'eliminate', timeLimit: 75, enemies: [
    { enemy: 'orc', r: 0, c: 1 }, { enemy: 'goblin', r: 1, c: 0 }, { enemy: 'goblin', r: 1, c: 2 },
    { enemy: 'archer', r: 4, c: 1 },
  ] },
  { floor: 6, mode: 'survive', timeLimit: 30, waveEvery: 7, waves: ['goblin', 'mage', 'slime', 'goblin'], enemies: [
    { enemy: 'slime', r: 0, c: 1 }, { enemy: 'goblin', r: 1, c: 0 }, { enemy: 'goblin', r: 1, c: 2 },
    { enemy: 'mage', r: 4, c: 1 },
  ] },
  { floor: 7, mode: 'eliminate', timeLimit: 60, enemies: [
    { enemy: 'slime', r: 0, c: 0 }, { enemy: 'slime', r: 0, c: 2 }, { enemy: 'goblin', r: 1, c: 1 },
    { enemy: 'mage', r: 4, c: 0 }, { enemy: 'mage', r: 4, c: 2 },
  ] },
  { floor: 8, mode: 'survive', timeLimit: 30, waveEvery: 7, waves: ['goblin', 'archer', 'mage'], enemies: [
    { enemy: 'goblin', r: 0, c: 0 }, { enemy: 'goblin', r: 0, c: 2 },
    { enemy: 'archer', r: 4, c: 0 }, { enemy: 'archer', r: 4, c: 2 }, { enemy: 'mage', r: 5, c: 1 },
  ] },
  { floor: 9, mode: 'eliminate', timeLimit: 60, enemies: [
    { enemy: 'slime', r: 0, c: 1 }, { enemy: 'goblin', r: 1, c: 0 }, { enemy: 'goblin', r: 1, c: 2 },
    { enemy: 'archer', r: 4, c: 1 }, { enemy: 'mage', r: 5, c: 0 }, { enemy: 'mage', r: 5, c: 2 },
  ] },
  { floor: 10, mode: 'eliminate', timeLimit: 90, enemies: [
    { enemy: 'lich', r: 5, c: 1 }, { enemy: 'slime', r: 0, c: 0 }, { enemy: 'slime', r: 0, c: 2 },
    { enemy: 'mage', r: 3, c: 0 }, { enemy: 'archer', r: 3, c: 2 },
  ] },
];
