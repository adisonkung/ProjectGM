import { HeroClass, Stats } from '../models/hero';

export const CLASS_NAME: Record<HeroClass, string> = {
  tank: 'แทงก์',
  fighter: 'นักสู้',
  assassin: 'นักฆ่า',
  archer: 'นักธนู',
  mage: 'นักเวท',
  healer: 'ฮีลเลอร์',
};

/**
 * Star stat multiplier for HP / ATK / DEF, relative to the **3★ Lv1** reference table below.
 * Gacha rarity is 1★–3★; every hero develops to 6★ with Hero Memory (core/data/stars.ts).
 * 3★ → 6★ = +18 % raw (+ small utility perks per star) — rarity is potential / development, not raw power.
 * 1★ / 2★ keep the old modest gap below 3★ (÷1.10 / ÷1.05 × … ). Attack speed, move speed and range don't scale.
 */
export const STAR_STAT_MULTIPLIER: Record<number, number> = { 1: 0.91, 2: 0.955, 3: 1.0, 4: 1.05, 5: 1.1, 6: 1.18 };
export const starMultiplier = (star: number) => STAR_STAT_MULTIPLIER[Math.max(1, Math.min(6, Math.round(star)))] ?? 1;

/**
 * Authored hero stats: FINAL **3★ Level 1** per class (the design reference — the old "5★ Lv1" table; the starting
 * roster was re-rated 5★ → 3★ at the same power, so no Stage 1–10 balance changed). Vertical-slice baseline = 58 %
 * of the first table. Attack speed / move speed / range are not star-scaled.
 */
export const HERO_3STAR_LV1: Record<HeroClass, Stats> = {
  tank:     { hp: 393, atk: 27, def: 49, atkSpeed: 0.99, moveSpeed: 1.5, range: 1, maxMana: 100 },
  fighter:  { hp: 270, atk: 47, def: 27, atkSpeed: 1.28, moveSpeed: 1.8, range: 1, maxMana: 100 },
  assassin: { hp: 234, atk: 49, def: 19, atkSpeed: 1.51, moveSpeed: 2.0, range: 1, maxMana: 100 },
  archer:   { hp: 197, atk: 42, def: 15, atkSpeed: 1.33, moveSpeed: 1.6, range: 6, maxMana: 100 },
  mage:     { hp: 184, atk: 57, def: 12, atkSpeed: 1.04, moveSpeed: 1.5, range: 5, maxMana: 100 },
  healer:   { hp: 209, atk: 30, def: 17, atkSpeed: 1.1,  moveSpeed: 1.5, range: 4, maxMana: 100 },
};
/** @deprecated old name of the same table (the roster used to be 5★) */
export const HERO_5STAR_LV1 = HERO_3STAR_LV1;

/** hero base = the 3★ Lv1 reference (star multiplier 3★ = ×1.00, so nothing is ever scaled twice) */
export const HERO_CLASS_BASE: Record<HeroClass, Stats> = HERO_3STAR_LV1;

/**
 * Legacy class stats — only the old token enemies (floors 4–10 fixtures, `enemyStats`) and engine tests use these.
 * Heroes use `HERO_CLASS_BASE`.
 */
export const CLASS_BASE: Record<HeroClass, Stats> = {
  tank:    { hp: 320, atk: 22, def: 40, atkSpeed: 0.85, moveSpeed: 1.5, range: 1, maxMana: 100 },
  fighter: { hp: 220, atk: 38, def: 22, atkSpeed: 1.1,  moveSpeed: 1.8, range: 1, maxMana: 100 },
  assassin: { hp: 190, atk: 40, def: 15, atkSpeed: 1.3, moveSpeed: 2.0, range: 1, maxMana: 100 },
  archer:  { hp: 160, atk: 34, def: 12, atkSpeed: 1.15, moveSpeed: 1.6, range: 6, maxMana: 100 },
  mage:    { hp: 150, atk: 46, def: 10, atkSpeed: 0.9,  moveSpeed: 1.5, range: 5, maxMana: 100 },
  healer:  { hp: 170, atk: 24, def: 14, atkSpeed: 0.95, moveSpeed: 1.5, range: 4, maxMana: 100 },
};

/**
 * Ultimate gauge (มานา = เกจท่าไม้ตายเท่านั้น, เต็ม 100):
 * +3 เมื่อตีธรรมดาโดนจริง (กระสุน = ตอนถึงเป้า, ฮีลโบลต์ของฮีลเลอร์ก็นับ) · +2 เมื่อโดนดาเมจ แต่ไม่เกิน 1 ครั้งต่อ 0.5 วิ
 * สกิลและท่าไม้ตายไม่ให้เกจ · เกจติดตัวข้ามเวฟ · ไม่เพิ่มช่วงเปลี่ยนเวฟ
 */
export const MANA_PER_ATTACK = 3;
export const MANA_PER_HIT = 2;
export const RECEIVE_GAUGE_ICD = 0.5;

/**
 * คูลดาวน์ (วิ) ของสกิล 1 / สกิล 2 ตามสาย (ค่าจริงอยู่ในแต่ละ SkillDefinition ใน hero-skills.ts — ตารางนี้ไว้อ้างอิง/UI สำรอง)
 * เริ่มการต่อสู้ด้วยคูลดาวน์ครึ่งหนึ่ง (START_CD) · นับต่อระหว่างเปลี่ยนเวฟ
 */
export const SKILL_CD: Record<HeroClass, [number, number]> = {
  tank: [6, 12],
  fighter: [5, 10],
  assassin: [6, 12],
  archer: [6, 11],
  mage: [7, 14],
  healer: [8, 15],
};
export const START_CD = 0.5;

/**
 * Role positioning rules (hero AI, not hard walls):
 * - leash: preferred max distance (cells) from the hero's formation anchor (skills such as dives may exceed it)
 * - maxFocusChase: how far the hero will move to engage the player's Focus Target (farther = keep Focus, fight normally)
 * - minSafeRange: ranged heroes avoid voluntarily standing closer than this to hostile melee units
 * - preferredRange: ranged heroes like to shoot from this band instead of walking to max range
 */
export interface RoleBehavior {
  leash: number;
  maxFocusChase: number;
  minSafeRange?: number;
  preferredRange?: [number, number];
}

export const ROLE_BEHAVIOR: Record<HeroClass, RoleBehavior> = {
  tank: { leash: 5, maxFocusChase: 2.5 },
  fighter: { leash: 4, maxFocusChase: 3 },
  assassin: { leash: 8, maxFocusChase: 99 },
  archer: { leash: 2.5, maxFocusChase: 2, minSafeRange: 3, preferredRange: [5, 6] },
  mage: { leash: 2, maxFocusChase: 1.5, minSafeRange: 2.5, preferredRange: [4, 5] },
  healer: { leash: 1.5, maxFocusChase: 0.5, minSafeRange: 2.5, preferredRange: [3, 4] },
};

/** hostile melee threat zone = attack range + this padding (cells) */
export const THREAT_PADDING = 0.5;

/** hero crit before gear (the engine's CRIT_CHANCE / CRIT_MULTIPLIER): 10 % for ×1.5 */
export const CRIT_CHANCE_BASE = 0.1;
export const CRIT_MULTIPLIER_BASE = 1.5;
