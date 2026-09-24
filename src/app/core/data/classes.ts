import { HeroClass, Stats } from '../models/hero';

export const CLASS_NAME: Record<HeroClass, string> = {
  tank: 'แทงก์',
  fighter: 'นักสู้',
  assassin: 'นักฆ่า',
  archer: 'นักธนู',
  mage: 'นักเวท',
  healer: 'ฮีลเลอร์',
};

export const SKILL_NAME: Record<HeroClass, string> = {
  tank: 'ยั่วยุ',
  fighter: 'ดาบหมุนวน',
  assassin: 'จู่โจมเงา',
  archer: 'ยิงรัว',
  mage: 'ระเบิดเวท',
  healer: 'บทสวดภาวนา',
};

/** สกิลที่ 2 (ใช้สลับกับสกิลแรก) และท่าไม้ตาย ของสายที่มี */
export const SKILL2_NAME: Partial<Record<HeroClass, string>> = {
  tank: 'พุ่งชนโล่',
  fighter: 'แทงทะลวง',
  archer: 'ห่าธนู',
  healer: 'พรศักดิ์สิทธิ์',
  assassin: 'ควันพิษ',
};
export const ULT_NAME: Partial<Record<HeroClass, string>> = {
  tank: 'ป้อมปราการศักดิ์สิทธิ์',
  fighter: 'ดาบมังกรประหาร',
  archer: 'ฝนธนูสวรรค์',
  healer: 'คืนชีพศักดิ์สิทธิ์',
  mage: 'อุกกาบาตเวท',
  assassin: 'ประหารเงามายา',
};

/** ค่าพื้นฐานของแต่ละสาย ที่ 1★ เลเวล 1 */
// atkSpeed = ตีธรรมดากี่ครั้ง/วิ (ช่วงห่าง 0.7–1.2 วิ) · maxMana = เกจท่าไม้ตาย (ทุกสาย 100)
export const CLASS_BASE: Record<HeroClass, Stats> = {
  tank:    { hp: 320, atk: 22, def: 40, atkSpeed: 0.85, moveSpeed: 1.5, range: 1, maxMana: 100 },
  fighter: { hp: 220, atk: 38, def: 22, atkSpeed: 1.1,  moveSpeed: 1.8, range: 1, maxMana: 100 },
  assassin: { hp: 190, atk: 40, def: 15, atkSpeed: 1.3, moveSpeed: 2.0, range: 1, maxMana: 100 },
  archer:  { hp: 160, atk: 34, def: 12, atkSpeed: 1.15, moveSpeed: 1.6, range: 4, maxMana: 100 },
  mage:    { hp: 150, atk: 46, def: 10, atkSpeed: 0.9,  moveSpeed: 1.5, range: 3, maxMana: 100 },
  healer:  { hp: 170, atk: 24, def: 14, atkSpeed: 0.95, moveSpeed: 1.5, range: 3, maxMana: 100 },
};

/**
 * มานา = เกจท่าไม้ตายเท่านั้น: ได้จากการตีธรรมดาและการโดนตี (สกิลไม่ให้มานา)
 * เกจติดตัวข้ามเวฟในชั้นเดียวกัน (เก็บไว้ใช้เวฟ 2–3 ได้)
 */
export const MANA_PER_ATTACK = 8;
export const MANA_PER_HIT = 2;

/** คูลดาวน์ (วิ) ของสกิล 1 (ใช้บ่อย 5–8 วิ) และสกิล 2 (สำคัญ 10–16 วิ) · เริ่มการต่อสู้ด้วยคูลดาวน์ครึ่งหนึ่ง */
export const SKILL_CD: Record<HeroClass, [number, number]> = {
  tank: [6, 12],
  fighter: [5, 10],
  assassin: [6, 12],
  archer: [6, 11],
  mage: [7, 14],
  healer: [8, 15],
};
export const START_CD = 0.5;
