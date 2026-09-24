import { HeroTemplate } from '../models/hero';

export const HEROES: HeroTemplate[] = [
  { id: 'bron',     name: 'บรอน',     cls: 'tank',    star: 1 },
  { id: 'tim',      name: 'ทิม',      cls: 'fighter', star: 1 },
  { id: 'lila',     name: 'ลิลา',     cls: 'archer',  star: 1 },
  { id: 'noa',      name: 'โนอา',     cls: 'mage',    star: 1 },
  { id: 'pin',      name: 'ปิ่น',      cls: 'healer',  star: 1 },
  { id: 'gorran',   name: 'กอร์แรน',  cls: 'tank',    star: 2 },
  { id: 'kaede',    name: 'คาเอเดะ',  cls: 'fighter', star: 2 },
  { id: 'wren',     name: 'เรน',      cls: 'archer',  star: 2 },
  { id: 'ossian',   name: 'ออสเซียน', cls: 'mage',    star: 2 },
  { id: 'mira',     name: 'มิรา',     cls: 'healer',  star: 2 },
  { id: 'heidel',   name: 'ไฮเดล',    cls: 'tank',    star: 3 },
  { id: 'saki',     name: 'ซากิ',     cls: 'fighter', star: 3 },
  { id: 'fey',      name: 'เฟย์',     cls: 'archer',  star: 3 },
  { id: 'lucian',   name: 'ลูเซียน',  cls: 'mage',    star: 3 },
  { id: 'valgas',   name: 'วัลกาส',   cls: 'tank',    star: 4 },
  { id: 'iria',     name: 'อิเรีย',   cls: 'archer',  star: 4 },
  { id: 'celine',   name: 'เซลีน',    cls: 'healer',  star: 4 },
  { id: 'jin',      name: 'จิน',      cls: 'fighter', star: 5, sprite: 'hero-jin.png' },
  { id: 'sylvie',   name: 'ซิลวี',    cls: 'archer',  star: 5, sprite: 'hero-sylvie.png' },
  { id: 'lumina',   name: 'ลูมิน่า',  cls: 'healer',  star: 5, sprite: 'hero-lumina.png' },
  { id: 'aria',     name: 'อาเรีย',   cls: 'mage',    star: 5 },
  { id: 'shade',    name: 'เชด',      cls: 'assassin', star: 5, sprite: 'hero-shade.png' },
  { id: 'aurel',    name: 'ออเรล',    cls: 'tank',    star: 5, sprite: 'hero-aurel.png' },
];

export const HERO_BY_ID: Record<string, HeroTemplate> = Object.fromEntries(HEROES.map(h => [h.id, h]));
