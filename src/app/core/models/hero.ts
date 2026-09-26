/** สายอาชีพของฮีโร่/ศัตรู */
export type HeroClass = 'tank' | 'fighter' | 'assassin' | 'archer' | 'mage' | 'healer';
export type Potential = 'C' | 'B' | 'A' | 'S';
export type Star = 1 | 2 | 3 | 4 | 5;

/** ข้อมูลต้นแบบของฮีโร่ (ไม่เปลี่ยนระหว่างเล่น) */
export interface HeroTemplate {
  id: string;
  name: string;
  cls: HeroClass;
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
  /** จำนวนรอบที่ต้องพักเพราะบาดเจ็บ (0 = พร้อมรบ) */
  injury: number;
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
