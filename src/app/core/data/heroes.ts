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
  // User 2026-10-17: Keeper of the Hearthlight; existing Healer, provisional 3★.
  { id: 'elira', name: 'เอลิรา ดอว์นเมียร์', cls: 'healer', star: 3, sprite: 'hero-elira.png' },
  // User 2026-10-20: Phantom Executioner, existing Assassin; Phase A with provisional kit/timing.
  { id: 'vaelric', name: 'เวลริค น็อกธาร์', cls: 'assassin', star: 3, sprite: 'hero-vaelric.png' },
  // User 2026-10-22: The Bloodwrought Sovereign — Tank / Fighter label, existing Tank class; Phase A, provisional 3★.
  { id: 'draeven', name: 'เดรเวน มอร์แคนต์', cls: 'tank', star: 3, sprite: 'hero-draeven.png' },
  // User 2026-10-26: Mordrienne Vale — Mage (Control / Debuff), existing Mage class; Phase A, provisional 3★.
  { id: 'mordrienne', name: 'มอร์เดรียนน์ เวล', cls: 'mage', star: 3, sprite: 'hero-mordrienne.png' },
  // User 2026-10-27: Sylas Veyrn — The Dusk Reaver (Ranged DPS / Hunter / Sharpshooter), existing Archer; provisional 3★.
  { id: 'sylas', name: 'ไซลัส เวิร์น', cls: 'archer', star: 3, sprite: 'hero-sylas.png' },
];

export const HERO_BY_ID: Record<string, HeroTemplate> = Object.fromEntries(HEROES.map(h => [h.id, h]));
