import { StatusEffectDefinition } from '../models/combat';

/**
 * Every status effect in the game (heroes and monsters use the same system).
 * Poison is one definition used by Shade and Corvin: same source refreshes, different sources coexist.
 */
export const STATUS_EFFECTS: Record<string, StatusEffectDefinition> = {
  // ---- control
  taunted: {
    id: 'taunted', name: 'ถูกยั่วยุ', duration: 3, stackPolicy: 'REFRESH_DURATION',
    modifiers: {}, flags: ['taunted'],
  },
  stun: {
    id: 'stun', name: 'มึน', duration: 0.8, stackPolicy: 'REFRESH_DURATION',
    modifiers: {}, flags: ['stun'],
  },
  root: {
    id: 'root', name: 'ถูกตรึง', duration: 1.5, stackPolicy: 'REFRESH_DURATION',
    modifiers: {}, flags: ['root'],
  },

  // ---- damage over time
  poison: {
    id: 'poison', name: 'พิษ', duration: 4, stackPolicy: 'INDEPENDENT_BY_SOURCE',
    modifiers: {}, tick: { kind: 'DAMAGE', perSecond: 0.25, interval: 0.5 },
  },

  // ---- hero buffs
  taunt_guard: {
    id: 'taunt_guard', name: 'ตั้งรับ', duration: 3, stackPolicy: 'REFRESH_DURATION', buff: true,
    modifiers: { damageTakenMultiplier: 0.6 },
  },
  axe_frenzy: {
    id: 'axe_frenzy', name: 'คลั่งขวาน', duration: 3, stackPolicy: 'REFRESH_DURATION', buff: true,
    modifiers: { attackSpeedMultiplier: 1.15 },
  },
  blood_rage: {
    id: 'blood_rage', name: 'โทสะเลือด', duration: 6, stackPolicy: 'REFRESH_DURATION', buff: true,
    modifiers: { damageMultiplier: 1.25, attackSpeedMultiplier: 1.25 },
  },
  shadow_evasion: {
    id: 'shadow_evasion', name: 'เงาพราง', duration: 2, stackPolicy: 'REFRESH_DURATION', buff: true,
    modifiers: { dodgeChance: 0.3 },
  },
  healing_mist: {
    id: 'healing_mist', name: 'หมอกเยียวยา', duration: 4, stackPolicy: 'INDEPENDENT_BY_SOURCE', buff: true,
    modifiers: {}, tick: { kind: 'HEAL', perSecond: 0.25, interval: 1 },
  },

  // ---- Stage 4–10 statuses
  bleed: {
    id: 'bleed', name: 'เลือดไหล', duration: 5, stackPolicy: 'INDEPENDENT_BY_SOURCE',
    modifiers: {}, tick: { kind: 'DAMAGE', perSecond: 0.15, interval: 0.5 },
  },
  /** Entangling Roots / Death Root damage over time: 20% of the boss ATK per second */
  corruption: {
    id: 'corruption', name: 'คำสาปพฤกษา', duration: 3, stackPolicy: 'INDEPENDENT_BY_SOURCE',
    modifiers: {}, tick: { kind: 'DAMAGE', perSecond: 0.2, interval: 0.5 },
  },
  untargetable: {
    id: 'untargetable', name: 'ร่างหมอก', duration: 1.5, stackPolicy: 'REFRESH_DURATION',
    modifiers: {}, flags: ['untargetable'],
  },
  /** boss seal (Dark Mist Dominion): untargetable until the phase adds die (removed by the phase logic) */
  boss_seal: {
    id: 'boss_seal', name: 'ผนึกหมอกมืด', duration: Infinity, stackPolicy: 'NONE',
    modifiers: {}, flags: ['untargetable'],
  },
  dark_fog: {
    id: 'dark_fog', name: 'หมอกมืด', duration: 8, stackPolicy: 'REFRESH_DURATION',
    modifiers: { rangedAttackMultiplier: 0.75, rangedSkillMultiplier: 0.85 },
  },
  /** carrier = Dark Shaman, source = protector (Corrupted Treant) — 70% of the shaman's final damage goes to the treant */
  soul_link: {
    id: 'soul_link', name: 'พันธะวิญญาณ', duration: 8, stackPolicy: 'REFRESH_DURATION', buff: true,
    modifiers: {}, damageTransfer: 0.7,
  },
  broken: {
    id: 'broken', name: 'BROKEN', duration: 3, stackPolicy: 'REFRESH_DURATION', bossValid: true,
    modifiers: { damageTakenMultiplier: 1.25 }, flags: ['broken'],
  },
  healing_reduction: {
    id: 'healing_reduction', name: 'ฮีลลดลง', duration: 6, stackPolicy: 'REFRESH_DURATION',
    modifiers: { healingReceivedMultiplier: 0.5 },
  },
  panther_frenzy: {
    id: 'panther_frenzy', name: 'สัญชาตญาณล่า', duration: 3, stackPolicy: 'REFRESH_DURATION', buff: true,
    modifiers: { attackSpeedMultiplier: 1.2 },
  },
  enraged_forest: {
    id: 'enraged_forest', name: 'ป่าคลั่ง', duration: Infinity, stackPolicy: 'NONE', buff: true,
    modifiers: { attackSpeedMultiplier: 1.2 },
  },
  /** Elder Treant: while any Call-of-the-Forest add lives (removed by the engine when the last one dies) */
  /** boss phase setup (~1 s): thresholds can't be burst through before the phase mechanics start */
  phase_shift: {
    id: 'phase_shift', name: 'เปลี่ยนเฟส', duration: 1, stackPolicy: 'REFRESH_DURATION', buff: true,
    modifiers: { damageTakenMultiplier: 0 },
  },
  ancient_protection: {
    id: 'ancient_protection', name: 'พรพงไพรโบราณ', duration: Infinity, stackPolicy: 'NONE', buff: true,
    modifiers: { damageTakenMultiplier: 0.8 },
  },
  guardian_empowered: {
    id: 'guardian_empowered', name: 'พลังบูชายัญ', duration: Infinity, stackPolicy: 'NONE', buff: true,
    modifiers: { attackMultiplier: 1.2 },
  },
  guardian_enrage: {
    id: 'guardian_enrage', name: 'คลั่งสุดขีด', duration: Infinity, stackPolicy: 'NONE', buff: true,
    modifiers: { attackSpeedMultiplier: 1.4, damageMultiplier: 1.3 },
  },

  // ---- monster buffs
  alpha_howl_buff: {
    id: 'alpha_howl_buff', name: 'เสียงหอนจ่าฝูง', duration: 10, stackPolicy: 'REFRESH_DURATION', buff: true,
    modifiers: { attackMultiplier: 1.25 },
  },
  /** legacy enemy cast BERSERK (lich): attack + attack speed ×1.5 */
  berserk: {
    id: 'berserk', name: 'คลั่ง', duration: 8, stackPolicy: 'REFRESH_DURATION', buff: true,
    modifiers: { attackMultiplier: 1.5, attackSpeedMultiplier: 1.5 },
  },
};
