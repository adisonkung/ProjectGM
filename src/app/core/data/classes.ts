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
  assassin: 'ประหารเงามายา',
};

/** ค่าพื้นฐานของแต่ละสาย ที่ 1★ เลเวล 1 */
export const CLASS_BASE: Record<HeroClass, Stats> = {
  tank:    { hp: 320, atk: 22, def: 40, atkSpeed: 0.55, moveSpeed: 1.5, range: 1, maxMana: 60 },
  fighter: { hp: 220, atk: 38, def: 22, atkSpeed: 0.75, moveSpeed: 1.8, range: 1, maxMana: 70 },
  assassin: { hp: 190, atk: 40, def: 15, atkSpeed: 0.85, moveSpeed: 2.0, range: 1, maxMana: 60 },
  archer:  { hp: 160, atk: 34, def: 12, atkSpeed: 0.8,  moveSpeed: 1.6, range: 4, maxMana: 80 },
  mage:    { hp: 150, atk: 46, def: 10, atkSpeed: 0.6,  moveSpeed: 1.5, range: 3, maxMana: 90 },
  healer:  { hp: 170, atk: 24, def: 14, atkSpeed: 0.65, moveSpeed: 1.5, range: 3, maxMana: 80 },
};

/** มานาที่ได้ต่อการโจมตี 1 ครั้ง และต่อการโดนตี 1 ครั้ง */
export const MANA_PER_ATTACK = 20;
export const MANA_PER_HIT = 5;
