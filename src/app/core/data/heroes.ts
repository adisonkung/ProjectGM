import { HeroTemplate } from '../models/hero';

/** gacha rarity = the hero's BASE star (1★–3★). Owned heroes develop to 6★ with Hero Memory (`OwnedHero.star`). */
export const HEROES: HeroTemplate[] = [
  // 2026-10 remodel: the whole old roster was removed — Bai Long is the lead / template for the new characters
  { id: 'bailong',  name: 'ไป๋หลง',   cls: 'fighter', star: 3, sprite: 'hero-bailong.png' },
  { id: 'yuezheng', name: 'เยว่เจิ้ง', cls: 'tank',    star: 3, sprite: 'hero-yuezheng.png' },
  { id: 'moye',     name: 'โม่เย่',    cls: 'assassin', star: 3, sprite: 'hero-moye.png' },
  { id: 'tangxun',  name: 'ถังซวิ่น',   cls: 'archer',   star: 3, sprite: 'hero-tangxun.png' },
  { id: 'linxue',   name: 'หลินเสวี่ย', cls: 'healer',   star: 3, sprite: 'hero-linxue.png' },
  { id: 'garrick',  name: 'การ์ริก',   cls: 'tank',     star: 3, sprite: 'hero-garrick.png' },
  { id: 'kael',     name: 'เคล',      cls: 'fighter',  star: 3, sprite: 'hero-kael.png' },
  // Phase A base art: approved mirelle-source.zip; skill production remains pending.
  { id: 'mirelle', name: 'มิเรลล์ ฟรอสต์กลาส', cls: 'mage', star: 3, sprite: 'hero-mirelle.png' },
  // User 2026-10-17: Emerald Huntress, existing Archer; 3★ is provisional until the roster balance pass.
  { id: 'sylvara', name: 'ซิลวารา วินด์วิสเปอร์', cls: 'archer', star: 3, sprite: 'hero-sylvara.png' },
];

export const HERO_BY_ID: Record<string, HeroTemplate> = Object.fromEntries(HEROES.map(h => [h.id, h]));
