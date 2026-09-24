/** สายอาชีพของฮีโร่/ศัตรู */
export type HeroClass = 'tank' | 'fighter' | 'archer' | 'mage' | 'healer';
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
