/** สายอาชีพของฮีโร่/ศัตรู */
export type HeroClass = 'tank' | 'fighter' | 'assassin' | 'archer' | 'mage' | 'healer';
export type Potential = 'C' | 'B' | 'A' | 'S';
/** 1–3 = gacha rarity (template base star) · 4–6 = developed with Hero Memory */
export type Star = 1 | 2 | 3 | 4 | 5 | 6;

/** ข้อมูลต้นแบบของฮีโร่ (ไม่เปลี่ยนระหว่างเล่น) */
export interface HeroTemplate {
  id: string;
  name: string;
  cls: HeroClass;
  /** base (gacha) rarity 1★–3★ */
  star: Star;
  /** ชื่อไฟล์ใน public/sprites ถ้ามี */
  sprite?: string;
}

/** ฮีโร่ที่ผู้เล่นมีอยู่ในฐาน */
export interface OwnedHero {
  uid: number;
  templateId: string;
  level: number;
  potential: Potential;
  /** developed star (base star … 6★) — missing = the template's base star */
  star?: number;
  /** EXP toward the next level (may exceed the requirement while waiting for a breakthrough — never discarded) */
  exp?: number;
  /** breakthroughs completed (0–3: Lv5→6, Lv8→9, Lv9→10) */
  breakthroughTier?: number;
  /** skill ranks 1–5 per slot (missing = 1) */
  skillRanks?: Partial<Record<'skill' | 'skill2' | 'ult', number>>;
  /** equipped items per slot (the item lives here while equipped; `equippedHeroId` = this uid) */
  gear?: Partial<Record<'WEAPON' | 'ARMOR' | 'ACCESSORY', import('./equipment').EquipmentInstance>>;
}

/** ค่าพลังที่ใช้ในการต่อสู้ */
export interface Stats {
  hp: number;
  atk: number;
  def: number;
  /** ครั้งต่อวินาที */
  atkSpeed: number;
  /** ช่องต่อวินาที */
  moveSpeed: number;
  /** ระยะโจมตีเป็นจำนวนช่อง (นับแนวทแยงเป็น 1) */
  range: number;
  maxMana: number;
}
