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
