import { EnemyTemplate } from '../models/stage';
import { MONSTERS } from './monsters';

export const ENEMIES: Record<string, EnemyTemplate> = {
  slime:  { id: 'slime',  name: 'สไลม์เกราะ',       cls: 'tank',    hp: 210,  atk: 15, def: 18, sprite: 'enemy-slime.png' },
  goblin: { id: 'goblin', name: 'ก็อบลิน',           cls: 'fighter', hp: 140,  atk: 24, def: 10 },
  archer: { id: 'archer', name: 'โครงกระดูกพลธนู',  cls: 'archer',  hp: 110,  atk: 22, def: 6 },
  mage:   { id: 'mage',   name: 'หมอผีมืด',          cls: 'mage',    hp: 100,  atk: 30, def: 5, castSkills: ['meteor'] },
  shaman: { id: 'shaman', name: 'ก็อบลินหมอผี',     cls: 'healer',  hp: 130,  atk: 18, def: 6, castSkills: ['massHeal'] },
  rogue:  { id: 'rogue',  name: 'โจรเงา',            cls: 'assassin', hp: 120, atk: 28, def: 8 },
  orc:    { id: 'orc',    name: 'หัวหน้าออร์ค',      cls: 'fighter', hp: 900,  atk: 40, def: 25, boss: true, castSkills: ['earthquake'], interruptResistance: 0 },
  lich:   { id: 'lich',   name: 'ราชาลิช',           cls: 'mage',    hp: 1100, atk: 55, def: 15, boss: true, castSkills: ['deathNova', 'berserk'], interruptResistance: 0 },
};

/** What the UI needs to show an enemy id, from either a legacy template or a data-driven monster */
export interface EnemyInfo {
  name: string;
  cls: EnemyTemplate['cls'];
  boss: boolean;
  elite: boolean;
  sprite?: string;
}

export function enemyInfo(id: string): EnemyInfo | undefined {
  const m = MONSTERS[id];
  if (m) return { name: m.name, cls: m.displayClass, boss: m.rank === 'BOSS', elite: m.rank === 'ELITE', sprite: m.animation.sheet };
  const t = ENEMIES[id];
  return t ? { name: t.name, cls: t.cls, boss: !!t.boss, elite: false, sprite: t.sprite } : undefined;
}
