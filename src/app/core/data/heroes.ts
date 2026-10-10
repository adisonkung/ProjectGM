import { HeroTemplate } from '../models/hero';

/** gacha rarity = the hero's BASE star (1★–3★). Owned heroes develop to 6★ with Hero Memory (`OwnedHero.star`). */
export const HEROES: HeroTemplate[] = [
  // 2026-10 remodel: the whole old roster was removed — Bai Long is the lead / template for the new characters
  { id: 'bailong',  name: 'ไป๋หลง',   cls: 'fighter', star: 3, sprite: 'hero-bailong.png' },
  { id: 'yuezheng', name: 'เยว่เจิ้ง', cls: 'tank',    star: 3, sprite: 'hero-yuezheng.png' },
  { id: 'moye',     name: 'โม่เย่',    cls: 'assassin', star: 3, sprite: 'hero-moye.png' },
];

export const HERO_BY_ID: Record<string, HeroTemplate> = Object.fromEntries(HEROES.map(h => [h.id, h]));
